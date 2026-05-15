import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminSettingsForm } from "./admin-settings-form";

describe("AdminSettingsForm", () => {
  it("renders Stripe configuration fields with masked saved secrets", () => {
    const html = renderToStaticMarkup(
      <AdminSettingsForm
        brandName="SuperPrint"
        primaryColor="#0f8f7f"
        lowFilamentThresholdGrams={150}
        stripeSettings={{
          mode: "test",
          secretKey: "sk_test_1234567890",
          publishableKey: "pk_test_1234567890",
          webhookSecret: "whsec_1234567890",
          configured: true
        }}
      />
    );

    expect(html).toContain("Stripe payments");
    expect(html).toContain("sk_test");
    expect(html).toContain("whsec");
    expect(html).not.toContain("sk_test_1234567890");
    expect(html).not.toContain("whsec_1234567890");
    expect(html).toContain("pk_test_1234567890");
  });

  it("renders operations notification settings", () => {
    const html = renderToStaticMarkup(
      <AdminSettingsForm
        brandName="SuperPrint"
        primaryColor="#0f8f7f"
        lowFilamentThresholdGrams={150}
        notificationSettings={{
          email: "owner@example.com",
          sms: "+15555550123",
          webhookUrl: "https://hooks.example.com/superprint",
          configured: true
        }}
      />
    );

    expect(html).toContain("Operations notifications");
    expect(html).toContain("owner@example.com");
    expect(html).toContain("+15555550123");
  });
});
