import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { prepareCheckoutShipping } from "@/services/shipping";

const addressSchema = z.object({
  name: z.string().optional(),
  street1: z.string().optional(),
  street2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional()
});

const schema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500).default(1),
  productPriceCents: z.number().int().nonnegative(),
  customerEmail: z.string().email().optional().nullable(),
  fulfillment: z.object({
    method: z.enum(["SHIP", "PICKUP"]),
    address: addressSchema.optional().nullable()
  })
});

export async function POST(request: Request) {
  const { response } = await requireAdmin("orders");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    const product = await prisma.product.findUniqueOrThrow({ where: { id: body.productId } });
    const quote = await prepareCheckoutShipping({
      product,
      productPriceCents: body.productPriceCents,
      quantity: body.quantity,
      customerEmail: body.customerEmail,
      fulfillment: body.fulfillment
    });
    return NextResponse.json({
      ...quote,
      rateId: quote.rate?.object_id ?? null,
      provider: quote.rate?.provider ?? null,
      service: quote.rate?.servicelevel?.name ?? quote.rate?.servicelevel_name ?? null,
      estimatedDays: quote.rate?.estimated_days ?? null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not quote fulfillment." }, { status: 400 });
  }
}
