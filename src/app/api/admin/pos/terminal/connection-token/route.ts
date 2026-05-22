import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { getStripe, getStripeSettings } from "@/lib/stripe";

export async function POST() {
  const { response } = await requireAdmin("orders");
  if (response) return response;
  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });
  }
  const settings = await getStripeSettings();
  const token = await stripe.terminal.connectionTokens.create(
    settings.terminalLocationId ? { location: settings.terminalLocationId } : undefined
  );
  return NextResponse.json({ secret: token.secret });
}
