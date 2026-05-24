import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { cancelTerminalOrderPayment } from "@/services/in-person-orders";

const schema = z.object({
  orderId: z.string().min(1),
  paymentIntentId: z.string().min(1),
  reason: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("orders");
  if (response) return response;
  try {
    const body = schema.parse(await request.json());
    const order = await cancelTerminalOrderPayment({
      ...body,
      actorId: session?.user.id
    });
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel Terminal payment." }, { status: 400 });
  }
}
