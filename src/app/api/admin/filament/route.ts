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
