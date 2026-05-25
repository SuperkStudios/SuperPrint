import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { reconcilePaidPaymentIntent } from "@/services/checkout";

const schema = z.object({
  paymentIntentId: z.string().min(1)
});

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  const body = schema.parse(await request.json());
  const order = await reconcilePaidPaymentIntent({ paymentIntentId: body.paymentIntentId, actorId: session!.user.id });
  return NextResponse.json({ order });
}
