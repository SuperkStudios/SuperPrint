import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

const filamentSchema = z.object({
  id: z.string().optional(),
  material: z.enum(["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
  color: z.string(),
  brand: z.string(),
  remainingGrams: z.number().int().nonnegative(),
  thresholdGrams: z.number().int().nonnegative(),
  location: z.string()
});

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  return NextResponse.json({
    spools: await prisma.filamentSpool.findMany({ orderBy: { updatedAt: "desc" } })
  });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const body = filamentSchema.parse(await request.json());
  const spool = body.id
    ? await prisma.filamentSpool.update({ where: { id: body.id }, data: body })
    : await prisma.filamentSpool.create({ data: body });

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
