import { Prisma } from "@prisma/client";
import { calculateProductPrice as calculatePriceFromInputs, type ProductPriceQuote, type PricingSettingsInput } from "@/domain/pricing";
import { prisma } from "@/lib/prisma";

const defaultPricingSettings: PricingSettingsInput = {
  machineHourlyRateCents: 250,
  laborHourlyRateCents: 1800,
  electricityHourlyRateCents: 20,
  maintenanceReservePercent: 0.08,
  failureReservePercent: 0.12,
  defaultProfitMultiplier: 2,
  paymentProcessingPercent: 0.029,
  paymentProcessingFixedCents: 30,
  taxPercentEstimate: null,
  minimumOrderPriceCents: 500
};

export async function getPricingSettings() {
  const settings = await prisma.pricingSettings.findFirst({ orderBy: { createdAt: "asc" } });
  return settings ?? prisma.pricingSettings.create({ data: { id: "default", ...defaultPricingSettings } });
}

export async function updatePricingSettings(input: Partial<PricingSettingsInput>) {
  const current = await getPricingSettings();
  return prisma.pricingSettings.update({
    where: { id: current.id },
    data: {
      machineHourlyRateCents: input.machineHourlyRateCents,
      laborHourlyRateCents: input.laborHourlyRateCents,
      electricityHourlyRateCents: input.electricityHourlyRateCents,
      maintenanceReservePercent: input.maintenanceReservePercent,
      failureReservePercent: input.failureReservePercent,
      defaultProfitMultiplier: input.defaultProfitMultiplier,
      paymentProcessingPercent: input.paymentProcessingPercent,
      paymentProcessingFixedCents: input.paymentProcessingFixedCents,
      taxPercentEstimate: input.taxPercentEstimate,
      minimumOrderPriceCents: input.minimumOrderPriceCents
    }
  });
}

export async function calculateProductPrice(input: {
  productId: string;
  filamentMaterialId: string;
  quantity?: number;
  shippingRequired?: boolean;
  shippingCents?: number;
}) {
  const [product, settings] = await Promise.all([
    prisma.product.findUniqueOrThrow({
      where: { id: input.productId },
      include: { allowedFilaments: { include: { filamentMaterial: true } } }
    }),
    getPricingSettings()
  ]);
  const allowed = product.allowedFilaments.find((item) => item.filamentMaterialId === input.filamentMaterialId && item.enabled);
  if (!allowed) throw new Error("Selected filament is not enabled for this product.");

  return calculateProductPriceFromRecords({
    product,
    allowed,
    settings,
    quantity: input.quantity,
    shippingRequired: input.shippingRequired,
    shippingCents: input.shippingCents
  });
}

export async function calculateProductPriceOptions(productId: string) {
  const [product, settings] = await Promise.all([
    prisma.product.findUniqueOrThrow({
      where: { id: productId },
      include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true }, orderBy: { createdAt: "asc" } } }
    }),
    getPricingSettings()
  ]);

  return product.allowedFilaments.map((allowed) =>
    calculateProductPriceFromRecords({ product, allowed, settings })
  );
}

export async function calculateProductPricePreview(input: {
  productId?: string | null;
  estimatedGrams: number;
  estimatedPrintMinutes: number;
  baseLaborMinutes: number;
  basePackagingCents: number;
  pricingMode: "FIXED" | "DYNAMIC";
  fixedPriceCents?: number | null;
  filamentMaterialIds: string[];
}) {
  const filamentIds = [...new Set(input.filamentMaterialIds.filter(Boolean))];
  if (!filamentIds.length) return [];
  const [settings, filaments] = await Promise.all([
    getPricingSettings(),
    prisma.filamentSpool.findMany({ where: { id: { in: filamentIds } } })
  ]);

  return filaments.map((filament) => {
    const costPerGramCents = resolveFilamentCostPerGramCents(filament);
    return calculatePriceFromInputs({
      product: {
        id: input.productId ?? "preview",
        estimatedGrams: input.estimatedGrams,
        estimatedPrintMinutes: input.estimatedPrintMinutes,
        baseLaborMinutes: input.baseLaborMinutes,
        basePackagingCents: input.basePackagingCents,
        pricingMode: input.pricingMode,
        fixedPriceCents: input.fixedPriceCents
      },
      filament: {
        id: filament.id,
        costPerGramCents,
        markupMultiplier: filament.markupMultiplier,
        active: filament.active,
        remainingGrams: filament.remainingGrams,
        requiresAdminApproval: filament.requiresAdminApproval
      },
      settings
    });
  });
}

export async function createPricingSnapshot(input: { orderId: string; quote: ProductPriceQuote }) {
  return prisma.orderPricingSnapshot.create({
    data: {
      orderId: input.orderId,
      productId: input.quote.productId,
      filamentMaterialId: input.quote.filamentMaterialId,
      materialCostCents: input.quote.materialCostCents,
      machineTimeCostCents: input.quote.machineTimeCostCents,
      electricityCostCents: input.quote.electricityCostCents,
      laborCostCents: input.quote.laborCostCents,
      packagingCostCents: input.quote.packagingCostCents,
      maintenanceReserveCents: input.quote.maintenanceReserveCents,
      failureReserveCents: input.quote.failureReserveCents,
      subtotalCostCents: input.quote.subtotalCostCents,
      internalCostCents: input.quote.internalCostCents,
      profitMarkupCents: input.quote.profitMarkupCents,
      paymentFeeCents: input.quote.paymentFeeCents,
      taxCents: input.quote.taxCents,
      shippingCents: input.quote.shippingCents,
      finalCustomerPriceCents: input.quote.finalCustomerPriceCents,
      marginCents: input.quote.marginCents,
      marginPercent: input.quote.marginPercent,
      pricingFormulaVersion: input.quote.pricingFormulaVersion
    }
  });
}

type ProductWithAllowed = Prisma.ProductGetPayload<{
  include: { allowedFilaments: { include: { filamentMaterial: true } } };
}>;

type AllowedWithFilament = ProductWithAllowed["allowedFilaments"][number];

function calculateProductPriceFromRecords(input: {
  product: ProductWithAllowed;
  allowed: AllowedWithFilament;
  settings: PricingSettingsInput;
  quantity?: number;
  shippingRequired?: boolean;
  shippingCents?: number;
}) {
  const filament = input.allowed.filamentMaterial;
  const costPerGramCents = resolveFilamentCostPerGramCents(filament);
  return calculatePriceFromInputs({
    product: {
      id: input.product.id,
      estimatedGrams: input.product.estimatedGrams,
      estimatedPrintMinutes: input.product.estimatedPrintMinutes,
      baseLaborMinutes: input.product.baseLaborMinutes,
      basePackagingCents: input.product.basePackagingCents,
      pricingMode: input.product.pricingMode,
      fixedPriceCents: input.product.fixedPriceCents ?? input.product.priceCents
    },
    filament: {
      id: filament.id,
      costPerGramCents,
      markupMultiplier: filament.markupMultiplier,
      active: filament.active,
      remainingGrams: filament.remainingGrams,
      requiresAdminApproval: filament.requiresAdminApproval
    },
    settings: input.settings,
    override: input.allowed,
    quantity: input.quantity,
    shippingRequired: input.shippingRequired,
    shippingCents: input.shippingCents
  });
}

function resolveFilamentCostPerGramCents(filament: {
  costPerGramCents: number;
  costPerSpoolCents: number;
  rollCostCents: number;
  spoolWeightGrams: number;
  startingGrams: number;
}) {
  return filament.costPerGramCents || (filament.costPerSpoolCents || filament.rollCostCents) / Math.max(1, filament.spoolWeightGrams || filament.startingGrams || 1000);
}
