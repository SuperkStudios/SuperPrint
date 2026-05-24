import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireAdmin } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const stripe = await getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

  const url = new URL(request.url);
  const paymentIntentId = url.searchParams.get("paymentIntentId")?.trim();
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") ?? 8)));

  try {
    if (paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge", "payment_method"]
      });
      return NextResponse.json({ payments: [compactPaymentIntent(intent)] });
    }

    if (!email) return NextResponse.json({ payments: [] });

    const customers = await stripe.customers.list({ email, limit: 5 });
    const localUser = await prisma.user.findUnique({
      where: { email },
      select: { stripeCustomerId: true }
    });
    const customerIds = new Set(customers.data.map((customer) => customer.id));
    if (localUser?.stripeCustomerId) customerIds.add(localUser.stripeCustomerId);

    const payments = (
      await Promise.all(Array.from(customerIds).map(async (customer) => {
        const intents = await stripe.paymentIntents.list({ customer, limit });
        return intents.data;
      }))
    )
      .flat()
      .filter((intent) => intent.status === "succeeded")
      .sort((a, b) => b.created - a.created)
      .slice(0, limit)
      .map(compactPaymentIntent);

    return NextResponse.json({ payments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Stripe payments." }, { status: 400 });
  }
}

function compactPaymentIntent(intent: Stripe.PaymentIntent) {
  const paymentDetails = extractPaymentDetails(intent);
  return {
    id: intent.id,
    amountCents: intent.amount_received || intent.amount,
    status: intent.status,
    created: new Date(intent.created * 1000).toISOString(),
    receiptEmail: intent.receipt_email,
    description: intent.description,
    cardBrand: paymentDetails.brand,
    cardLast4: paymentDetails.last4
  };
}

function extractPaymentDetails(intent: Stripe.PaymentIntent) {
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
