export const pricingFormulaVersion = "product-pricing-v1";

export type PricingMode = "FIXED" | "DYNAMIC";

export type PricingSettingsInput = {
  machineHourlyRateCents: number;
  laborHourlyRateCents: number;
  electricityHourlyRateCents: number;
  maintenanceReservePercent: number;
  failureReservePercent: number;
  defaultProfitMultiplier: number;
  paymentProcessingPercent: number;
  paymentProcessingFixedCents: number;
  taxPercentEstimate?: number | null;
  minimumOrderPriceCents: number;
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
  const materialMultiplier = input.filament.markupMultiplier && input.filament.markupMultiplier > 0 ? input.filament.markupMultiplier : 1;

  const materialCostCents = roundMoney(estimatedGrams * input.filament.costPerGramCents * materialMultiplier * quantity);
  const printHours = estimatedPrintMinutes / 60;
  const machineTimeCostCents = roundMoney(printHours * input.settings.machineHourlyRateCents * quantity);
  const electricityCostCents = roundMoney(printHours * input.settings.electricityHourlyRateCents * quantity);
  const laborCostCents = roundMoney((input.product.baseLaborMinutes / 60) * input.settings.laborHourlyRateCents * quantity);
  const packagingCostCents = Math.max(0, Math.round(input.product.basePackagingCents * quantity));
  const baseCost = materialCostCents + machineTimeCostCents + electricityCostCents + laborCostCents + packagingCostCents + shippingCents;
  const maintenanceReserveCents = roundMoney(baseCost * normalizePercent(input.settings.maintenanceReservePercent));
  const failureReserveCents = roundMoney(baseCost * normalizePercent(input.settings.failureReservePercent));
  const internalCostCents = baseCost + maintenanceReserveCents + failureReserveCents;
  const dynamicPriceBeforeFees = roundMoney(internalCostCents * Math.max(1, input.settings.defaultProfitMultiplier) + adjustmentCents);
  const priceBeforeTaxAndFeesCents =
    input.product.pricingMode === "FIXED"
      ? Math.max(0, Math.round(input.product.fixedPriceCents ?? dynamicPriceBeforeFees))
      : dynamicPriceBeforeFees;
  const paymentFeeCents = roundMoney(priceBeforeTaxAndFeesCents * normalizePercent(input.settings.paymentProcessingPercent) + input.settings.paymentProcessingFixedCents);
  const taxCents = roundMoney(priceBeforeTaxAndFeesCents * normalizePercent(input.settings.taxPercentEstimate));
  const finalBeforeMinimum = priceBeforeTaxAndFeesCents + paymentFeeCents + taxCents;
  const finalCustomerPriceCents = input.product.pricingMode === "FIXED"
    ? priceBeforeTaxAndFeesCents
    : Math.max(finalBeforeMinimum, input.settings.minimumOrderPriceCents);
  const subtotalCostCents = baseCost;
  const profitMarkupCents = Math.max(0, priceBeforeTaxAndFeesCents - internalCostCents);
  const marginCents = finalCustomerPriceCents - internalCostCents - paymentFeeCents - taxCents;
  const marginPercent = finalCustomerPriceCents > 0 ? marginCents / finalCustomerPriceCents : 0;
  const targetMarginCents = dynamicPriceBeforeFees - internalCostCents;
  const marginWarning =
    input.product.pricingMode === "FIXED" && priceBeforeTaxAndFeesCents < dynamicPriceBeforeFees
      ? `Fixed price is ${formatCents(dynamicPriceBeforeFees - priceBeforeTaxAndFeesCents)} below target dynamic price.`
      : marginCents < targetMarginCents * 0.8
        ? "Margin is below target."
        : null;
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

export function formatCents(cents: number) {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
