import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getPartInventoryRows, getPartProductionPlanner } from "@/services/part-planner";

const schema = z.object({
  productPartId: z.string().min(1),
  color: z.string().trim().min(1),
  quantityOnHand: z.number().int().min(0).max(100000).optional(),
  quantityDelta: z.number().int().min(1).max(100000).optional(),
  location: z.string().trim().min(1).default("Storage"),
  notes: z.string().optional().nullable()
}).refine((value) => value.quantityOnHand !== undefined || value.quantityDelta !== undefined, {
  message: "quantityOnHand or quantityDelta is required"
});

export async function GET() {
  const { response } = await requireAdmin("products");
  if (response) return response;
  const [parts, planner] = await Promise.all([getPartInventoryRows(), getPartProductionPlanner()]);
  return NextResponse.json({ parts, planner });
}

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("products");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    const inventory = await prisma.productPartInventory.upsert({
      where: {
        productPartId_color_location: {
          productPartId: body.productPartId,
          color: body.color,
          location: body.location
        }
      },
      update: {
        quantityOnHand: body.quantityDelta ? { increment: body.quantityDelta } : body.quantityOnHand,
        notes: body.notes?.trim() || null,
        updatedById: session?.user.id
      },
      create: {
        productPartId: body.productPartId,
        color: body.color,
        quantityOnHand: body.quantityDelta ?? body.quantityOnHand ?? 0,
        location: body.location,
        notes: body.notes?.trim() || null,
        updatedById: session?.user.id
      }
    });
    return NextResponse.json({ inventory });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update part inventory." }, { status: 400 });
  }
}
