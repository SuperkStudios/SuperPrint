import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { rateLimitRequest } from "@/lib/rate-limit";
import { previewCartCheckoutSummary } from "@/services/checkout";

const schema = z.object({
  fulfillment: z.object({
    method: z.enum(["SHIP", "PICKUP"]),
    address: z.object({
      name: z.string().optional(),
      street1: z.string().optional(),
      street2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional()
    }).optional().nullable()
  })
});

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "checkout-summary", limit: 90, windowMs: 15 * 60 * 1000 });
  if (limited) return limited;

  const { session, response } = await requireCustomer();
  if (response) return response;

  try {
    const body = schema.parse(await request.json());
    const checkout = await previewCartCheckoutSummary({
      customerId: session!.user.id,
      customerEmail: session!.user.email,
      fulfillment: body.fulfillment
    });
    return NextResponse.json(checkout);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update checkout total." }, { status: 400 });
  }
}
