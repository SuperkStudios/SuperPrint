import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { createInPersonOrder } from "@/services/in-person-orders";

const lineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(500),
  printedQuantity: z.number().int().min(0).max(500).optional().default(0),
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

const printerHistorySchema = z.object({
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
  customerName: z.string().trim().optional().default(""),
  customerEmail: z.string().trim().optional().default(""),
  lines: z.array(lineSchema).min(1),
  paymentMethod: z.enum(["UNPAID", "CASH", "STRIPE_TERMINAL", "STRIPE_MANUAL", "STRIPE_LINK", "OTHER"]),
  amountPaidCents: z.number().int().nonnegative(),
  depositCents: z.number().int().nonnegative().optional(),
  paymentReference: z.string().optional().nullable(),
  cardBrand: z.string().optional().nullable(),
  cardLast4: z.string().regex(/^\d{0,4}$/).optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  orderDate: z.string().optional().nullable(),
  source: z.enum(["IN_PERSON", "BACKLOG_IMPORT", "PAST_IMPORT"]).default("IN_PERSON"),
  queueNow: z.boolean().default(false),
  estimatedPickupAt: z.string().optional().nullable(),
  fulfillment: z.object({
    method: z.enum(["SHIP", "PICKUP"]),
    address: addressSchema.optional().nullable()
  }).optional(),
  shippingAmountCents: z.number().int().nonnegative().optional(),
  shippingRateCents: z.number().int().nonnegative().optional(),
  shippoRateId: z.string().optional().nullable(),
  shippoShipmentId: z.string().optional().nullable(),
  pastPrinterHistory: printerHistorySchema.optional().nullable(),
  pastHistorySpoolId: z.string().optional().nullable()
}).superRefine((value, context) => {
  if (value.customerEmail && !z.string().email().safeParse(value.customerEmail).success) {
    context.addIssue({ code: "custom", path: ["customerEmail"], message: "Email must be valid when provided." });
  }
  value.lines.forEach((line, index) => {
    if ((line.printedQuantity ?? 0) > line.quantity) {
      context.addIssue({ code: "custom", path: ["lines", index, "printedQuantity"], message: "Already printed cannot be greater than quantity." });
    }
  });
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("orders");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    const order = await createInPersonOrder({
      ...body,
      orderDate: body.orderDate ? new Date(body.orderDate) : null,
      estimatedPickupAt: body.estimatedPickupAt ? new Date(body.estimatedPickupAt) : null
    }, session?.user.id);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create in-person order." }, { status: 400 });
  }
}
