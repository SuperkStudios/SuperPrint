import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getStripeSettings } from "@/lib/stripe";
import { markOrderPaidAndQueue } from "@/services/checkout";
import { activateSupporterTier, applyFactoryContribution } from "@/services/factory-evolution";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const [stripe, settings] = await Promise.all([getStripe(), getStripeSettings()]);
  const secret = settings.webhookSecret;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });

  const rawBody = await request.text();
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) await markOrderPaidAndQueue(orderId);
      if (session.metadata?.kind === "factory_contribution") {
        await applyFactoryContribution({
          userId: session.metadata.userId!,
          goalId: session.metadata.goalId!,
          amountCents: Number(session.metadata.amountCents ?? 0),
          message: session.metadata.message || undefined,
          anonymous: session.metadata.anonymous === "true",
          paymentStatus: "paid",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined
        });
      }
      if (session.metadata?.kind === "factory_supporter_tier") {
        const tier = await prisma.supporterTier.findUnique({ where: { id: session.metadata.tierId! } });
        if (tier) await activateSupporterTier(session.metadata.userId!, tier.id, tier.priorityWeight);
      }
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (orderId) await markOrderPaidAndQueue(orderId);
      break;
    }
    case "payment_intent.payment_failed": {
      await markPaymentIntentFailed(event.data.object);
      break;
    }
    case "charge.refunded": {
      await markChargeRefunded(event.data.object);
      break;
    }
    case "terminal.reader.action_succeeded":
    case "terminal.reader.action_failed":
      break;
  }

  return NextResponse.json({ received: true });
}

async function markPaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const orderId = intent.metadata?.orderId;
  const where = orderId ? { id: orderId } : { stripePaymentIntentId: intent.id };
  await prisma.order.updateMany({
    where,
    data: {
      paymentStatus: "FAILED",
      paymentReference: intent.id
    }
  });
}

async function markChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  await prisma.order.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: {
      paymentStatus: charge.amount_refunded >= charge.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      paymentReference: charge.id,
      balanceDueCents: charge.amount_refunded >= charge.amount ? 0 : undefined
    }
  });
}
