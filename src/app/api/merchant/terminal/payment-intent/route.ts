import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { requireApprovedMerchant } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  amountCents: z.number().int().positive().max(1000000),
  customerEmail: z.string().trim().email(),
  businessName: z.string().trim().optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1),
    amountCents: z.number().int().nonnegative(),
    quantity: z.number().int().positive()
  })).min(1)
});

export async function POST(request: Request) {
  const { session, application, response } = await requireApprovedMerchant();
  if (response) return response;

  try {
    const body = schema.parse(await request.json());
    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

    if (!application?.stripeAccountId) return NextResponse.json({ error: "Stripe Connect account is not ready." }, { status: 400 });
    const stripeOptions = { stripeAccount: application.stripeAccountId };
    const customer = await stripe.customers.create({
      email: body.customerEmail,
      name: body.businessName || body.customerEmail,
      metadata: { source: "superprint_merchant_mobile" }
    }, stripeOptions);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: body.amountCents,
      currency: "usd",
      customer: customer.id,
      receipt_email: body.customerEmail,
      payment_method_types: ["card_present"],
      metadata: {
        source: "superprint_merchant_mobile",
        merchantUserId: session.user.id,
        merchantApplicationId: application?.id ?? "",
        itemSummary: body.items.map((item) => `${item.quantity}x ${item.name}`).join(", ").slice(0, 450)
      },
      description: `${body.businessName || "SuperPrint Merchant"} in-person payment`
    }, stripeOptions);
    await prisma.merchantOrder.create({
      data: {
        merchantUserId: session.user.id,
        applicationId: application?.id,
        customerEmail: body.customerEmail,
        itemSummary: body.items.map((item) => `${item.quantity}x ${item.name}`).join(", ").slice(0, 450),
        amountCents: body.amountCents,
        status: "PENDING",
        stripePaymentIntentId: paymentIntent.id
      }
    });

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create merchant payment." }, { status: 400 });
  }
}
