import { normalizePercent, stripeStandardPaymentProcessingFixedCents, stripeStandardPaymentProcessingPercent } from "./pricing";

export type PaymentChargeKind = "CARD" | "CASH" | "OTHER";

export type OrderTotalsInput = {
  subtotalCents: number;
  shippingCents?: number;
  rewardDiscountCents?: number;
  taxPercentEstimate?: number | null;
  paymentKind?: PaymentChargeKind;
  paymentProcessingPercent?: number | null;
  paymentProcessingFixedCents?: number | null;
};

export function calculateOrderTotals(input: OrderTotalsInput) {
  const subtotalCents = cents(input.subtotalCents);
  const shippingCents = cents(input.shippingCents ?? 0);
  const rewardDiscountCents = Math.min(cents(input.rewardDiscountCents ?? 0), subtotalCents);
  const taxableSubtotalCents = Math.max(0, subtotalCents - rewardDiscountCents);
  const taxCents = roundMoney(taxableSubtotalCents * normalizePercent(input.taxPercentEstimate));
  const beforeFeeCents = taxableSubtotalCents + taxCents + shippingCents;
  const paymentFeeCents = input.paymentKind === "CARD"
    ? calculatePaymentProcessorFee(
        beforeFeeCents,
        input.paymentProcessingPercent ?? stripeStandardPaymentProcessingPercent,
        input.paymentProcessingFixedCents ?? stripeStandardPaymentProcessingFixedCents
      )
    : 0;
  const totalCents = beforeFeeCents + paymentFeeCents;
  return {
    subtotalCents,
    rewardDiscountCents,
    taxableSubtotalCents,
    taxCents,
    shippingCents,
    paymentFeeCents,
    totalCents,
    sellerNetCents: Math.max(0, totalCents - taxCents - paymentFeeCents)
  };
}

export function calculatePaymentProcessorFee(
  baseCents: number,
  percentValue = stripeStandardPaymentProcessingPercent,
  fixedCents = stripeStandardPaymentProcessingFixedCents
) {
  if (baseCents <= 0) return 0;
  const percent = normalizePercent(percentValue);
  if (percent <= 0) return cents(fixedCents);
  return Math.max(0, Math.round((baseCents * percent + fixedCents) / Math.max(0.01, 1 - percent)));
}

export function paymentKindForMethod(method?: string | null): PaymentChargeKind {
  if (method === "CASH") return "CASH";
  if (method?.startsWith("STRIPE") || method === "ONLINE" || method === "CARD") return "CARD";
  return "OTHER";
}

function cents(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
