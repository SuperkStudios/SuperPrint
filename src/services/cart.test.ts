import { describe, expect, it } from "vitest";
import { calculatePaymentProcessorFee } from "@/domain/order-totals";

describe("cart checkout fees", () => {
  it("grosses up payment processor fees so the order covers Stripe-style fees", () => {
    expect(calculatePaymentProcessorFee(10_000, 0.029, 30)).toBe(330);
  });

  it("does not charge processor fees on zero-dollar totals", () => {
    expect(calculatePaymentProcessorFee(0, 0.029, 30)).toBe(0);
  });
});
