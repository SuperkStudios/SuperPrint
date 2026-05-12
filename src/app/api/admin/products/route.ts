import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { upsertProduct } from "@/services/products";

const schema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string(),
  imageUrl: z.string(),
  priceCents: z.number(),
  estimatedPrintMinutes: z.number(),
  defaultMaterial: z.enum(["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE")
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  const body = schema.parse(await request.json());
  return NextResponse.json({ product: await upsertProduct(body, session!.user.id) });
}
