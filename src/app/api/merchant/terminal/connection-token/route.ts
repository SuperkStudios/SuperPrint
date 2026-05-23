import { NextResponse } from "next/server";
import { getStripe, getStripeSettings } from "@/lib/stripe";
import { requireApprovedMerchant } from "@/lib/merchant-app";

export async function POST() {
  const { application, response } = await requireApprovedMerchant();
  if (response) return response;

  const stripe = await getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

  const settings = await getStripeSettings();
  const token = await stripe.terminal.connectionTokens.create(
    application?.stripeTerminalLocationId || settings.terminalLocationId ? { location: application?.stripeTerminalLocationId ?? settings.terminalLocationId ?? undefined } : undefined,
    application?.stripeAccountId ? { stripeAccount: application.stripeAccountId } : undefined
  );
  return NextResponse.json({ secret: token.secret });
}
