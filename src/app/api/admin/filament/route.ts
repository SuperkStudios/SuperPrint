import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const filamentSchema = z.object({
  id: z.string().optional(),
  material: z.enum(["PLA", "PLA_PLUS", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
  color: z.string(),
  brand: z.string(),
  startingGrams: z.number().int().positive().default(1000),
  remainingGrams: z.number().int().nonnegative(),
  thresholdGrams: z.number().int().nonnegative().default(150),
  rollCostCents: z.number().int().nonnegative().default(0),
  location: z.string().default("Stock"),
  active: z.boolean().optional(),
  requiresAdminApproval: z.boolean().optional(),
  notes: z.string().optional().nullable()
});

const historyActionSchema = z.object({
  action: z.enum(["removeHistory", "moveHistory"]),
  spoolId: z.string(),
  historyId: z.string(),
  targetSpoolId: z.string().optional()
});

export async function GET() {
  const { response } = await requireAdmin("filament");
  if (response) return response;

  return NextResponse.json({
    spools: await prisma.filamentSpool.findMany({ orderBy: { updatedAt: "desc" } })
  });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("filament");
  if (response) return response;

  const { id, ...body } = filamentSchema.parse(await request.json());
  const data = {
    ...body,
    type: body.material,
    costPerSpoolCents: body.rollCostCents,
    costPerGramCents: body.rollCostCents / Math.max(1, body.startingGrams)
  };
  const spool = id
    ? await prisma.filamentSpool.update({ where: { id }, data })
    : await prisma.filamentSpool.create({ data });

  if (spool.remainingGrams <= spool.thresholdGrams) {
    await recordPlatformEvent({
      type: "FILAMENT_LOW",
      actorId: session!.user.id,
      payload: {
        material: spool.material,
        color: spool.color,
        remainingGrams: spool.remainingGrams,
        adminNotes: `Replace from ${spool.location}`
      }
    });
  }

  return NextResponse.json({ spool });
}

export async function PATCH(request: Request) {
  const { response } = await requireAdmin("filament");
  if (response) return response;

  const body = historyActionSchema.parse(await request.json());
  if (body.action === "moveHistory" && !body.targetSpoolId) {
    return NextResponse.json({ error: "targetSpoolId is required" }, { status: 400 });
  }
  if (body.targetSpoolId && body.targetSpoolId === body.spoolId) {
    return NextResponse.json({ error: "Choose a different filament roll." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const source = await tx.filamentSpool.findUniqueOrThrow({ where: { id: body.spoolId } });
    const sourceHistory = readHistory(source.assignedPrinterHistory);
    const item = sourceHistory.find((history) => history.id === body.historyId);
    if (!item) throw new Error("Assigned printer-history row was not found on this filament roll.");
    const gramsUsed = Math.max(0, Math.round(item.gramsUsed || 0));
    const nextSourceHistory = sourceHistory.filter((history) => history.id !== body.historyId);

    const updatedSource = await tx.filamentSpool.update({
      where: { id: body.spoolId },
      data: {
        remainingGrams: { increment: gramsUsed },
        assignedPrinterHistory: nextSourceHistory
      }
    });

    if (body.action === "removeHistory") {
      return {
        message: `Removed ${item.name} from ${source.color} ${source.material}.`,
        source: updatedSource,
        target: null
      };
    }

    const target = await tx.filamentSpool.findUniqueOrThrow({ where: { id: body.targetSpoolId! } });
    const targetHistory = readHistory(target.assignedPrinterHistory);
    const updatedTarget = await tx.filamentSpool.update({
      where: { id: target.id },
      data: {
        remainingGrams: targetHistory.some((history) => history.id === item.id) ? undefined : { decrement: gramsUsed },
        assignedPrinterHistory: targetHistory.some((history) => history.id === item.id) ? targetHistory : [...targetHistory, item]
      }
    });
    return {
      message: `Moved ${item.name} to ${target.color} ${target.material}.`,
      source: updatedSource,
      target: updatedTarget
    };
  });

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const { response } = await requireAdmin("filament");
  if (response) return response;

  const id = await readDeleteId(request);
  if (!id) return NextResponse.json({ error: "Filament id is required" }, { status: 400 });

  const [
    printerCount,
    printJobCount,
    productCount,
    cartItemCount,
    orderCount,
    orderItemCount,
    pricingSnapshotCount,
    plateJobCount
  ] = await Promise.all([
    prisma.printer.count({ where: { currentFilamentId: id } }),
    prisma.printJob.count({ where: { filamentId: id } }),
    prisma.product.count({ where: { defaultFilamentMaterialId: id } }),
    prisma.cartItem.count({ where: { selectedFilamentMaterialId: id } }),
    prisma.order.count({ where: { selectedFilamentMaterialId: id } }),
    prisma.orderItem.count({ where: { selectedFilamentMaterialId: id } }),
    prisma.orderPricingSnapshot.count({ where: { filamentMaterialId: id } }),
    prisma.productionPlateJob.count({ where: { filamentId: id } })
  ]);
  const hasHistory = printerCount + printJobCount + productCount + cartItemCount + orderCount + orderItemCount + pricingSnapshotCount + plateJobCount > 0;

  if (hasHistory) {
    const spool = await prisma.filamentSpool.update({ where: { id }, data: { active: false } });
    return NextResponse.json({
      removed: false,
      deactivated: true,
      spool,
      message: "Filament is referenced by existing records, so it was deactivated instead of deleted."
    });
  }

  await prisma.filamentSpool.delete({ where: { id } });
  return NextResponse.json({ removed: true, deactivated: false, message: "Filament deleted." });
}

function readHistory(value: unknown): Array<{ id: string; name: string; gramsUsed: number; completedAt?: string; status?: string; gramsSource?: string; printedLayers?: number; totalLayers?: number; material?: string }> {
  return Array.isArray(value)
    ? value.filter((item): item is { id: string; name: string; gramsUsed: number; completedAt?: string; status?: string; gramsSource?: string; printedLayers?: number; totalLayers?: number; material?: string } => {
        return Boolean(item && typeof item === "object" && "id" in item && "name" in item);
      })
    : [];
}

async function readDeleteId(request: Request) {
  const queryId = new URL(request.url).searchParams.get("id");
  if (queryId) return queryId;
  try {
    const body = await request.json();
    return typeof body?.id === "string" ? body.id : null;
  } catch {
    return null;
  }
}
