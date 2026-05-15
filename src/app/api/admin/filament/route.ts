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
  location: z.string().default("Stock")
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

  const body = filamentSchema.parse(await request.json());
  const data = {
    ...body,
    type: body.material,
    costPerSpoolCents: body.rollCostCents,
    costPerGramCents: body.rollCostCents / Math.max(1, body.startingGrams)
  };
  const spool = body.id
    ? await prisma.filamentSpool.update({ where: { id: body.id }, data })
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
