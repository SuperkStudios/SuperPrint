import { buildStripeCheckoutSuccessUrl, buildStripeProductLineItem, buildStripeShippingLineItem, isPaidStripeCheckoutSession, nextQueuePosition, resolveCheckoutSelection } from "@/domain/checkout";
import { prisma } from "@/lib/prisma";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { enqueuePrintJob } from "@/lib/queue-broker";
import { calculateProductPrice, createPricingSnapshot } from "@/services/pricing";
import { applyRewardRedemptionToOrder, awardOrderPoints, finalizeRewardRedemption, getRewardsSettings } from "@/services/rewards";
import { prepareCheckoutShipping, type CheckoutFulfillmentInput } from "@/services/shipping";
import { recordPlatformEvent } from "./events";

export async function createProductCheckout(input: { productId: string; customerId: string; customerEmail?: string | null; selectedFilamentMaterialId?: string | null; selectedMaterial?: string | null; selectedColor?: string | null; fulfillment: CheckoutFulfillmentInput }) {
  const product = await prisma.product.findFirstOrThrow({
    where: { id: input.productId, status: "ACTIVE" },
    include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } }
  });
  const selectedAllowed = input.selectedFilamentMaterialId
    ? product.allowedFilaments.find((item) => item.filamentMaterialId === input.selectedFilamentMaterialId)
    : product.allowedFilaments.find((item) => item.filamentMaterialId === product.defaultFilamentMaterialId) ?? product.allowedFilaments[0];
  if (!selectedAllowed) throw new Error("No enabled filament is available for this product.");
  const selection = resolveCheckoutSelection({ defaultMaterial: selectedAllowed.filamentMaterial.material }, {
    selectedMaterial: input.selectedMaterial ?? selectedAllowed.filamentMaterial.material,
    selectedColor: input.selectedColor ?? selectedAllowed.filamentMaterial.color
  });
  const quote = await calculateProductPrice({
    productId: product.id,
    filamentMaterialId: selectedAllowed.filamentMaterialId,
    quantity: 1,
    shippingRequired: false
  });
  if (quote.unavailableReason) throw new Error(quote.unavailableReason);
  if (quote.requiresAdminApproval) throw new Error("Selected filament requires approval before checkout.");
  const shipping = await prepareCheckoutShipping({
    product,
    productPriceCents: quote.finalCustomerPriceCents,
    quantity: 1,
    customerEmail: input.customerEmail,
    fulfillment: input.fulfillment
  });
  const rewardsSettings = await getRewardsSettings();
  const preRewardProductCents = quote.finalCustomerPriceCents;
  const preRewardTotalCents = preRewardProductCents + shipping.shippingAmountCents;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: `SP-${Date.now().toString().slice(-6)}`,
        customerId: input.customerId,
        productId: product.id,
        totalCents: preRewardTotalCents,
        status: "CHECKOUT_READY",
        paymentStatus: "PENDING",
        shippingStatus: shipping.method === "PICKUP" ? "PICKUP" : "QUOTE_READY",
        fulfillmentMethod: shipping.method,
        shippingName: shipping.address.name,
        shippingStreet1: shipping.address.street1,
        shippingStreet2: shipping.address.street2,
        shippingCity: shipping.address.city,
        shippingState: shipping.address.state,
        shippingZip: shipping.address.zip,
        shippingCountry: shipping.address.country,
        shippingPhone: shipping.address.phone,
        shippingEmail: shipping.address.email,
        shippoShipmentId: shipping.shippoShipmentId,
        shippoRateId: shipping.rate?.object_id,
        shippingProvider: shipping.rate?.provider,
        shippingService: shipping.rate?.servicelevel?.name ?? shipping.rate?.servicelevel_name,
        shippingRateCents: shipping.shippingRateCents,
        shippingAmountCents: shipping.shippingAmountCents,
        selectedMaterial: selection.selectedMaterial as never,
        selectedColor: selection.selectedColor,
        selectedFilamentMaterialId: selectedAllowed.filamentMaterialId
      }
    });
    const reward = await applyRewardRedemptionToOrder({
      tx,
      userId: input.customerId,
      orderId: created.id,
      productSubtotalCents: preRewardProductCents,
      settings: rewardsSettings
    });
    if (!reward.discountCents) return created;
    return tx.order.update({
      where: { id: created.id },
      data: {
        totalCents: preRewardTotalCents - reward.discountCents,
        rewardPointsRedeemed: reward.pointsRedeemed,
        rewardDiscountCents: reward.discountCents
      }
    });
  });
  if (shipping.method === "SHIP") {
    await prisma.user.update({
      where: { id: input.customerId },
      data: {
        shippingName: shipping.address.name,
        shippingStreet1: shipping.address.street1,
        shippingStreet2: shipping.address.street2,
        shippingCity: shipping.address.city,
        shippingState: shipping.address.state,
        shippingZip: shipping.address.zip,
        shippingCountry: shipping.address.country,
        shippingPhone: shipping.address.phone
      }
    });
  }
  await createPricingSnapshot({
    orderId: order.id,
    quote: { ...quote, shippingCents: shipping.shippingAmountCents, finalCustomerPriceCents: order.totalCents },
    preRewardCustomerPriceCents: preRewardTotalCents,
    rewardDiscountCents: order.rewardDiscountCents
  });

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId: input.customerId,
    payload: {
      orderNumber: order.orderNumber,
      customerEmail: input.customerEmail,
      productName: product.name,
      material: selection.selectedMaterial,
      color: selection.selectedColor,
      priceCents: order.totalCents,
      rewardDiscountCents: order.rewardDiscountCents,
      rewardPointsRedeemed: order.rewardPointsRedeemed,
      fulfillmentMethod: shipping.method,
      shippingCents: shipping.shippingAmountCents,
      shippingProvider: shipping.rate?.provider,
      shippingService: shipping.rate?.servicelevel?.name ?? shipping.rate?.servicelevel_name
    }
  });

  const stripe = await getStripe();
  if (!stripe) {
    return {
      order,
      checkoutUrl: `/api/orders/${order.id}/demo-pay`,
      stripeConfigured: false
    };
  }

  const baseUrl = getStripeBaseUrl();
  const productLineItem = buildStripeProductLineItem({ ...product, priceCents: preRewardProductCents - order.rewardDiscountCents });
  const shippingLineItem = buildStripeShippingLineItem({
    amountCents: shipping.shippingAmountCents,
    description: shipping.rate ? `${shipping.rate.provider ?? "Carrier"} ${shipping.rate.servicelevel?.name ?? shipping.rate.servicelevel_name ?? "shipping"}` : "Free local pickup"
  });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.customerEmail ?? undefined,
    line_items: shippingLineItem ? [productLineItem, shippingLineItem] : [productLineItem],
    ...(order.rewardPointsRedeemed > 0 ? { expires_at: Math.floor(Date.now() / 1000) + Math.min(1440, Math.max(30, rewardsSettings.reservationTtlMinutes)) * 60 } : {}),
    metadata: {
      orderId: order.id,
      productId: product.id,
      selectedMaterial: selection.selectedMaterial,
      selectedColor: selection.selectedColor ?? "",
      selectedFilamentMaterialId: selectedAllowed.filamentMaterialId,
      fulfillmentMethod: shipping.method,
      rewardPointsRedeemed: String(order.rewardPointsRedeemed),
      rewardDiscountCents: String(order.rewardDiscountCents)
    },
    success_url: buildStripeCheckoutSuccessUrl(baseUrl, order.id),
    cancel_url: `${baseUrl}/store?checkout=cancelled`
  });

  return {
    order,
    checkoutUrl: session.url,
    stripeConfigured: true
  };
}

export async function reconcilePaidStripeCheckoutSession(input: { sessionId?: string | null; orderId?: string | null; actorId?: string }) {
  if (!input.sessionId || !input.orderId) return null;
  const stripe = await getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.retrieve(input.sessionId);
  if (!isPaidStripeCheckoutSession(session, input.orderId)) return null;
  return markOrderPaidAndQueue(input.orderId, input.actorId);
}

export async function markOrderPaidAndQueue(orderId: string, actorId?: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { product: { include: { allowedFilaments: true } }, printJobs: true, pricingSnapshot: true }
  });
  if (!order.product) throw new Error("Only product orders can be queued automatically");
  const rewardsSettings = await getRewardsSettings();
  if (order.printJobs.length) {
    await prisma.$transaction(async (tx) => {
      await finalizeRewardRedemption({ tx, orderId, userId: order.customerId });
      await awardOrderPoints({
        tx,
        orderId,
        userId: order.customerId,
        paidProductSubtotalCents: paidProductSubtotalCents(order, rewardsSettings.earnOnDiscountedAmount),
        shippingCents: order.shippingAmountCents,
        settings: rewardsSettings
      });
    });
    return order;
  }

  const queueJobs = await prisma.printJob.findMany({
    where: { status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START", "PRINTING", "PAUSED"] } },
    select: { queuePosition: true }
  });
  const position = nextQueuePosition(queueJobs.map((job) => job.queuePosition));
  const selectedAllowed = order.selectedFilamentMaterialId
    ? order.product.allowedFilaments.find((item) => item.filamentMaterialId === order.selectedFilamentMaterialId)
    : null;
  const reservedGrams = selectedAllowed?.estimatedGramsOverride ?? order.product.estimatedGrams;
  const spool = await prisma.filamentSpool.findFirst({
    where: {
      id: order.selectedFilamentMaterialId ?? undefined,
      material: (order.selectedMaterial ?? order.product.defaultMaterial) as never,
      ...(order.selectedColor ? { color: order.selectedColor } : {}),
      remainingGrams: { gt: reservedGrams }
    },
    orderBy: { remainingGrams: "asc" }
  }) ?? await prisma.filamentSpool.findFirst({
    where: {
      material: (order.selectedMaterial ?? order.product.defaultMaterial) as never,
      remainingGrams: { gt: reservedGrams }
    },
    orderBy: { remainingGrams: "asc" }
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (spool) {
      await tx.filamentSpool.update({
        where: { id: spool.id },
        data: { remainingGrams: { decrement: reservedGrams } }
      });
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "QUEUED",
        paymentStatus: "PAID",
        printJobs: {
          create: {
            etaMinutes: selectedAllowed?.estimatedPrintMinutesOverride ?? order.product!.estimatedPrintMinutes,
            queuePosition: position,
            status: "QUEUED",
            streamUrl: "/api/printer-feed/stream",
            filamentId: spool?.id,
            reservedFilamentGrams: reservedGrams
          }
        }
      },
      include: { product: true, printJobs: true }
    });
  });

  await prisma.$transaction(async (tx) => {
    await finalizeRewardRedemption({ tx, orderId, userId: order.customerId });
    await awardOrderPoints({
      tx,
      orderId,
      userId: order.customerId,
      paidProductSubtotalCents: paidProductSubtotalCents(order, rewardsSettings.earnOnDiscountedAmount),
      shippingCents: order.shippingAmountCents,
      settings: rewardsSettings
    });
  });

  await recordPlatformEvent({
    type: "QUEUE_ADMITTED",
    actorId,
    payload: {
      orderNumber: updated.orderNumber,
      productName: updated.product?.name,
      material: order.selectedMaterial ?? order.product.defaultMaterial,
      color: order.selectedColor,
      queuePosition: position,
      reservedGrams,
      filamentReserved: Boolean(spool),
      operatorGate: "Physical start still requires admin checklist"
    }
  });

  const printJobId = updated.printJobs[0]?.id;
  if (printJobId) {
    await enqueuePrintJob(printJobId);
  }

  return updated;
}

function paidProductSubtotalCents(order: { totalCents: number; shippingAmountCents: number; rewardDiscountCents: number }, earnOnDiscountedAmount: boolean) {
  const paidProductCents = Math.max(0, order.totalCents - order.shippingAmountCents);
  return earnOnDiscountedAmount ? paidProductCents : paidProductCents + order.rewardDiscountCents;
}
