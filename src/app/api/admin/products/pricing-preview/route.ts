import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { calculateProductPricePreview } from "@/services/pricing";

const previewSchema = z.object({
  productId: z.string().optional().nullable(),
  estimatedGrams: z.number().int().positive(),
  estimatedPrintMinutes: z.number().int().positive(),
  baseLaborMinutes: z.number().int().nonnegative(),
  basePackagingCents: z.number().int().nonnegative(),
  pricingMode: z.enum(["FIXED", "DYNAMIC"]),
  fixedPriceCents: z.number().int().positive().optional().nullable(),
  filamentMaterialIds: z.array(z.string()).min(1)
});

export async function POST(request: Request) {
  const { response } = await requireAdmin("products");
  if (response) return response;

  const body = previewSchema.parse(await request.json());
  const quotes = await calculateProductPricePreview(body);
  return NextResponse.json({ quotes });
}
