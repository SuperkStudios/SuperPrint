import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, getStripeBaseUrl } from "@/lib/stripe";
import { requireCustomer } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { applyFactoryContribution } from "@/services/factory-evolution";

const contributionSchema = z.object({
  goalId: z.string(),
  amountCents: z.number().int().min(100).max(100000),
  message: z.string().max(240).optional(),
  anonymous: z.boolean().default(false)
});

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;

  const body = contributionSchema.parse(await request.json());
  const goal = await prisma.factoryUpgradeGoal.findFirst({
    where: { id: body.goalId, visibility: "public", status: { in: ["active", "funded", "installing"] } }
  });
  if (!goal) return NextResponse.json({ error: "Factory goal is not available." }, { status: 404 });

  const stripe = await getStripe();
  if (!stripe) {
    const result = await applyFactoryContribution({
      userId: session!.user.id,
      goalId: body.goalId,
      amountCents: body.amountCents,
      message: body.message,
      anonymous: body.anonymous,
      paymentStatus: "manual"
    });
    return NextResponse.json({ ...result, checkoutUrl: null, stripeConfigured: false });
  }

  const baseUrl = getStripeBaseUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session!.user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `SuperPrint factory support: ${goal.title}`,
            description: "Community factory unlock contribution. No equity, profit sharing, or financial payout is provided."
          },
          unit_amount: body.amountCents
        },
        quantity: 1
      }
    ],
    metadata: {
      kind: "factory_contribution",
      userId: session!.user.id,
      goalId: body.goalId,
      amountCents: String(body.amountCents),
      anonymous: String(body.anonymous),
      message: body.message ?? ""
    },
    success_url: `${baseUrl}/factory?contribution=success`,
    cancel_url: `${baseUrl}/factory?contribution=cancelled`
  });

  return NextResponse.json({ checkoutUrl: checkout.url, stripeConfigured: true });
}
