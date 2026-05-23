import { Prisma } from "@prisma/client";
import { nextQueuePosition } from "@/domain/checkout";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getOrCreateStripeCustomerId, markOrderPaidAndQueue } from "@/services/checkout";
import { recordPlatformEvent } from "@/services/events";
import type { CheckoutFulfillmentInput } from "@/services/shipping";

const paidMethods = new Set(["CASH", "STRIPE_TERMINAL", "STRIPE_MANUAL", "STRIPE_LINK", "OTHER"]);

type InPersonOrderLineInput = {
  productId: string;
  quantity: number;
  unitPriceCents?: number | null;
  selectedFilamentMaterialIds?: string[];
  selectedColors?: string[];
};

export type CreateInPersonOrderInput = {
  customerName: string;
  customerEmail: string;
  lines: InPersonOrderLineInput[];
  paymentMethod: string;
  amountPaidCents: number;
  depositCents?: number;
  paymentReference?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  internalNotes?: string | null;
  orderDate?: Date | null;
  source?: "IN_PERSON" | "PAST_IMPORT";
  queueNow?: boolean;
  fulfillment?: CheckoutFulfillmentInput;
  estimatedPickupAt?: Date | null;
  shippingAmountCents?: number;
  shippingRateCents?: number;
  shippoRateId?: string | null;
  shippoShipmentId?: string | null;
};

export type TerminalOrderInput = CreateInPersonOrderInput & {
  savePaymentMethod?: boolean;
};

export type ManualCardOrderInput = TerminalOrderInput;

export async function createInPersonOrder(input: CreateInPersonOrderInput, actorId?: string) {
  if (!input.lines.length) throw new Error("Add at least one product.");
  const email = input.customerEmail.trim().toLowerCase();
  if (!email) throw new Error("Customer email is required.");

  const products = await prisma.product.findMany({
    where: { id: { in: input.lines.map((line) => line.productId) } },
    include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } }
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const normalizedLines = input.lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) throw new Error("One of the selected products no longer exists.");
    const quantity = Math.max(1, Math.floor(line.quantity || 1));
    const slotCount = Math.max(1, Math.min(6, product.colorSlotCount ?? 1));
    const selectedIds = Array.from({ length: slotCount }, (_, index) => {
      const id = line.selectedFilamentMaterialIds?.[index] ?? line.selectedFilamentMaterialIds?.[0] ?? product.defaultFilamentMaterialId ?? product.allowedFilaments[0]?.filamentMaterialId;
      return id ?? "";
    }).filter(Boolean);
    const selectedColors = Array.from({ length: slotCount }, (_, index) => {
      const allowed = product.allowedFilaments.find((item) => item.filamentMaterialId === selectedIds[index]);
      return line.selectedColors?.[index] ?? line.selectedColors?.[0] ?? allowed?.filamentMaterial.color ?? "";
    }).filter(Boolean);
    const firstAllowed = product.allowedFilaments.find((item) => item.filamentMaterialId === selectedIds[0]) ?? product.allowedFilaments[0];
    const unitPriceCents = Math.max(0, Math.round(line.unitPriceCents ?? product.priceCents));
    return {
      product,
      quantity,
      selectedIds,
      selectedColors,
      selectedMaterial: firstAllowed?.filamentMaterial.material ?? product.defaultMaterial,
      selectedColor: selectedColors[0] ?? firstAllowed?.filamentMaterial.color ?? null,
      selectedFilamentMaterialId: selectedIds[0] ?? null,
      unitPriceCents,
      subtotalCents: unitPriceCents * quantity
    };
  });

  const subtotalCents = normalizedLines.reduce((total, line) => total + line.subtotalCents, 0);
  const fulfillmentMethod = input.fulfillment?.method ?? "PICKUP";
  const shippingAmountCents = fulfillmentMethod === "SHIP" ? Math.max(0, Math.round(input.shippingAmountCents ?? 0)) : 0;
  const shippingRateCents = fulfillmentMethod === "SHIP" ? Math.max(0, Math.round(input.shippingRateCents ?? shippingAmountCents)) : 0;
  const shippingAddress = input.fulfillment?.address;
  const amountPaidCents = Math.max(0, Math.round(input.amountPaidCents || 0));
  const depositCents = Math.max(0, Math.round(input.depositCents ?? amountPaidCents));
  const totalCents = subtotalCents + shippingAmountCents;
  const balanceDueCents = Math.max(0, totalCents - amountPaidCents);
  const paymentMethod = input.paymentMethod || "UNPAID";
  const paymentStatus = balanceDueCents <= 0 && paidMethods.has(paymentMethod) ? "PAID" : amountPaidCents > 0 ? "PARTIAL" : "PENDING";
  const status = paymentStatus === "PAID" ? "PAID" : "CHECKOUT_READY";

  const order = await prisma.$transaction(async (tx) => {
    const customer = await tx.user.upsert({
      where: { email },
      update: { name: input.customerName.trim() || email },
      create: {
        email,
        name: input.customerName.trim() || email,
        emailVerified: true
      }
    });

    const created = await tx.order.create({
      data: {
        orderNumber: `SP-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        productId: normalizedLines[0]?.product.id,
        subtotalCents,
        totalCents,
        paymentStatus,
        paymentMethod,
        paymentSource: paymentMethod.startsWith("STRIPE") ? "STRIPE" : paymentMethod,
        amountPaidCents,
        depositCents,
        balanceDueCents,
        paymentReference: input.paymentReference?.trim() || null,
        cardBrand: input.cardBrand?.trim() || null,
        cardLast4: input.cardLast4?.trim() || null,
        paidAt: paymentStatus === "PAID" ? input.orderDate ?? new Date() : null,
        orderSource: input.source ?? "IN_PERSON",
        internalNotes: [input.internalNotes?.trim(), input.estimatedPickupAt ? `Estimated pickup: ${input.estimatedPickupAt.toISOString()}` : null].filter(Boolean).join("\n") || null,
        status,
        fulfillmentMethod,
        shippingStatus: fulfillmentMethod === "SHIP" ? "NOT_STARTED" : "PICKUP",
        shippingName: shippingAddress?.name?.trim() || input.customerName.trim() || email,
        shippingStreet1: fulfillmentMethod === "SHIP" ? shippingAddress?.street1?.trim() || null : null,
        shippingStreet2: fulfillmentMethod === "SHIP" ? shippingAddress?.street2?.trim() || null : null,
        shippingCity: fulfillmentMethod === "SHIP" ? shippingAddress?.city?.trim() || null : shippingAddress?.city?.trim() || null,
        shippingState: fulfillmentMethod === "SHIP" ? shippingAddress?.state?.trim() || null : shippingAddress?.state?.trim() || null,
        shippingZip: fulfillmentMethod === "SHIP" ? shippingAddress?.zip?.trim() || null : shippingAddress?.zip?.trim() || null,
        shippingCountry: shippingAddress?.country?.trim() || "US",
        shippingPhone: shippingAddress?.phone?.trim() || null,
        shippingEmail: shippingAddress?.email?.trim() || email,
        shippingAmountCents,
        shippingRateCents,
        shippoRateId: input.shippoRateId ?? null,
        shippoShipmentId: input.shippoShipmentId ?? null,
        createdAt: input.orderDate ?? undefined,
        items: {
          create: normalizedLines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            subtotalCents: line.subtotalCents,
            totalCents: line.subtotalCents,
            estimatedGrams: line.product.estimatedGrams * line.quantity,
            estimatedPrintMinutes: line.product.estimatedPrintMinutes * line.quantity,
            selectedMaterial: line.selectedMaterial as never,
            selectedColor: line.selectedColor,
            selectedFilamentMaterialId: line.selectedFilamentMaterialId,
            selectedFilamentMaterialIds: line.selectedIds as unknown as Prisma.InputJsonArray,
            selectedColors: line.selectedColors as unknown as Prisma.InputJsonArray
          }))
        }
      },
      include: { customer: true, items: { include: { product: true } } }
    });

    if (input.queueNow && paymentStatus === "PAID") {
      await queueOrderJobs(tx, created.id, normalizedLines);
      return tx.order.update({ where: { id: created.id }, data: { status: "QUEUED" }, include: { customer: true, items: { include: { product: true } }, printJobs: true } });
    }

    return created;
  });

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId,
    payload: {
      orderNumber: order.orderNumber,
      customerEmail: email,
      source: input.source ?? "IN_PERSON",
      paymentMethod,
      paymentStatus,
      amountPaidCents,
      balanceDueCents
    }
  });

  await syncOrderCustomerToStripe(order.id, {
    required: paymentMethod.startsWith("STRIPE")
  });

  return order;
}

export async function createManualCardOrderPayment(input: ManualCardOrderInput, actorId?: string) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured. Add Stripe keys in admin settings first.");
  const order = await createInPersonOrder({
    ...input,
    paymentMethod: "STRIPE_MANUAL",
    amountPaidCents: 0,
    depositCents: 0,
    paymentReference: null,
    queueNow: false
  }, actorId);
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: order.customerId } });
  const stripeCustomerId = await getOrCreateStripeCustomerId({
    stripe,
    userId: customer.id,
    email: customer.email,
    name: customer.name,
    existingCustomerId: customer.stripeCustomerId
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: "usd",
    customer: stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    ...(input.savePaymentMethod === false ? {} : { setup_future_usage: "off_session" as const }),
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: customer.id,
      source: input.source ?? "IN_PERSON",
      channel: "admin_pos_manual"
    },
    receipt_email: customer.email,
    description: `SuperPrint ${order.orderNumber}`
  });
  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      paymentReference: paymentIntent.id,
      paymentSource: "STRIPE_MANUAL"
    }
  });
  return {
    order: { ...order, stripePaymentIntentId: paymentIntent.id, paymentReference: paymentIntent.id },
    clientSecret: paymentIntent.client_secret
  };
}

export async function completeManualCardOrderPayment(input: { orderId: string; paymentIntentId: string; queueNow?: boolean; actorId?: string }) {
  return completeStripePosPayment({
    ...input,
    paymentMethod: "STRIPE_MANUAL",
    paymentSource: "STRIPE_MANUAL"
  });
}

export async function createTerminalOrderPayment(input: TerminalOrderInput, actorId?: string) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured. Add Stripe keys in admin settings first.");
  const order = await createInPersonOrder({
    ...input,
    paymentMethod: "STRIPE_TERMINAL",
    amountPaidCents: 0,
    depositCents: 0,
    paymentReference: null,
    queueNow: false
  }, actorId);
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: order.customerId } });
  const stripeCustomerId = await getOrCreateStripeCustomerId({
    stripe,
    userId: customer.id,
    email: customer.email,
    name: customer.name,
    existingCustomerId: customer.stripeCustomerId
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: "usd",
    customer: stripeCustomerId,
    receipt_email: customer.email,
    payment_method_types: ["card_present"],
    ...(input.savePaymentMethod === false ? {} : { setup_future_usage: "off_session" as const }),
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: customer.id,
      source: input.source ?? "IN_PERSON"
    },
    description: `SuperPrint ${order.orderNumber}`
  });
  await prisma.order.update({
    where: { id: order.id },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      paymentReference: paymentIntent.id,
      paymentSource: "STRIPE_TERMINAL"
    }
  });
  return {
    order: { ...order, stripePaymentIntentId: paymentIntent.id, paymentReference: paymentIntent.id },
    clientSecret: paymentIntent.client_secret
  };
}

export async function completeTerminalOrderPayment(input: { orderId: string; paymentIntentId: string; queueNow?: boolean; actorId?: string }) {
  return completeStripePosPayment({
    ...input,
    paymentMethod: "STRIPE_TERMINAL",
    paymentSource: "STRIPE_TERMINAL"
  });
}

async function completeStripePosPayment(input: {
  orderId: string;
  paymentIntentId: string;
  paymentMethod: "STRIPE_TERMINAL" | "STRIPE_MANUAL";
  paymentSource: "STRIPE_TERMINAL" | "STRIPE_MANUAL";
  queueNow?: boolean;
  actorId?: string;
}) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId, {
    expand: ["latest_charge", "payment_method"]
  });
  if (intent.metadata?.orderId !== input.orderId) throw new Error("PaymentIntent does not belong to this order.");
  if (intent.status !== "succeeded") throw new Error(`Stripe payment is ${intent.status}.`);

  const paymentDetails = extractTerminalPaymentDetails(intent);
  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data: {
      status: "PAID",
      paymentStatus: "PAID",
      paymentMethod: input.paymentMethod,
      paymentSource: input.paymentSource,
      amountPaidCents: intent.amount_received || intent.amount,
      depositCents: intent.amount_received || intent.amount,
      balanceDueCents: 0,
      stripePaymentIntentId: intent.id,
      paymentReference: intent.id,
      cardBrand: paymentDetails.brand,
      cardLast4: paymentDetails.last4,
      paidAt: new Date()
    }
  });

  if (input.queueNow) {
    return markOrderPaidAndQueue(updated.id, input.actorId);
  }
  return updated;
}

async function syncOrderCustomerToStripe(orderId: string, options: { required: boolean }) {
  const stripe = await getStripe();
  if (!stripe) {
    if (options.required) throw new Error("Stripe is not configured. Add Stripe keys in admin settings first.");
    return null;
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true }
  });
  if (!order) return null;
  try {
    const stripeCustomerId = await getOrCreateStripeCustomerId({
      stripe,
      userId: order.customer.id,
      email: order.customer.email,
      name: order.customer.name,
      existingCustomerId: order.customer.stripeCustomerId
    });
    return stripeCustomerId;
  } catch (error) {
    if (options.required) throw error;
    console.warn("Could not sync POS customer to Stripe", error);
    return null;
  }
}

async function queueOrderJobs(tx: Prisma.TransactionClient, orderId: string, lines: Array<ReturnType<typeof normalizeQueuedLine>>) {
  const activeJobs = await tx.printJob.findMany({
    where: { status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"] } },
    select: { queuePosition: true }
  });
  let queuePosition = nextQueuePosition(activeJobs.map((job) => job.queuePosition));
  for (const line of lines) {
    const slotCount = Math.max(1, Math.min(6, line.product.colorSlotCount ?? 1));
    for (let unitIndex = 0; unitIndex < line.quantity; unitIndex += 1) {
      for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
        const selectedAllowed = line.product.allowedFilaments.find((item) => item.filamentMaterialId === line.selectedIds[slotIndex]);
        const reservedGrams = Math.max(1, Math.ceil((selectedAllowed?.estimatedGramsOverride ?? line.product.estimatedGrams) / slotCount));
        const spool = await tx.filamentSpool.findFirst({
          where: {
            id: line.selectedIds[slotIndex] || undefined,
            material: (selectedAllowed?.filamentMaterial?.material ?? line.selectedMaterial ?? line.product.defaultMaterial) as never,
            ...(line.selectedColors[slotIndex] ? { color: line.selectedColors[slotIndex] } : {}),
            remainingGrams: { gt: reservedGrams }
          },
          orderBy: { remainingGrams: "asc" }
        });
        if (spool) {
          await tx.filamentSpool.update({ where: { id: spool.id }, data: { remainingGrams: { decrement: reservedGrams } } });
        }
        await tx.printJob.create({
          data: {
            orderId,
            status: "QUEUED",
            queuePosition,
            etaMinutes: Math.max(1, Math.ceil((selectedAllowed?.estimatedPrintMinutesOverride ?? line.product.estimatedPrintMinutes) / slotCount)),
            streamUrl: "/api/printer-feed/stream",
            filamentId: spool?.id,
            reservedFilamentGrams: reservedGrams,
            assignmentBlockedReason: slotCount > 1 ? `Color ${slotIndex + 1} of ${slotCount}` : undefined
          }
        });
        queuePosition += 1;
      }
    }
  }
}

function normalizeQueuedLine(line: {
  product: Awaited<ReturnType<typeof prisma.product.findMany>>[number] & { allowedFilaments: Array<{ filamentMaterialId: string; estimatedGramsOverride: number | null; estimatedPrintMinutesOverride: number | null; filamentMaterial?: { material: string } }> };
  quantity: number;
  selectedIds: string[];
  selectedColors: string[];
  selectedMaterial: string;
}) {
  return line;
}

function extractTerminalPaymentDetails(intent: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof getStripe>>>["paymentIntents"]["retrieve"]>>) {
  const paymentMethod = typeof intent.payment_method === "object" && intent.payment_method ? intent.payment_method : null;
  const paymentMethodAny = paymentMethod as null | { card_present?: { brand?: string; last4?: string }; card?: { brand?: string; last4?: string } };
  const charge = typeof intent.latest_charge === "object" && intent.latest_charge ? intent.latest_charge : null;
  const chargeAny = charge as null | {
    payment_method_details?: {
      card_present?: { brand?: string; last4?: string };
      card?: { brand?: string; last4?: string };
    };
  };
  const details =
    paymentMethodAny?.card_present ??
    paymentMethodAny?.card ??
    chargeAny?.payment_method_details?.card_present ??
    chargeAny?.payment_method_details?.card;
  return {
    brand: details?.brand ?? null,
    last4: details?.last4 ?? null
  };
}
