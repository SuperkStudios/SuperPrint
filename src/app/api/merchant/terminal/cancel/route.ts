import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import { requireApprovedMerchant } from "@/lib/merchant-app";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  paymentIntentId: z.string().trim().min(1),
  reason: z.string().trim().optional()
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
    const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId, {}, stripeOptions);
    if (intent.status === "succeeded") {
      const order = await prisma.merchantOrder.updateMany({
        where: { merchantUserId: session.user.id, stripePaymentIntentId: intent.id },
        data: { status: "PAID" }
      });
      return NextResponse.json({ status: "paid", paymentIntentId: intent.id, updated: order.count });
    }

    if (!["canceled", "processing", "requires_capture"].includes(intent.status)) {
      await stripe.paymentIntents.cancel(intent.id, {
        cancellation_reason: "abandoned"
      }, stripeOptions);
    }

    const order = await prisma.merchantOrder.updateMany({
      where: { merchantUserId: session.user.id, stripePaymentIntentId: intent.id, status: "PENDING" },
      data: {
        status: "CANCELED",
        receiptUrl: body.reason ? `Canceled: ${body.reason.slice(0, 180)}` : null
      }
    });

    return NextResponse.json({ status: "canceled", paymentIntentId: intent.id, updated: order.count });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel merchant payment." }, { status: 400 });
  }
}
