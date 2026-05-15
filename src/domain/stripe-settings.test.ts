import { describe, expect, it } from "vitest";
import {
  buildStripeSettingsUpdate,
  maskStripeSecret,
  resolveStripeSettings,
  validateStripeSettingsInput
} from "./stripe-settings";

describe("Stripe settings", () => {
  it("prefers admin Stripe settings over environment variables", () => {
    expect(
      resolveStripeSettings({
        settings: {
          "stripe.secretKey": "sk_live_admin",
          "stripe.publishableKey": "pk_live_admin",
          "stripe.webhookSecret": "whsec_admin",
          "stripe.mode": "live"
        },
        env: {
          STRIPE_SECRET_KEY: "sk_test_env",
          NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_env",
          STRIPE_WEBHOOK_SECRET: "whsec_env"
        }
      })
    ).toMatchObject({
      secretKey: "sk_live_admin",
      publishableKey: "pk_live_admin",
      webhookSecret: "whsec_admin",
      mode: "live",
      source: "admin"
    });
  });

  it("keeps existing secret values when a masked admin form field is submitted unchanged", () => {
    const existing = {
      "stripe.secretKey": "sk_test_existing",
      "stripe.publishableKey": "pk_test_existing",
      "stripe.webhookSecret": "whsec_existing",
      "stripe.mode": "test"
    };

    expect(
      buildStripeSettingsUpdate(
        {
          mode: "live",
          secretKey: maskStripeSecret("sk_test_existing"),
          publishableKey: "pk_live_next",
          webhookSecret: ""
        },
        existing
      )
    ).toEqual({
      "stripe.mode": "live",
      "stripe.publishableKey": "pk_live_next"
    });
  });

  it("validates Stripe key families before saving", () => {
    expect(() =>
      validateStripeSettingsInput({
        mode: "live",
        secretKey: "pk_live_wrong",
        publishableKey: "pk_live_ok",
        webhookSecret: "whsec_ok"
      })
    ).toThrow("Stripe secret key must start with sk_test_ or sk_live_");
  });
});
