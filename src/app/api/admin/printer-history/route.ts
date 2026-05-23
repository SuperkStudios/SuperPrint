import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fetchCentauriCompletedHistory } from "@/lib/centauri-history-client";
import type { CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";
import { syncManualPrintEventsFromHistory } from "@/services/printer-heartbeat";

export const runtime = "nodejs";

const printSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  gramsUsed: z.number().positive().optional(),
  completedAt: z.string().optional(),
  gramsSource: z.string().optional(),
  printedLayers: z.number().optional(),
  totalLayers: z.number().optional(),
  printTimeSeconds: z.number().optional(),
  material: z.string().optional()
});

const actionSchema = z.object({
  action: z.enum(["assign", "ignore", "importCompleted"]),
  print: printSchema,
  spoolId: z.string().optional()
});

export async function POST() {
  const { response } = await requireAdmin("history");
  if (response) return response;
  const printer = await prisma.printer.findFirst({ orderBy: { publicName: "asc" } });
  if (!printer) {
    return NextResponse.json({ completedPrints: [], message: "No printer is registered." }, { status: 404 });
  }
  try {
    const completedPrints = await withTimeout(
      fetchCentauriCompletedHistory({ controlApiUrl: printer.controlApiUrl, timeoutMs: 30000, gcodeTimeoutMs: 5000, includeMissingGrams: true, enrichGcode: true }),
      90000
    );
    const enrichedPrints = await enrichFromAssignedHistory(completedPrints);
    if (enrichedPrints.length) {
      await cachePrinterHistory(enrichedPrints);
    }
    const fallbackPrints = enrichedPrints.length ? enrichedPrints : await readCachedPrinterHistory();
    const actionablePrints = await filterActionablePrinterHistory(fallbackPrints);
    const syncedManualEvents = await syncManualPrintEventsFromHistory(actionablePrints);
    const withGrams = actionablePrints.filter((print) => typeof print.gramsUsed === "number" && print.gramsUsed > 0).length;
    const stopped = actionablePrints.filter((print) => print.status === "STOPPED").length;
    const failed = actionablePrints.filter((print) => print.status === "FAILED").length;
    return NextResponse.json({
      completedPrints: actionablePrints,
      message: actionablePrints.length
        ? `${enrichedPrints.length ? "Found" : "Using last pulled"} ${actionablePrints.length} untracked printer-history row(s), including ${stopped} stopped and ${failed} failed. ${withGrams} include material usage. ${syncedManualEvents.updated} manual event(s) synced.`
        : "No printer-history entries were found."
    });
  } catch (error) {
    const fallbackPrints = await filterActionablePrinterHistory(await readCachedPrinterHistory());
    if (fallbackPrints.length) {
      const withGrams = fallbackPrints.filter((print) => typeof print.gramsUsed === "number" && print.gramsUsed > 0).length;
      const stopped = fallbackPrints.filter((print) => print.status === "STOPPED").length;
      const failed = fallbackPrints.filter((print) => print.status === "FAILED").length;
      return NextResponse.json({
        completedPrints: fallbackPrints,
        message: `Using SuperNode-synced printer history because the VPS could not reach the printer directly. ${fallbackPrints.length} untracked row(s), including ${stopped} stopped and ${failed} failed. ${withGrams} include material usage.`
      });
    }
    return NextResponse.json({ completedPrints: [], message: error instanceof Error ? error.message : "Could not read printer history." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { session, response } = await requireAdmin("history");
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
    if (!hasUsableGrams(body.print)) {
      return NextResponse.json({ error: "Printer history did not include material usage for this print." }, { status: 400 });
    }
    await assignPrintToSpool(body.spoolId, body.print);
    return NextResponse.json({ message: "Print assigned to filament roll." });
  }
  if (!hasUsableGrams(body.print)) {
    return NextResponse.json({ error: "Printer history did not include material usage for this print." }, { status: 400 });
  }
  const printWithGrams = body.print;

  const result = await prisma.$transaction(async (tx) => {
    const spool = await assignPrintToSpool(body.spoolId!, printWithGrams, tx);
    const printStatus = toPrintJobStatus(printWithGrams.status);
    const orderStatus = printStatus === "FAILED" ? "FAILED" : printStatus === "STOPPED" ? "STOPPED" : "COMPLETED";
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
        completedAt: printWithGrams.completedAt ? new Date(printWithGrams.completedAt) : new Date(),
        failureReason: printStatus === "FAILED" ? `Imported failed printer-history entry` : undefined,
        consumedFilamentGrams: Math.round(printWithGrams.gramsUsed),
        progressPercent: progressPercentForImportedHistory(printWithGrams),
        currentLayer: printWithGrams.printedLayers,
        elapsedSeconds: printWithGrams.printTimeSeconds,
        remainingSeconds: printStatus === "COMPLETED" ? 0 : undefined
      }
    });
    return { order, job, spool };
  });

  await recordPlatformEvent({
    type: result.job.status === "FAILED" ? "PRINT_FAILED" : result.job.status === "STOPPED" ? "PRINT_STOPPED" : "PRINT_COMPLETED",
    actorId: session!.user.id,
    payload: {
      orderNumber: result.order.orderNumber,
      importedHistoryId: body.print.id,
      fileName: body.print.name,
      progressPercent: result.job.status === "COMPLETED" ? 100 : progressPercentForImportedHistory(body.print),
      consumedFilamentGrams: Math.round(printWithGrams.gramsUsed)
    }
  });
  return NextResponse.json({ message: `Past ${body.print.status.toLowerCase()} print imported into platform stats without changing failure counts unless it truly failed.`, job: result.job });
}

function toPrintJobStatus(status: string) {
  if (status === "FAILED") return "FAILED";
  if (status === "STOPPED") return "STOPPED";
  return "COMPLETED";
}

function progressPercentForImportedHistory(print: z.infer<typeof printSchema>) {
  if (print.status === "COMPLETED") return 100;
  if (typeof print.printedLayers === "number" && typeof print.totalLayers === "number" && print.totalLayers > 0) {
    return Math.min(100, Math.max(0, Math.round((print.printedLayers / print.totalLayers) * 100)));
  }
  return undefined;
}

function hasUsableGrams(print: z.infer<typeof printSchema>): print is z.infer<typeof printSchema> & { gramsUsed: number } {
  return typeof print.gramsUsed === "number" && Number.isFinite(print.gramsUsed) && print.gramsUsed > 0;
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
  const mergedPrints = mergePrinterHistory(await readCachedPrinterHistory(), prints);
  await prisma.systemSetting.upsert({
    where: { key: "printerHistory.lastPull" },
    update: { value: mergedPrints },
    create: { key: "printerHistory.lastPull", value: mergedPrints }
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

async function assignPrintToSpool(spoolId: string, print: z.infer<typeof printSchema> & { gramsUsed: number }, client: Prisma.TransactionClient | typeof prisma = prisma) {
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

async function filterActionablePrinterHistory(prints: CompletedPrinterHistoryItem[]) {
  const hiddenIds = await readProcessedPrinterHistoryIds();
  return prints.filter((print) => !hiddenIds.has(print.id));
}

async function readProcessedPrinterHistoryIds() {
  const [ignoredSetting, spools] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: "printerHistory.ignored" } }),
    prisma.filamentSpool.findMany({ select: { assignedPrinterHistory: true } })
  ]);
  const ids = new Set<string>();
  for (const item of readHistory(ignoredSetting?.value)) ids.add(item.id);
  for (const spool of spools) {
    for (const item of readHistory(spool.assignedPrinterHistory)) ids.add(item.id);
  }
  return ids;
}

function compactPrint(print: z.infer<typeof printSchema>) {
  return {
    id: print.id,
    name: print.name,
    gramsUsed: print.gramsUsed ? Math.round(print.gramsUsed) : undefined,
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

function mergePrinterHistory(existing: CompletedPrinterHistoryItem[], incoming: CompletedPrinterHistoryItem[]) {
  const byId = new Map<string, CompletedPrinterHistoryItem>();
  for (const print of existing) byId.set(print.id, print);
  for (const print of incoming) byId.set(print.id, { ...byId.get(print.id), ...print });
  return [...byId.values()].sort((left, right) => {
    const rightTime = right.completedAt ? Date.parse(right.completedAt) : 0;
    const leftTime = left.completedAt ? Date.parse(left.completedAt) : 0;
    return rightTime - leftTime;
  });
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
