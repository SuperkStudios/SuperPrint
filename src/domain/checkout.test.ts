import { describe, expect, it } from "vitest";
import { buildStripeCheckoutSuccessUrl, buildStripeProductLineItem, isPaidStripeCheckoutSession, nextQueuePosition, resolveCheckoutSelection } from "./checkout";

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

  it("omits relative product images from Stripe line items", () => {
    expect(
      buildStripeProductLineItem({
        name: "Dragon",
        description: "Printed dragon.",
        imageUrl: "/api/products/prod_123/image",
        priceCents: 525
      })
    ).toEqual({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Dragon",
          description: "Printed dragon."
        },
        unit_amount: 525
      },
      quantity: 1
    });
  });

  it("places paid orders at the end of the software queue", () => {
    expect(nextQueuePosition([])).toBe(1);
    expect(nextQueuePosition([1, 3, null])).toBe(4);
  });

  it("normalizes store material and color selections for checkout", () => {
    expect(resolveCheckoutSelection({ defaultMaterial: "PLA" }, { selectedMaterial: " tpu ", selectedColor: " black " })).toEqual({
      selectedMaterial: "TPU",
      selectedColor: "Black"
    });
    expect(resolveCheckoutSelection({ defaultMaterial: "PLA" }, {})).toEqual({
      selectedMaterial: "PLA",
      selectedColor: undefined
    });
  });

  it("builds a success URL that lets SuperPrint reconcile missed webhooks", () => {
    expect(buildStripeCheckoutSuccessUrl("http://localhost:3000", "ord_123")).toBe("http://localhost:3000/orders?checkout=success&order=ord_123&session_id={CHECKOUT_SESSION_ID}");
  });

  it("recognizes paid checkout sessions for order reconciliation", () => {
    expect(isPaidStripeCheckoutSession({ status: "complete", payment_status: "paid", metadata: { orderId: "ord_123" } }, "ord_123")).toBe(true);
    expect(isPaidStripeCheckoutSession({ status: "open", payment_status: "unpaid", metadata: { orderId: "ord_123" } }, "ord_123")).toBe(false);
    expect(isPaidStripeCheckoutSession({ status: "complete", payment_status: "paid", metadata: { orderId: "other" } }, "ord_123")).toBe(false);
  });
});
