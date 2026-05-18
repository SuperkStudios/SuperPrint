import { describe, expect, it } from "vitest";
import { calculateRewardEarnedPoints, calculateRewardRedemption, defaultRewardsSettings } from "./rewards";

describe("rewards", () => {
  it("earns points on product subtotal and excludes shipping by default", () => {
    expect(calculateRewardEarnedPoints({
      paidProductSubtotalCents: 2500,
      shippingCents: 999,
      settings: defaultRewardsSettings
    })).toBe(250);
  });

  it("can include shipping in earn basis when configured", () => {
    expect(calculateRewardEarnedPoints({
      paidProductSubtotalCents: 2500,
      shippingCents: 500,
      settings: { ...defaultRewardsSettings, includeShippingInEarnBasis: true }
    })).toBe(300);
  });

  it("rejects redemptions below the minimum", () => {
    const redemption = calculateRewardRedemption({
      userBalance: 1000,
      productSubtotalCents: 5000,
      requestedPoints: 400,
      settings: defaultRewardsSettings
    });

    expect(redemption.discountCents).toBe(0);
    expect(redemption.error).toContain("Redeem at least");
  });

  it("rejects redemptions above the customer balance", () => {
    const redemption = calculateRewardRedemption({
      userBalance: 600,
      productSubtotalCents: 5000,
      requestedPoints: 700,
      settings: defaultRewardsSettings
    });

    expect(redemption.discountCents).toBe(0);
    expect(redemption.error).toBe("Not enough rewards points.");
  });

  it("caps redemption to the configured product discount percent", () => {
    const redemption = calculateRewardRedemption({
      userBalance: 5000,
      productSubtotalCents: 5000,
      requestedPoints: 5000,
      settings: defaultRewardsSettings
    });

    expect(redemption.discountCents).toBe(1000);
    expect(redemption.pointsRedeemed).toBe(1000);
  });

  it("keeps the product line item positive", () => {
    const redemption = calculateRewardRedemption({
      userBalance: 10000,
      productSubtotalCents: 500,
      requestedPoints: 10000,
      settings: { ...defaultRewardsSettings, maxDiscountPercent: 1, minimumRedemptionPoints: 1 }
    });

    expect(redemption.discountCents).toBe(499);
  });
});
