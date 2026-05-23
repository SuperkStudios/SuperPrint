import { NextResponse } from "next/server";
import { z } from "zod";
import type { CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { prisma } from "@/lib/prisma";
import { syncManualPrintEventsFromHistory } from "@/services/printer-heartbeat";
import { authenticateSuperNode } from "@/services/supernode-jobs";

export const runtime = "nodejs";

const historyItemSchema = z.object({
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

const schema = z.object({
  nodeId: z.string().min(1),
  printerId: z.string().optional().nullable(),
  completedPrints: z.array(historyItemSchema).default([])
});

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const body = schema.parse(await request.json());
  const node = await authenticateSuperNode(body.nodeId, bearer).catch(() => null);
  if (!node) {
    return NextResponse.json({ error: "Invalid SuperNode credentials" }, { status: 401 });
  }
  if (body.printerId && node.printerId && body.printerId !== node.printerId) {
    return NextResponse.json({ error: "SuperNode is not assigned to this printer" }, { status: 403 });
  }

  const completedPrints = body.completedPrints as CompletedPrinterHistoryItem[];
  await prisma.systemSetting.upsert({
    where: { key: "printerHistory.lastPull" },
    update: { value: completedPrints },
    create: { key: "printerHistory.lastPull", value: completedPrints }
  });
  const syncedManualEvents = await syncManualPrintEventsFromHistory(completedPrints);
  return NextResponse.json({
    accepted: true,
    count: completedPrints.length,
    syncedManualEvents: syncedManualEvents.updated
  });
}
