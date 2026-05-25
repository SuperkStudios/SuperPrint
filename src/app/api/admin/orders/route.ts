import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buyLabelForOrder, markOrderShippedWithShippoTracking, printOrderLabel } from "@/services/shipping";
import { sendOrderEmail } from "@/services/email";

const orderActionSchema = z.object({
  orderId: z.string(),
  action: z.enum([
    "markPacking",
    "markShipped",
    "markDelivered",
    "markPaidCash",
    "markPaidCashDelivered",
    "markPaidReference",
    "markPaidReferenceDelivered",
    "buyLabel",
    "printLabel",
    "buyAndPrintLabel"
  ]),
  paymentReference: z.string().optional().nullable()
});

const shippingStatusByAction = {
  markPacking: "PACKING",
  markShipped: "SHIPPED",
  markDelivered: "DELIVERED"
} as const;

export async function GET() {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const orders = await prisma.order.findMany({
    include: { customer: true, product: true, upload: true, items: true, printJobs: { include: { filament: true, printer: true } } },
    orderBy: { updatedAt: "desc" }
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const body = orderActionSchema.parse(await request.json());
  if (body.action === "buyLabel") {
    const order = await buyLabelForOrder(body.orderId);
    return NextResponse.json({ order });
  }
  if (body.action === "printLabel") {
    const order = await printOrderLabel(body.orderId);
    return NextResponse.json({ order });
  }
  if (body.action === "buyAndPrintLabel") {
    const order = await buyLabelForOrder(body.orderId, { print: true });
    return NextResponse.json({ order });
  }
  if (body.action === "markShipped") {
    const order = await markOrderShippedWithShippoTracking(body.orderId);
    void sendOrderEmail("order-shipped", order.id).catch((error) => {
      console.error("Could not send shipped email", error);
    });
    return NextResponse.json({ order });
  }
  if (body.action === "markPaidCash" || body.action === "markPaidCashDelivered") {
    const order = await markOrderPaid(body.orderId, {
      method: "CASH",
      reference: body.paymentReference?.trim() || "Cash on delivery",
      delivered: body.action === "markPaidCashDelivered"
    });
    return NextResponse.json({ order });
  }
  if (body.action === "markPaidReference" || body.action === "markPaidReferenceDelivered") {
    const reference = body.paymentReference?.trim();
    if (!reference) {
      return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });
    }
    const order = await markOrderPaid(body.orderId, {
      method: "STRIPE_MANUAL",
      reference,
      delivered: body.action === "markPaidReferenceDelivered"
    });
    return NextResponse.json({ order });
  }
  if (body.action === "markDelivered") {
    const existing = await prisma.order.findUniqueOrThrow({
      where: { id: body.orderId },
      select: { paymentStatus: true, balanceDueCents: true, totalCents: true, amountPaidCents: true }
    });
    const balanceDue = existing.balanceDueCents || Math.max(0, existing.totalCents - existing.amountPaidCents);
    if (existing.paymentStatus !== "PAID" || balanceDue > 0) {
      return NextResponse.json({ error: "Collect or record payment before marking delivered." }, { status: 400 });
    }
  }
  const shippingStatus = shippingStatusByAction[body.action as keyof typeof shippingStatusByAction];
  const order = await prisma.order.update({
    where: { id: body.orderId },
    data: { shippingStatus }
  });
  if (body.action === "markPacking" && order.fulfillmentMethod === "PICKUP") {
    void sendOrderEmail("order-ready-pickup", order.id).catch((error) => {
      console.error("Could not send pickup ready email", error);
    });
  }
  return NextResponse.json({ order });
}

async function markOrderPaid(orderId: string, input: { method: string; reference: string; delivered: boolean }) {
  const existing = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { totalCents: true, amountPaidCents: true }
  });
  const paidCents = Math.max(existing.totalCents, existing.amountPaidCents);
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: input.delivered ? "COMPLETED" : "PAID",
      paymentStatus: "PAID",
      paymentMethod: input.method,
      paymentSource: input.method.startsWith("STRIPE") ? "STRIPE" : input.method,
      amountPaidCents: paidCents,
      depositCents: paidCents,
      balanceDueCents: 0,
      paymentReference: input.reference,
      paidAt: new Date(),
      shippingStatus: input.delivered ? "DELIVERED" : undefined
    }
  });
}
