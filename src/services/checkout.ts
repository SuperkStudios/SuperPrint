import { buildStripeProductLineItem, nextQueuePosition } from "@/domain/checkout";
import { prisma } from "@/lib/prisma";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { recordPlatformEvent } from "./events";

export async function createProductCheckout(input: { productId: string; customerId: string; customerEmail?: string | null }) {
  const product = await prisma.product.findFirstOrThrow({
    where: { id: input.productId, status: "ACTIVE" }
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `SP-${Date.now().toString().slice(-6)}`,
      customerId: input.customerId,
      productId: product.id,
      totalCents: product.priceCents,
      status: "CHECKOUT_READY",
      paymentStatus: "PENDING"
    }
  });

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId: input.customerId,
    payload: { orderNumber: order.orderNumber, customerEmail: input.customerEmail, productName: product.name }
  });

  const stripe = getStripe();
  if (!stripe) {
    return {
      order,
      checkoutUrl: `/api/orders/${order.id}/demo-pay`,
      stripeConfigured: false
    };
  }

  const baseUrl = getStripeBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail ?? undefined,
    line_items: [buildStripeProductLineItem(product)],
    metadata: {
      orderId: order.id,
      productId: product.id
    },
    success_url: `${baseUrl}/orders?checkout=success&order=${order.id}`,
    cancel_url: `${baseUrl}/store?checkout=cancelled`
  });

  return {
    order,
    checkoutUrl: session.url,
    stripeConfigured: true
  };
}

export async function markOrderPaidAndQueue(orderId: string, actorId?: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { product: true, printJobs: true }
  });
  if (!order.product) throw new Error("Only product orders can be queued automatically");
  if (order.printJobs.length) return order;

  const queueJobs = await prisma.printJob.findMany({
    where: { status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"] } },
    select: { queuePosition: true }
  });
  const position = nextQueuePosition(queueJobs.map((job) => job.queuePosition));
  const spool = await prisma.filamentSpool.findFirst({
    where: {
      material: order.product.defaultMaterial,
      remainingGrams: { gt: order.product.estimatedGrams }
    },
    orderBy: { remainingGrams: "asc" }
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (spool) {
      await tx.filamentSpool.update({
        where: { id: spool.id },
        data: { remainingGrams: { decrement: order.product!.estimatedGrams } }
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "QUEUED",
        paymentStatus: "PAID",
        printJobs: {
          create: {
            etaMinutes: order.product!.estimatedPrintMinutes,
            queuePosition: position,
            status: "QUEUED",
            streamUrl: "/api/printer-feed/stream",
            filamentId: spool?.id,
            reservedFilamentGrams: order.product!.estimatedGrams
          }
        }
      },
      include: { product: true, printJobs: true }
    });
  });

  await recordPlatformEvent({
    type: "QUEUE_ADMITTED",
    actorId,
    payload: {
      orderNumber: updated.orderNumber,
      productName: updated.product?.name,
      queuePosition: position,
      reservedGrams: updated.product?.estimatedGrams,
      filamentReserved: Boolean(spool),
      operatorGate: "Physical start still requires admin checklist"
    }
  });

  return updated;
}
