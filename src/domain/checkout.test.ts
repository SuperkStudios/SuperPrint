import { describe, expect, it } from "vitest";
import { buildStripeProductLineItem, nextQueuePosition } from "./checkout";

describe("checkout", () => {
  it("builds Stripe line items from product pricing", () => {
    expect(
      buildStripeProductLineItem({
        name: "Desk Hook",
        description: "Printed desk hook.",
        imageUrl: "https://example.com/hook.png",
        priceCents: 1500
      })
    ).toEqual({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Desk Hook",
          description: "Printed desk hook.",
          images: ["https://example.com/hook.png"]
        },
        unit_amount: 1500
      },
      quantity: 1
    });
  });

  it("places paid orders at the end of the software queue", () => {
    expect(nextQueuePosition([])).toBe(1);
    expect(nextQueuePosition([1, 3, null])).toBe(4);
  });
});
