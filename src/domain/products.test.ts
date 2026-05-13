import { describe, expect, it } from "vitest";
import { calculateProductMaterialCostCents, normalizeProductInput, parseProductPrintFileEstimates } from "./products";

describe("product catalog", () => {
  it("normalizes product input for admin-created store items", () => {
    expect(
      normalizeProductInput({
        name: "Cable Clip XL",
        description: "A durable cable clip printed from approved material.",
        imageUrl: "/api/products/product_1/image",
        priceCents: 1299,
        estimatedPrintMinutes: 42,
        estimatedGrams: 64,
        materialCostCents: 153,
        defaultMaterial: "PLA"
      })
    ).toMatchObject({
      name: "Cable Clip XL",
      slug: "cable-clip-xl",
      priceCents: 1299,
      status: "ACTIVE"
    });
  });

  it("rejects products without customer-facing media and pricing", () => {
    expect(() =>
      normalizeProductInput({
        name: "X",
        description: "too short",
        imageUrl: "not-a-url",
        priceCents: 0,
        estimatedPrintMinutes: 0,
        estimatedGrams: 0,
        defaultMaterial: "PLA"
      })
    ).toThrow();
  });

  it("calculates material cost from grams and spool cost", () => {
    expect(calculateProductMaterialCostCents({ estimatedGrams: 72, rollCostCents: 2400, rollGrams: 1000 })).toBe(173);
  });

  it("parses safe G-code product estimates when comments are present", () => {
    expect(
      parseProductPrintFileEstimates("; estimated printing time: 2h 14m\n; filament used [g] = 81.4")
    ).toEqual({ estimatedPrintMinutes: 134, estimatedGrams: 81 });
  });
});
