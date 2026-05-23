import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export function connectStatusForAccount(account: Stripe.Account) {
  if (account.charges_enabled && account.payouts_enabled) return "ENABLED" as const;
  if (account.details_submitted) return "RESTRICTED" as const;
  return "ONBOARDING_STARTED" as const;
}

export async function syncMerchantConnectAccount(account: Stripe.Account) {
  const requirementsDue = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.eventually_due ?? [])
  ];
  const uniqueRequirements = Array.from(new Set(requirementsDue));

  return prisma.merchantApplication.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      stripeConnectStatus: connectStatusForAccount(account),
      stripeChargesEnabled: account.charges_enabled,
      stripePayoutsEnabled: account.payouts_enabled,
      stripeDetailsSubmitted: account.details_submitted,
      stripeRequirementsDue: uniqueRequirements
    }
  });
}
