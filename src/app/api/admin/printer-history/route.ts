import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fetchCentauriCompletedHistory } from "@/lib/centauri-history-client";
import type { CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

export const runtime = "nodejs";

const printSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  gramsUsed: z.number().positive(),
  completedAt: z.string().optional(),
  gramsSource: z.string().optional(),
  printedLayers: z.number().optional(),
  totalLayers: z.number().optional(),
  material: z.string().optional()
});

const actionSchema = z.object({
  action: z.enum(["assign", "ignore", "importCompleted"]),
  print: printSchema,
  spoolId: z.string().optional()
});

export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;
  const printer = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  if (!printer) {
    return NextResponse.json({ completedPrints: [], message: "No printer is registered." }, { status: 404 });
  }
  try {
    const completedPrints = await withTimeout(
      fetchCentauriCompletedHistory({ controlApiUrl: printer.controlApiUrl, timeoutMs: 15000, gcodeTimeoutMs: 5000, includeMissingGrams: true, enrichGcode: true }),
      45000
    );
    const enrichedPrints = await enrichFromAssignedHistory(completedPrints);
    if (enrichedPrints.length) {
      await cachePrinterHistory(enrichedPrints);
    }
    const fallbackPrints = enrichedPrints.length ? enrichedPrints : await readCachedPrinterHistory();
    const withGrams = fallbackPrints.filter((print) => typeof print.gramsUsed === "number" && print.gramsUsed > 0).length;
    const interrupted = fallbackPrints.filter((print) => ["FAILED", "STOPPED"].includes(print.status)).length;
    return NextResponse.json({
      completedPrints: fallbackPrints,
      message: fallbackPrints.length
        ? `${enrichedPrints.length ? "Found" : "Using last pulled"} ${fallbackPrints.length} printer-history row(s), including ${interrupted} stopped/failed. ${withGrams} include material usage.`
        : "No printer-history entries were found."
    });
  } catch (error) {
    return NextResponse.json({ completedPrints: [], message: error instanceof Error ? error.message : "Could not read printer history." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  const body = actionSchema.parse(await request.json());
  if (body.action === "ignore") {
    await appendIgnoredPrint(body.print);
    return NextResponse.json({ message: "Printer-history row ignored and saved." });
  }
  if (!body.spoolId) {
    return NextResponse.json({ error: "spoolId is required" }, { status: 400 });
  }
  if (body.action === "assign") {
    await assignPrintToSpool(body.spoolId, body.print);
    return NextResponse.json({ message: "Print assigned to filament roll." });
  }

  const result = await prisma.$transaction(async (tx) => {
    const spool = await assignPrintToSpool(body.spoolId!, body.print, tx);
    const printStatus = toPrintJobStatus(body.print.status);
    const orderStatus = printStatus === "COMPLETED" ? "COMPLETED" : "FAILED";
    const order = await tx.order.create({
      data: {
        orderNumber: `SP-HIST-${Date.now().toString().slice(-6)}`,
        customerId: session!.user.id,
        totalCents: 0,
        status: orderStatus,
        paymentStatus: "PAST_PRINT"
      }
    });
    const job = await tx.printJob.create({
      data: {
        orderId: order.id,
        filamentId: spool.id,
        status: printStatus,
        etaMinutes: 0,
        completedAt: body.print.completedAt ? new Date(body.print.completedAt) : new Date(),
        failureReason: printStatus === "FAILED" ? `Imported ${body.print.status.toLowerCase()} printer-history entry` : undefined,
        consumedFilamentGrams: Math.round(body.print.gramsUsed)
      }
    });
    return { order, job, spool };
  });

  await recordPlatformEvent({
    type: result.job.status === "COMPLETED" ? "PRINT_COMPLETED" : "PRINT_FAILED",
    actorId: session!.user.id,
    payload: {
      orderNumber: result.order.orderNumber,
      importedHistoryId: body.print.id,
      fileName: body.print.name,
      consumedFilamentGrams: Math.round(body.print.gramsUsed)
    }
  });
  return NextResponse.json({ message: `Past ${body.print.status.toLowerCase()} print imported into platform stats.`, job: result.job });
}

function toPrintJobStatus(status: string) {
  return status === "COMPLETED" ? "COMPLETED" : "FAILED";
}

async function enrichFromAssignedHistory(prints: CompletedPrinterHistoryItem[]) {
  const spools = await prisma.filamentSpool.findMany({ select: { assignedPrinterHistory: true } });
  const knownByName = new Map<string, { gramsUsed: number }>();
  for (const spool of spools) {
    for (const item of readHistory(spool.assignedPrinterHistory)) {
      if (item.gramsUsed > 0) knownByName.set(item.name, item);
    }
  }
  const nameEnriched = prints.map((print) => {
    if (typeof print.gramsUsed === "number" && print.gramsUsed > 0) return print;
    if (!["COMPLETED", "FAILED", "STOPPED"].includes(print.status)) return print;
    const known = knownByName.get(print.name);
    if (!known || !print.printedLayers || !print.totalLayers) return print;
    const ratio = Math.max(0, Math.min(1, print.printedLayers / print.totalLayers));
    return {
      ...print,
      gramsUsed: Number((known.gramsUsed * ratio).toFixed(2)),
      gramsSource: "MATCHED_COMPLETED_PRINT" as const
    };
  });
  const knownRates = nameEnriched
    .filter((print): print is CompletedPrinterHistoryItem & { gramsUsed: number; printTimeSeconds: number } => {
      return typeof print.gramsUsed === "number" && print.gramsUsed > 0 && typeof print.printTimeSeconds === "number" && print.printTimeSeconds > 0;
    })
    .map((print) => print.gramsUsed / print.printTimeSeconds)
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  const fallbackRate = knownRates.length ? knownRates.reduce((total, rate) => total + rate, 0) / knownRates.length : undefined;

  return nameEnriched.map((print) => {
    if (typeof print.gramsUsed === "number" && print.gramsUsed > 0) return print;
    if (!fallbackRate || !print.printTimeSeconds || print.printTimeSeconds <= 0) return print;
    return {
      ...print,
      gramsUsed: Number((fallbackRate * print.printTimeSeconds).toFixed(2)),
      gramsSource: "TIME_ESTIMATE" as const
    };
  });
}

async function cachePrinterHistory(prints: CompletedPrinterHistoryItem[]) {
  await prisma.systemSetting.upsert({
    where: { key: "printerHistory.lastPull" },
    update: { value: prints },
    create: { key: "printerHistory.lastPull", value: prints }
  });
}

async function readCachedPrinterHistory() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "printerHistory.lastPull" } });
  return Array.isArray(setting?.value)
    ? setting.value.filter(
        (item): item is CompletedPrinterHistoryItem =>
          Boolean(item && typeof item === "object" && "id" in item && "name" in item && "status" in item)
      )
    : [];
}

async function assignPrintToSpool(spoolId: string, print: z.infer<typeof printSchema>, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const spool = await client.filamentSpool.findUniqueOrThrow({ where: { id: spoolId } });
  const assigned = readHistory(spool.assignedPrinterHistory);
  if (assigned.some((item) => item.id === print.id)) return spool;
  const ignored = readHistory(spool.ignoredPrinterHistory).filter((item) => item.id !== print.id);
  return client.filamentSpool.update({
    where: { id: spoolId },
    data: {
      remainingGrams: { decrement: Math.round(print.gramsUsed) },
      assignedPrinterHistory: [...assigned, compactPrint(print)],
      ignoredPrinterHistory: ignored
    }
  });
}

async function appendIgnoredPrint(print: z.infer<typeof printSchema>) {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "printerHistory.ignored" } });
  const ignored = readHistory(setting?.value);
  if (ignored.some((item) => item.id === print.id)) return;
  await prisma.systemSetting.upsert({
    where: { key: "printerHistory.ignored" },
    update: { value: [...ignored, compactPrint(print)] },
    create: { key: "printerHistory.ignored", value: [compactPrint(print)] }
  });
}

function compactPrint(print: z.infer<typeof printSchema>) {
  return {
    id: print.id,
    name: print.name,
    gramsUsed: Math.round(print.gramsUsed),
    completedAt: print.completedAt,
    status: print.status,
    gramsSource: print.gramsSource,
    printedLayers: print.printedLayers,
    totalLayers: print.totalLayers,
    material: print.material
  };
}

function readHistory(value: unknown): Array<{ id: string; name: string; gramsUsed: number; completedAt?: string; status?: string }> {
  return Array.isArray(value) ? value.filter((item): item is { id: string; name: string; gramsUsed: number; completedAt?: string; status?: string } => Boolean(item && typeof item === "object" && "id" in item)) : [];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Printer history pull timed out. Try again or check the printer connection.")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
