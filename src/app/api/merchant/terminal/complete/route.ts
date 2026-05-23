import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { requireApprovedMerchant } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  paymentIntentId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  const { session, application, response } = await requireApprovedMerchant();
  if (response) return response;

  try {
    const body = schema.parse(await request.json());
    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

    if (!application?.stripeAccountId) return NextResponse.json({ error: "Stripe Connect account is not ready." }, { status: 400 });
    const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId, {
      expand: ["latest_charge", "payment_method"]
    }, { stripeAccount: application.stripeAccountId });
    if (intent.status !== "succeeded") {
      return NextResponse.json({ error: `Stripe payment is ${intent.status}.` }, { status: 400 });
    }
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    await prisma.merchantOrder.updateMany({
      where: { merchantUserId: session.user.id, stripePaymentIntentId: intent.id },
      data: {
        status: "PAID",
        receiptUrl: charge && "receipt_url" in charge ? charge.receipt_url : null
      }
    });

    return NextResponse.json({
      status: "approved",
      paymentIntentId: intent.id,
      amountReceived: intent.amount_received || intent.amount,
      receiptEmail: intent.receipt_email,
      receiptUrl: charge && "receipt_url" in charge ? charge.receipt_url : null
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not complete merchant payment." }, { status: 400 });
  }
}
