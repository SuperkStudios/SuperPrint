import { buildStripeCheckoutSuccessUrl, buildStripeProductLineItem, buildStripeShippingLineItem, isPaidStripeCheckoutSession, nextQueuePosition, resolveCheckoutSelection } from "@/domain/checkout";
import { prisma } from "@/lib/prisma";
import { getStripe, getStripeBaseUrl, getStripeSettings } from "@/lib/stripe";
import { enqueuePrintJob } from "@/lib/queue-broker";
import { calculateProductPrice, createPricingSnapshot } from "@/services/pricing";
import { applyRewardRedemptionToOrder, awardOrderPoints, finalizeRewardRedemption, getRewardsSettings } from "@/services/rewards";
import { prepareCheckoutShipping, type CheckoutFulfillmentInput } from "@/services/shipping";
import { clearActiveCart, summarizeCart, type CartFulfillment } from "@/services/cart";
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
      },
      include: { items: true }
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

export async function createCartPaymentIntent(input: {
  customerId: string;
  customerEmail?: string | null;
  fulfillment: CartFulfillment;
  savePaymentMethod?: boolean;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.customerId } });
  const preShippingSummary = await summarizeCart(input.customerId);
  if (!preShippingSummary.items.length) throw new Error("Your cart is empty.");
  const aggregate = aggregateCartForShipping(preShippingSummary.items);
  const shipping = await prepareCheckoutShipping({
    product: aggregate,
    productPriceCents: preShippingSummary.subtotalCents,
    quantity: 1,
    customerEmail: input.customerEmail,
    fulfillment: input.fulfillment as CheckoutFulfillmentInput
  });
  const [stripe, stripeSettings] = await Promise.all([getStripe(), getStripeSettings()]);
  if (!stripe || !stripeSettings.publishableKey) {
    throw new Error("Stripe payments are not configured. Add the Stripe secret key and publishable key in admin settings before accepting checkout payments.");
  }
  const rewardsSettings = await getRewardsSettings();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: `SP-${Date.now().toString().slice(-6)}`,
        customerId: input.customerId,
        productId: preShippingSummary.items[0]?.productId,
        subtotalCents: preShippingSummary.subtotalCents,
        totalCents: preShippingSummary.subtotalCents + shipping.shippingAmountCents,
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
        selectedMaterial: preShippingSummary.items[0]?.selectedMaterial as never,
        selectedColor: preShippingSummary.items[0]?.selectedColor,
        selectedFilamentMaterialId: preShippingSummary.items[0]?.selectedFilamentMaterialId,
        items: {
          create: preShippingSummary.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            subtotalCents: item.subtotalCents,
            taxCents: 0,
            paymentFeeCents: 0,
            totalCents: item.subtotalCents,
            estimatedGrams: item.estimatedGrams,
            estimatedPrintMinutes: item.estimatedPrintMinutes,
            selectedMaterial: item.selectedMaterial as never,
            selectedColor: item.selectedColor,
            selectedFilamentMaterialId: item.selectedFilamentMaterialId
          }))
        }
      }
    });
    const reward = await applyRewardRedemptionToOrder({
      tx,
      userId: input.customerId,
      orderId: created.id,
      productSubtotalCents: preShippingSummary.subtotalCents,
      settings: rewardsSettings
    });
    const finalSummary = await summarizeCart(input.customerId, {
      shippingCents: shipping.shippingAmountCents,
      rewardDiscountCents: reward.discountCents
    });
    return tx.order.update({
      where: { id: created.id },
      data: {
        subtotalCents: finalSummary.subtotalCents,
        taxCents: finalSummary.taxCents,
        paymentFeeCents: finalSummary.paymentFeeCents,
        totalCents: finalSummary.totalCents,
        rewardPointsRedeemed: reward.pointsRedeemed,
        rewardDiscountCents: reward.discountCents
      }
    });
  });

  const summary = await summarizeCart(input.customerId, {
    shippingCents: shipping.shippingAmountCents,
    rewardDiscountCents: order.rewardDiscountCents
  });
  await prisma.order.update({
    where: { id: order.id },
    data: {
      items: {
        updateMany: summary.items.map((item) => ({
          where: { productId: item.productId, selectedFilamentMaterialId: item.selectedFilamentMaterialId },
          data: {
            taxCents: Math.round(summary.taxCents * (item.subtotalCents / Math.max(1, summary.subtotalCents))),
            paymentFeeCents: Math.round(summary.paymentFeeCents * (item.subtotalCents / Math.max(1, summary.subtotalCents))),
            totalCents: item.subtotalCents
          }
        }))
      }
    }
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

  await recordPlatformEvent({
    type: "ORDER_CREATED",
    actorId: input.customerId,
    payload: {
      orderNumber: order.orderNumber,
      customerEmail: input.customerEmail,
      itemCount: summary.itemCount,
      subtotalCents: summary.subtotalCents,
      taxCents: summary.taxCents,
      shippingCents: summary.shippingCents,
      paymentFeeCents: summary.paymentFeeCents,
      priceCents: summary.totalCents,
      fulfillmentMethod: shipping.method
    }
  });

  const stripeCustomerId = await getOrCreateStripeCustomerId({
    stripe,
    userId: input.customerId,
    email: input.customerEmail ?? user.email,
    name: user.name,
    existingCustomerId: user.stripeCustomerId
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: summary.totalCents,
    currency: "usd",
    customer: stripeCustomerId,
    automatic_payment_methods: { enabled: true },
    ...(input.savePaymentMethod ? { setup_future_usage: "off_session" as const } : {}),
    metadata: {
      orderId: order.id,
      customerId: input.customerId,
      itemCount: String(summary.itemCount),
      fulfillmentMethod: shipping.method
    },
    receipt_email: input.customerEmail ?? user.email
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: paymentIntent.id }
  });
  return {
    order,
    summary,
    clientSecret: paymentIntent.client_secret,
    publishableKey: stripeSettings.publishableKey,
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

export async function reconcilePaidPaymentIntent(input: { paymentIntentId?: string | null; actorId?: string }) {
  if (!input.paymentIntentId) return null;
  const stripe = await getStripe();
  if (!stripe) return null;
  const intent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
  const orderId = intent.metadata?.orderId;
  if (!orderId || intent.status !== "succeeded") return null;
  return markOrderPaidAndQueue(orderId, input.actorId);
}

export async function markOrderPaidAndQueue(orderId: string, actorId?: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      product: { include: { allowedFilaments: true } },
      items: { include: { product: { include: { allowedFilaments: true } } } },
      printJobs: true
    }
  });
  const purchasableItems = order.items.length
    ? order.items
    : order.product
      ? [{
          id: "legacy",
          productId: order.product.id,
          product: order.product,
          quantity: 1,
          selectedFilamentMaterialId: order.selectedFilamentMaterialId,
          selectedMaterial: order.selectedMaterial,
          selectedColor: order.selectedColor,
          estimatedGrams: order.product.estimatedGrams,
          estimatedPrintMinutes: order.product.estimatedPrintMinutes
        }]
      : [];
  if (!purchasableItems.length) throw new Error("Only product orders can be queued automatically");
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
  let nextPosition = nextQueuePosition(queueJobs.map((job) => job.queuePosition));
  const jobPlans: Array<{
    item: (typeof purchasableItems)[number];
    selectedAllowed: ((typeof purchasableItems)[number]["product"]["allowedFilaments"][number]) | null;
    reservedGrams: number;
    spool: Awaited<ReturnType<typeof prisma.filamentSpool.findFirst>>;
    queuePosition: number;
  }> = [];
  for (const item of purchasableItems) {
    const selectedAllowed = item.selectedFilamentMaterialId
      ? item.product.allowedFilaments.find((allowed) => allowed.filamentMaterialId === item.selectedFilamentMaterialId)
      : null;
    const reservedGrams = selectedAllowed?.estimatedGramsOverride ?? item.estimatedGrams ?? item.product.estimatedGrams;
    const spool = await prisma.filamentSpool.findFirst({
      where: {
        id: item.selectedFilamentMaterialId ?? undefined,
        material: (item.selectedMaterial ?? item.product.defaultMaterial) as never,
        ...(item.selectedColor ? { color: item.selectedColor } : {}),
        remainingGrams: { gt: reservedGrams }
      },
      orderBy: { remainingGrams: "asc" }
    }) ?? await prisma.filamentSpool.findFirst({
      where: {
        material: (item.selectedMaterial ?? item.product.defaultMaterial) as never,
        remainingGrams: { gt: reservedGrams }
      },
      orderBy: { remainingGrams: "asc" }
    });
    for (let index = 0; index < item.quantity; index += 1) {
      jobPlans.push({
        item,
        selectedAllowed: selectedAllowed ?? null,
        reservedGrams,
        spool,
        queuePosition: nextPosition
      });
      nextPosition += 1;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const plan of jobPlans) {
      if (plan.spool) {
        await tx.filamentSpool.update({
          where: { id: plan.spool.id },
          data: { remainingGrams: { decrement: plan.reservedGrams } }
        });
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "QUEUED",
        paymentStatus: "PAID",
        printJobs: {
          create: jobPlans.map((plan) => ({
            etaMinutes: plan.selectedAllowed?.estimatedPrintMinutesOverride ?? plan.item.estimatedPrintMinutes ?? plan.item.product.estimatedPrintMinutes,
            queuePosition: plan.queuePosition,
            status: "QUEUED",
            streamUrl: "/api/printer-feed/stream",
            filamentId: plan.spool?.id,
            reservedFilamentGrams: plan.reservedGrams
          }))
        }
      },
      include: { product: true, items: { include: { product: true } }, printJobs: true }
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
    await clearActiveCart(order.customerId, tx);
  });

  await recordPlatformEvent({
    type: "QUEUE_ADMITTED",
    actorId,
    payload: {
      orderNumber: updated.orderNumber,
      productName: updated.items.length > 1 ? `${updated.items.length} cart lines` : updated.product?.name ?? updated.items[0]?.product.name,
      itemCount: jobPlans.length,
      queuePosition: jobPlans[0]?.queuePosition,
      reservedGrams: jobPlans.reduce((total, plan) => total + plan.reservedGrams, 0),
      filamentReserved: jobPlans.some((plan) => Boolean(plan.spool)),
      operatorGate: "Physical start still requires admin checklist"
    }
  });

  for (const job of updated.printJobs) {
    await enqueuePrintJob(job.id);
  }

  return updated;
}

function paidProductSubtotalCents(order: { totalCents: number; shippingAmountCents: number; rewardDiscountCents: number }, earnOnDiscountedAmount: boolean) {
  const paidProductCents = Math.max(0, order.totalCents - order.shippingAmountCents);
  return earnOnDiscountedAmount ? paidProductCents : paidProductCents + order.rewardDiscountCents;
}

function aggregateCartForShipping(items: Array<{
  name: string;
  quantity: number;
  estimatedGrams: number;
  quote: { productId: string };
}>) {
  return {
    name: items.length === 1 ? items[0].name : `SuperPrint order (${items.reduce((total, item) => total + item.quantity, 0)} items)`,
    estimatedGrams: items.reduce((total, item) => total + item.estimatedGrams * item.quantity, 0),
    shippingPackageLengthIn: 8,
    shippingPackageWidthIn: 4,
    shippingPackageHeightIn: Math.max(1, items.reduce((total, item) => total + item.quantity, 0)),
    shippingPackageWeightOz: Math.max(1, Math.ceil(items.reduce((total, item) => total + item.estimatedGrams * item.quantity, 0) * 0.035274) + 2),
    shippingParcelTemplateId: null
  };
}

async function getOrCreateStripeCustomerId(input: {
  stripe: NonNullable<Awaited<ReturnType<typeof getStripe>>>;
  userId: string;
  email: string;
  name: string;
  existingCustomerId?: string | null;
}) {
  if (input.existingCustomerId) return input.existingCustomerId;
  const customer = await input.stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: { userId: input.userId }
  });
  await prisma.user.update({
    where: { id: input.userId },
    data: { stripeCustomerId: customer.id }
  });
  return customer.id;
}
