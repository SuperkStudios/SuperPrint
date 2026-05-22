import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { getStripeSettings } from "@/lib/stripe";
import { createManualCardOrderPayment } from "@/services/in-person-orders";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  unitPriceCents: z.number().int().nonnegative().optional().nullable(),
  selectedFilamentMaterialIds: z.array(z.string()).default([]),
  selectedColors: z.array(z.string()).default([])
});

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
  customerName: z.string().trim().min(1),
  customerEmail: z.string().trim().email(),
  lines: z.array(lineSchema).min(1),
  internalNotes: z.string().optional().nullable(),
  orderDate: z.string().optional().nullable(),
  source: z.enum(["IN_PERSON", "PAST_IMPORT"]).default("IN_PERSON"),
  savePaymentMethod: z.boolean().default(true),
  estimatedPickupAt: z.string().optional().nullable(),
  fulfillment: z.object({
    method: z.enum(["SHIP", "PICKUP"]),
    address: addressSchema.optional().nullable()
  }).optional(),
  shippingAmountCents: z.number().int().nonnegative().optional(),
  shippingRateCents: z.number().int().nonnegative().optional(),
  shippoRateId: z.string().optional().nullable(),
  shippoShipmentId: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("orders");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    const [result, settings] = await Promise.all([
      createManualCardOrderPayment({
        ...body,
        paymentMethod: "STRIPE_MANUAL",
        amountPaidCents: 0,
        orderDate: body.orderDate ? new Date(body.orderDate) : null,
        estimatedPickupAt: body.estimatedPickupAt ? new Date(body.estimatedPickupAt) : null
      }, session?.user.id),
      getStripeSettings()
    ]);
    return NextResponse.json({
      ...result,
      publishableKey: settings.publishableKey,
      mode: settings.mode
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start manual card payment." }, { status: 400 });
  }
}
