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

  it("renders Shippo shipping settings", () => {
    const html = renderToStaticMarkup(
      <AdminSettingsForm
        brandName="SuperPrint"
        primaryColor="#0f8f7f"
        lowFilamentThresholdGrams={150}
        shippoSettings={{
          apiToken: "shippo_test_1234567890",
          configured: true,
          source: "admin",
          freeShippingThresholdCents: 7500,
          pickupCity: "Fort Collins",
          pickupState: "CO",
          autoCreateLabelAfterPrint: true,
          autoPrintLabelAfterPrint: false,
          printCommand: "lpr",
          labelFileType: "PDF_4x6",
          originAddress: {
            name: "SuperPrint",
            street1: "123 College Ave",
            city: "Fort Collins",
            state: "CO",
            zip: "80524",
            country: "US"
          }
        }}
      />
    );

    expect(html).toContain("Shippo shipping");
    expect(html).toContain("Free shipping over");
    expect(html).toContain("SuperPrint");
    expect(html).not.toContain("shippo_test_1234567890");
  });
});
