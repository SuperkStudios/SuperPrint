import { NextResponse } from "next/server";
import { requireMerchantUser } from "@/lib/merchant-app";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { connectStatusForAccount } from "@/services/stripe-connect";

export async function GET() {
  const { application, response } = await requireMerchantUser();
  if (response) return response;
  if (!application?.stripeAccountId) return NextResponse.json({ status: "NOT_STARTED" });

  const stripe = await getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });

  const account = await stripe.accounts.retrieve(application.stripeAccountId);
  const requirementsDue = Array.from(new Set([
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.eventually_due ?? [])
  ]));
  const status = connectStatusForAccount(account);
  const updated = await prisma.merchantApplication.update({
    where: { id: application.id },
    data: {
      stripeConnectStatus: status,
      stripeChargesEnabled: account.charges_enabled,
      stripePayoutsEnabled: account.payouts_enabled,
      stripeDetailsSubmitted: account.details_submitted,
      stripeRequirementsDue: requirementsDue
    }
  });
  return NextResponse.json({
    status: updated.stripeConnectStatus,
    chargesEnabled: updated.stripeChargesEnabled,
    payoutsEnabled: updated.stripePayoutsEnabled,
    detailsSubmitted: updated.stripeDetailsSubmitted,
    requirementsDue
  });
}
