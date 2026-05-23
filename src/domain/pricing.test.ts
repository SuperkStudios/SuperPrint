import { describe, expect, it } from "vitest";
import { calculateProductPrice, stripeStandardPaymentProcessingFixedCents, stripeStandardPaymentProcessingPercent } from "./pricing";

const settings = {
  taxPercentEstimate: 0
};

const product = {
  id: "prod_1",
  estimatedGrams: 100,
  estimatedPrintMinutes: 120,
  baseLaborMinutes: 10,
  basePackagingCents: 150,
  pricingMode: "FIXED" as const,
  fixedPriceCents: 2500
};

const pla = {
  id: "pla_black",
  costPerGramCents: 2,
  markupMultiplier: 1,
  active: true,
  remainingGrams: 1000,
  requiresAdminApproval: false
};

describe("product pricing", () => {
  it("uses the fixed product price instead of material-cost dynamic pricing", () => {
    const plaQuote = calculateProductPrice({ product, filament: pla, settings });
    const tpuQuote = calculateProductPrice({
      product,
      filament: { ...pla, id: "tpu_blue", costPerGramCents: 50 },
      settings
    });

    expect(plaQuote.finalCustomerPriceCents).toBe(2500);
    expect(tpuQuote.finalCustomerPriceCents).toBe(2500);
    expect(tpuQuote.materialCostCents).toBe(0);
    expect(tpuQuote.marginWarning).toBeNull();
  });

  it("applies allowed filament price adjustments to the fixed price", () => {
    const quote = calculateProductPrice({
      product,
      filament: pla,
      settings,
      override: { priceAdjustmentCents: 300 }
    });

    expect(quote.finalCustomerPriceCents).toBe(2800);
  });

  it("keeps estimates and availability checks for fulfillment", () => {
    const quote = calculateProductPrice({
      product,
      filament: { ...pla, remainingGrams: 20 },
      settings,
      override: { estimatedGramsOverride: 200, estimatedPrintMinutesOverride: 240 }
    });

    expect(quote.estimatedGrams).toBe(200);
    expect(quote.estimatedPrintMinutes).toBe(240);
    expect(quote.unavailableReason).toBe("Not enough filament in stock.");
  });

  it("uses Stripe standard online card fee defaults for pricing snapshots", () => {
    const quote = calculateProductPrice({ product, filament: pla, settings });

    expect(stripeStandardPaymentProcessingPercent).toBe(0.029);
    expect(stripeStandardPaymentProcessingFixedCents).toBe(30);
    expect(quote.paymentFeeCents).toBe(103);
  });
});
