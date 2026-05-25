import { describe, expect, it } from "vitest";
import { calculateOrderTotals, calculatePaymentProcessorFee, paymentKindForMethod } from "./order-totals";

describe("order totals", () => {
  it("adds tax and grosses up card fees above the seller subtotal", () => {
    const totals = calculateOrderTotals({
      subtotalCents: 10_000,
      taxPercentEstimate: 8.1,
      paymentKind: "CARD",
      paymentProcessingPercent: 0.029,
      paymentProcessingFixedCents: 30
    });

    expect(totals.taxCents).toBe(810);
    expect(totals.paymentFeeCents).toBe(354);
    expect(totals.totalCents).toBe(11_164);
    expect(totals.sellerNetCents).toBe(10_000);
  });

  it("tracks cash tax without adding processor fees", () => {
    const totals = calculateOrderTotals({
      subtotalCents: 10_000,
      taxPercentEstimate: 0.081,
      paymentKind: "CASH"
    });

    expect(totals.taxCents).toBe(810);
    expect(totals.paymentFeeCents).toBe(0);
    expect(totals.totalCents).toBe(10_810);
    expect(totals.sellerNetCents).toBe(10_000);
  });

  it("maps Stripe methods to card fee totals", () => {
    expect(paymentKindForMethod("STRIPE_TERMINAL")).toBe("CARD");
    expect(paymentKindForMethod("CASH")).toBe("CASH");
    expect(paymentKindForMethod("UNPAID")).toBe("OTHER");
  });

  it("grosses up payment processor fees so the order covers Stripe-style fees", () => {
    expect(calculatePaymentProcessorFee(10_000, 0.029, 30)).toBe(330);
  });
});
