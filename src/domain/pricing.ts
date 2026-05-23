export const pricingFormulaVersion = "fixed-product-pricing-v2";
export const stripeStandardPaymentProcessingPercent = 0.029;
export const stripeStandardPaymentProcessingFixedCents = 30;

export type PricingMode = "FIXED" | "DYNAMIC";

export type PricingSettingsInput = {
  taxPercentEstimate?: number | null;
};

export type PricingProductInput = {
  id: string;
  estimatedGrams: number;
  estimatedPrintMinutes: number;
  baseLaborMinutes: number;
  basePackagingCents: number;
  pricingMode: PricingMode;
  fixedPriceCents?: number | null;
};

export type PricingFilamentInput = {
  id: string;
  costPerGramCents: number;
  markupMultiplier?: number | null;
  active: boolean;
  remainingGrams: number;
  requiresAdminApproval: boolean;
};

export type PricingOverrideInput = {
  estimatedGramsOverride?: number | null;
  estimatedPrintMinutesOverride?: number | null;
  priceAdjustmentCents?: number | null;
};

export type ProductPriceQuote = {
  productId: string;
  filamentMaterialId: string;
  estimatedGrams: number;
  estimatedPrintMinutes: number;
  quantity: number;
  materialCostCents: number;
  machineTimeCostCents: number;
  electricityCostCents: number;
  laborCostCents: number;
  packagingCostCents: number;
  maintenanceReserveCents: number;
  failureReserveCents: number;
  subtotalCostCents: number;
  internalCostCents: number;
  priceBeforeTaxAndFeesCents: number;
  profitMarkupCents: number;
  paymentFeeCents: number;
  taxCents: number;
  shippingCents: number;
  finalCustomerPriceCents: number;
  marginCents: number;
  marginPercent: number;
  pricingMode: PricingMode;
  marginWarning: string | null;
  unavailableReason: string | null;
  requiresAdminApproval: boolean;
  pricingFormulaVersion: string;
};

export function normalizePercent(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

export function calculateProductPrice(input: {
  product: PricingProductInput;
  filament: PricingFilamentInput;
  settings: PricingSettingsInput;
  override?: PricingOverrideInput | null;
  quantity?: number;
  shippingRequired?: boolean;
  shippingCents?: number;
}) {
  const quantity = Math.max(1, Math.round(input.quantity ?? 1));
  const estimatedGrams = Math.max(1, Math.round(input.override?.estimatedGramsOverride ?? input.product.estimatedGrams));
  const estimatedPrintMinutes = Math.max(1, Math.round(input.override?.estimatedPrintMinutesOverride ?? input.product.estimatedPrintMinutes));
  const shippingCents = input.shippingRequired ? Math.max(0, Math.round(input.shippingCents ?? 0)) : 0;
  const adjustmentCents = Math.round(input.override?.priceAdjustmentCents ?? 0);

  const materialCostCents = 0;
  const machineTimeCostCents = 0;
  const electricityCostCents = 0;
  const laborCostCents = 0;
  const packagingCostCents = 0;
  const baseCost = materialCostCents + machineTimeCostCents + electricityCostCents + laborCostCents + packagingCostCents + shippingCents;
  const maintenanceReserveCents = 0;
  const failureReserveCents = 0;
  const internalCostCents = baseCost + maintenanceReserveCents + failureReserveCents;
  const priceBeforeTaxAndFeesCents = Math.max(0, Math.round((input.product.fixedPriceCents ?? 0) * quantity + adjustmentCents));
  const paymentFeeCents = roundMoney(priceBeforeTaxAndFeesCents * stripeStandardPaymentProcessingPercent + stripeStandardPaymentProcessingFixedCents);
  const taxCents = roundMoney(priceBeforeTaxAndFeesCents * normalizePercent(input.settings.taxPercentEstimate));
  const finalCustomerPriceCents = priceBeforeTaxAndFeesCents;
  const subtotalCostCents = baseCost;
  const profitMarkupCents = Math.max(0, priceBeforeTaxAndFeesCents - internalCostCents);
  const marginCents = finalCustomerPriceCents - internalCostCents - paymentFeeCents - taxCents;
  const marginPercent = finalCustomerPriceCents > 0 ? marginCents / finalCustomerPriceCents : 0;
  const marginWarning = null;
  const unavailableReason = !input.filament.active
    ? "Filament is inactive."
    : input.filament.remainingGrams < estimatedGrams * quantity
      ? "Not enough filament in stock."
      : null;

  return {
    productId: input.product.id,
    filamentMaterialId: input.filament.id,
    estimatedGrams,
    estimatedPrintMinutes,
    quantity,
    materialCostCents,
    machineTimeCostCents,
    electricityCostCents,
    laborCostCents,
    packagingCostCents,
    maintenanceReserveCents,
    failureReserveCents,
    subtotalCostCents,
    internalCostCents,
    priceBeforeTaxAndFeesCents,
    profitMarkupCents,
    paymentFeeCents,
    taxCents,
    shippingCents,
    finalCustomerPriceCents,
    marginCents,
    marginPercent,
    pricingMode: input.product.pricingMode,
    marginWarning,
    unavailableReason,
    requiresAdminApproval: input.filament.requiresAdminApproval,
    pricingFormulaVersion
  } satisfies ProductPriceQuote;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
