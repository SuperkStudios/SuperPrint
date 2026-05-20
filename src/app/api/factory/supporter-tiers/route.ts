import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { activateSupporterTier } from "@/services/factory-evolution";

const tierRequestSchema = z.object({
  tierId: z.string()
});

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;

  const body = tierRequestSchema.parse(await request.json());
  const tier = await prisma.supporterTier.findFirst({ where: { id: body.tierId, active: true } });
  if (!tier) return NextResponse.json({ error: "Supporter tier is not available." }, { status: 404 });

  const stripe = await getStripe();
  if (!stripe || (!tier.oneTimePriceCents && !tier.monthlyPriceCents)) {
    await activateSupporterTier(session!.user.id, tier.id, tier.priorityWeight);
    return NextResponse.json({ checkoutUrl: null, stripeConfigured: false });
  }

  const recurring = tier.monthlyPriceCents ? { interval: "month" as const } : undefined;
  const amountCents = tier.monthlyPriceCents ?? tier.oneTimePriceCents!;
  const baseUrl = getStripeBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: recurring ? "subscription" : "payment",
    customer_email: session!.user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          ...(recurring ? { recurring } : {}),
          product_data: {
            name: `SuperPrint ${tier.title}`,
            description: tier.description || "SuperPrint supporter tier with community recognition and platform perks."
          },
          unit_amount: amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      kind: "factory_supporter_tier",
      userId: session!.user.id,
      tierId: tier.id
    },
    success_url: `${baseUrl}/factory?tier=success`,
    cancel_url: `${baseUrl}/factory?tier=cancelled`
  });

  return NextResponse.json({ checkoutUrl: checkout.url, stripeConfigured: true });
}
