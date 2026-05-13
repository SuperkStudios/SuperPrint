import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fetchCentauriCompletedHistory } from "@/lib/centauri-history-client";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

export const runtime = "nodejs";

const printSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  gramsUsed: z.number().positive(),
  completedAt: z.string().optional()
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
    const completedPrints = await fetchCentauriCompletedHistory({ controlApiUrl: printer.controlApiUrl });
    return NextResponse.json({
      completedPrints,
      message: completedPrints.length ? `Found ${completedPrints.length} completed print(s).` : "No completed printer-history entries with material usage were found."
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
    return NextResponse.json({ message: "Print ignored." });
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
    const order = await tx.order.create({
      data: {
        orderNumber: `SP-HIST-${Date.now().toString().slice(-6)}`,
        customerId: session!.user.id,
        totalCents: 0,
        status: "COMPLETED",
        paymentStatus: "PAST_PRINT"
      }
    });
    const job = await tx.printJob.create({
      data: {
        orderId: order.id,
        filamentId: spool.id,
        status: "COMPLETED",
        etaMinutes: 0,
        completedAt: body.print.completedAt ? new Date(body.print.completedAt) : new Date(),
        consumedFilamentGrams: Math.round(body.print.gramsUsed)
      }
    });
    return { order, job, spool };
  });

  await recordPlatformEvent({
    type: "PRINT_COMPLETED",
    actorId: session!.user.id,
    payload: {
      orderNumber: result.order.orderNumber,
      importedHistoryId: body.print.id,
      fileName: body.print.name,
      consumedFilamentGrams: Math.round(body.print.gramsUsed)
    }
  });
  return NextResponse.json({ message: "Past print imported as a completed job.", job: result.job });
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
    completedAt: print.completedAt
  };
}

function readHistory(value: unknown): Array<{ id: string; name: string; gramsUsed: number; completedAt?: string }> {
  return Array.isArray(value) ? value.filter((item): item is { id: string; name: string; gramsUsed: number; completedAt?: string } => Boolean(item && typeof item === "object" && "id" in item)) : [];
}
