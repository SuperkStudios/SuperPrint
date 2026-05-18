import { describe, expect, it } from "vitest";
import { calculateProductPrice } from "./pricing";

const settings = {
  machineHourlyRateCents: 300,
  laborHourlyRateCents: 1800,
  electricityHourlyRateCents: 24,
  maintenanceReservePercent: 0.1,
  failureReservePercent: 0.1,
  defaultProfitMultiplier: 2,
  paymentProcessingPercent: 0.03,
  paymentProcessingFixedCents: 30,
  taxPercentEstimate: 0,
  minimumOrderPriceCents: 500
};

const product = {
  id: "prod_1",
  estimatedGrams: 100,
  estimatedPrintMinutes: 120,
  baseLaborMinutes: 10,
  basePackagingCents: 150,
  pricingMode: "DYNAMIC" as const,
  fixedPriceCents: null
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
  it("prices PLA and TPU differently for the same product", () => {
    const plaQuote = calculateProductPrice({ product, filament: pla, settings });
    const tpuQuote = calculateProductPrice({
      product,
      filament: { ...pla, id: "tpu_blue", costPerGramCents: 5 },
      settings
    });

    expect(tpuQuote.finalCustomerPriceCents).toBeGreaterThan(plaQuote.finalCustomerPriceCents);
  });

  it("fixed price products still calculate internal cost and margin warning", () => {
    const quote = calculateProductPrice({
      product: { ...product, pricingMode: "FIXED", fixedPriceCents: 1000 },
      filament: pla,
      settings
    });

    expect(quote.finalCustomerPriceCents).toBe(1000);
    expect(quote.internalCostCents).toBeGreaterThan(0);
    expect(quote.marginWarning).toContain("Fixed price");
  });

  it("dynamic price changes when filament cost changes", () => {
    const cheap = calculateProductPrice({ product, filament: { ...pla, costPerGramCents: 1 }, settings });
    const expensive = calculateProductPrice({ product, filament: { ...pla, costPerGramCents: 8 }, settings });

    expect(expensive.materialCostCents).toBeGreaterThan(cheap.materialCostCents);
    expect(expensive.finalCustomerPriceCents).toBeGreaterThan(cheap.finalCustomerPriceCents);
  });

  it("marks out-of-stock filament unavailable", () => {
    const quote = calculateProductPrice({
      product,
      filament: { ...pla, remainingGrams: 20 },
      settings
    });

    expect(quote.unavailableReason).toBe("Not enough filament in stock.");
  });

  it("uses product allowed filament overrides", () => {
    const regular = calculateProductPrice({ product, filament: pla, settings });
    const overridden = calculateProductPrice({
      product,
      filament: pla,
      settings,
      override: { estimatedGramsOverride: 200, estimatedPrintMinutesOverride: 240, priceAdjustmentCents: 300 }
    });

    expect(overridden.materialCostCents).toBeGreaterThan(regular.materialCostCents);
    expect(overridden.machineTimeCostCents).toBeGreaterThan(regular.machineTimeCostCents);
    expect(overridden.finalCustomerPriceCents).toBeGreaterThan(regular.finalCustomerPriceCents);
  });

  it("enforces the minimum order price", () => {
    const quote = calculateProductPrice({
      product: { ...product, estimatedGrams: 1, estimatedPrintMinutes: 1, baseLaborMinutes: 0, basePackagingCents: 0 },
      filament: { ...pla, costPerGramCents: 0 },
      settings: { ...settings, minimumOrderPriceCents: 1200 }
    });

    expect(quote.finalCustomerPriceCents).toBe(1200);
  });

  it("snapshot values remain plain values after settings change", () => {
    const snapshot = calculateProductPrice({ product, filament: pla, settings });
    calculateProductPrice({ product, filament: pla, settings: { ...settings, defaultProfitMultiplier: 5 } });

    expect(snapshot.finalCustomerPriceCents).toBe(calculateProductPrice({ product, filament: pla, settings }).finalCustomerPriceCents);
  });
});
