import { NextResponse } from "next/server";
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
  if (event.type === "checkout.session.completed") {
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
  }
  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const orderId = intent.metadata?.orderId;
    if (orderId) await markOrderPaidAndQueue(orderId);
  }

  return NextResponse.json({ received: true });
}
