import { describe, expect, it } from "vitest";
import { buildShippoSettingsUpdate, isPickupAddressEligible, maskShippoSecret, resolveShippoSettings } from "./shippo-settings";

describe("Shippo settings", () => {
  it("resolves admin token and origin address", () => {
    const settings = resolveShippoSettings({
      settings: {
        "shippo.apiToken": "shippo_test_admin",
        "shippo.origin.name": "SuperPrint",
        "shippo.origin.street1": "123 College Ave",
        "shippo.origin.city": "Fort Collins",
        "shippo.origin.state": "CO",
        "shippo.origin.zip": "80524",
        "shippo.freeShippingThresholdCents": 7500
      },
      env: { SHIPPO_API_TOKEN: "shippo_test_env" }
    });

    expect(settings.apiToken).toBe("shippo_test_admin");
    expect(settings.configured).toBe(true);
    expect(settings.freeShippingThresholdCents).toBe(7500);
  });

  it("preserves masked tokens when saving settings", () => {
    const updates = buildShippoSettingsUpdate({
      apiToken: maskShippoSecret("shippo_test_existing"),
      pickupCity: "Fort Collins",
      autoCreateLabelAfterPrint: true
    }, {
      "shippo.apiToken": "shippo_test_existing"
    });

    expect(updates["shippo.apiToken"]).toBeUndefined();
    expect(updates["shippo.pickupCity"]).toBe("Fort Collins");
    expect(updates["shippo.autoCreateLabelAfterPrint"]).toBe(true);
  });

  it("limits pickup eligibility to configured city and state", () => {
    expect(isPickupAddressEligible({ city: "Fort Collins", state: "CO" }, { pickupCity: "Fort Collins", pickupState: "CO" })).toBe(true);
    expect(isPickupAddressEligible({ city: "Denver", state: "CO" }, { pickupCity: "Fort Collins", pickupState: "CO" })).toBe(false);
  });
});
