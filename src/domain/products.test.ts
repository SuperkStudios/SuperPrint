import { describe, expect, it } from "vitest";
import { normalizeProductInput } from "./products";

describe("product catalog", () => {
  it("normalizes product input for admin-created store items", () => {
    expect(
      normalizeProductInput({
        name: "Cable Clip XL",
        description: "A durable cable clip printed from approved material.",
        imageUrl: "https://example.com/cable-clip.png",
        priceCents: 1299,
        estimatedPrintMinutes: 42,
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
        defaultMaterial: "PLA"
      })
    ).toThrow();
  });
});
