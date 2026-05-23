import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { connectStatusForAccount } from "./stripe-connect";

function account(overrides: Partial<Stripe.Account>): Stripe.Account {
  return {
    id: "acct_test",
    object: "account",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements: {
      currently_due: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
      errors: [],
      alternatives: [],
      current_deadline: null,
      disabled_reason: null
    },
    ...overrides
  } as Stripe.Account;
}

describe("connectStatusForAccount", () => {
  it("enables merchants only when charges and payouts are enabled", () => {
    expect(connectStatusForAccount(account({ charges_enabled: true, payouts_enabled: true, details_submitted: true }))).toBe("ENABLED");
  });

  it("marks submitted accounts as restricted until all Stripe capabilities are ready", () => {
    expect(connectStatusForAccount(account({ charges_enabled: true, payouts_enabled: false, details_submitted: true }))).toBe("RESTRICTED");
  });

  it("keeps incomplete accounts in onboarding", () => {
    expect(connectStatusForAccount(account({ details_submitted: false }))).toBe("ONBOARDING_STARTED");
  });
});
