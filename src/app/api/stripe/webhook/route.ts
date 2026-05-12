import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markOrderPaidAndQueue } from "@/services/checkout";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
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
  }

  return NextResponse.json({ received: true });
}
