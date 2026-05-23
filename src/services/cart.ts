import { Prisma } from "@prisma/client";
import { normalizePercent, stripeStandardPaymentProcessingFixedCents, stripeStandardPaymentProcessingPercent } from "@/domain/pricing";
import { MINIMUM_POST_REWARD_SUBTOTAL_CENTS } from "@/domain/rewards";
import { prisma } from "@/lib/prisma";
import { getPricingSettings, calculateProductPrice } from "@/services/pricing";

export type CartFulfillment = {
  method: "SHIP" | "PICKUP";
  address?: {
    name?: string | null;
    street1?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

export type CartSummary = Awaited<ReturnType<typeof summarizeCart>>;

const cartInclude = {
  items: {
    include: {
      product: { include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } } },
      selectedFilamentMaterial: true
    },
    orderBy: { createdAt: "asc" as const }
  }
};

export async function getOrCreateActiveCart(userId: string) {
  const existing = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: cartInclude
  });
  if (existing) return existing;
  return prisma.cart.create({
    data: { userId },
    include: cartInclude
  });
}

export async function getActiveCart(userId: string) {
  return prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: cartInclude
  });
}

export async function addCartItem(input: {
  userId: string;
  productId: string;
  quantity?: number;
  selectedFilamentMaterialId?: string | null;
  selectedFilamentMaterialIds?: string[];
  selectedMaterial?: string | null;
  selectedColor?: string | null;
  selectedColors?: string[];
}) {
  const cart = await getOrCreateActiveCart(input.userId);
  const product = await prisma.product.findFirstOrThrow({
    where: { id: input.productId, status: "ACTIVE" },
    include: { allowedFilaments: { where: { enabled: true }, include: { filamentMaterial: true } } }
  });
  const selectedFilaments = resolveSelectedFilaments(product, input.selectedFilamentMaterialIds ?? (input.selectedFilamentMaterialId ? [input.selectedFilamentMaterialId] : undefined));
  const selected = selectedFilaments[0];
  const selectedIds = selectedFilaments.map((item) => item.filamentMaterialId);
  const selectedColors = selectedFilaments.map((item, index) => input.selectedColors?.[index] ?? item.filamentMaterial.color);
  const quantity = clampQuantity(input.quantity);
  const existing = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: product.id,
      selectedFilamentMaterialId: selected.filamentMaterialId,
      selectedFilamentMaterialIds: { equals: selectedIds as Prisma.InputJsonValue }
    }
  });
  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: clampQuantity(existing.quantity + quantity) }
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        quantity,
        selectedFilamentMaterialId: selected.filamentMaterialId,
        selectedFilamentMaterialIds: selectedIds,
        selectedColors,
        selectedMaterial: (input.selectedMaterial ?? selected.filamentMaterial.material) as never,
        selectedColor: input.selectedColor ?? selectedColors[0] ?? selected.filamentMaterial.color
      }
    });
  }
  return summarizeCart(input.userId);
}

export async function updateCartItem(input: { userId: string; itemId: string; quantity: number }) {
  const cart = await getActiveCart(input.userId);
  if (!cart) throw new Error("Cart is empty.");
  const item = cart.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new Error("Cart item not found.");
  if (input.quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: input.itemId } });
  } else {
    await prisma.cartItem.update({ where: { id: input.itemId }, data: { quantity: clampQuantity(input.quantity) } });
  }
  return summarizeCart(input.userId);
}

export async function removeCartItem(input: { userId: string; itemId: string }) {
  const cart = await getActiveCart(input.userId);
  if (!cart?.items.some((item) => item.id === input.itemId)) throw new Error("Cart item not found.");
  await prisma.cartItem.delete({ where: { id: input.itemId } });
  return summarizeCart(input.userId);
}

export async function clearActiveCart(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const cart = await tx.cart.findFirst({ where: { userId, status: "ACTIVE" } });
  if (!cart) return null;
  return tx.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT" } });
}

export async function summarizeCart(userId: string, input: { shippingCents?: number; rewardDiscountCents?: number } = {}) {
  const [cart, settings] = await Promise.all([getActiveCart(userId), getPricingSettings()]);
  const items = [];
  let subtotalCents = 0;
  let estimatedGrams = 0;
  let estimatedPrintMinutes = 0;

  for (const item of cart?.items ?? []) {
    const selectedFilaments = resolveSelectedFilaments(item.product, jsonStringArray(item.selectedFilamentMaterialIds).length ? jsonStringArray(item.selectedFilamentMaterialIds) : item.selectedFilamentMaterialId ? [item.selectedFilamentMaterialId] : undefined);
    const selected = selectedFilaments[0];
    const selectedIds = selectedFilaments.map((allowed) => allowed.filamentMaterialId);
    const selectedColors = jsonStringArray(item.selectedColors).length ? jsonStringArray(item.selectedColors) : selectedFilaments.map((allowed) => allowed.filamentMaterial.color);
    const quote = await calculateProductPrice({
      productId: item.productId,
      filamentMaterialId: selected.filamentMaterialId,
      quantity: item.quantity,
      shippingRequired: false
    });
    if (quote.unavailableReason) throw new Error(`${item.product.name}: ${quote.unavailableReason}`);
    if (quote.requiresAdminApproval) throw new Error(`${item.product.name}: selected filament requires approval.`);
    const lineSubtotalCents = quote.priceBeforeTaxAndFeesCents;
    subtotalCents += lineSubtotalCents;
    estimatedGrams += quote.estimatedGrams * item.quantity;
    estimatedPrintMinutes += quote.estimatedPrintMinutes * item.quantity;
    items.push({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      slug: item.product.slug,
      imageUrl: item.product.imageUrl,
      quantity: item.quantity,
      selectedFilamentMaterialId: selected.filamentMaterialId,
      selectedFilamentMaterialIds: selectedIds,
      selectedMaterial: item.selectedMaterial ?? selected.filamentMaterial.material,
      selectedColor: item.selectedColor ?? selectedColors[0] ?? selected.filamentMaterial.color,
      selectedColors,
      unitPriceCents: Math.round(lineSubtotalCents / item.quantity),
      subtotalCents: lineSubtotalCents,
      estimatedGrams: quote.estimatedGrams,
      estimatedPrintMinutes: quote.estimatedPrintMinutes,
      quote
    });
  }

  const rewardDiscountCents = Math.min(input.rewardDiscountCents ?? 0, Math.max(0, subtotalCents - MINIMUM_POST_REWARD_SUBTOTAL_CENTS));
  const taxableSubtotalCents = Math.max(0, subtotalCents - rewardDiscountCents);
  const taxCents = Math.round(taxableSubtotalCents * normalizePercent(settings.taxPercentEstimate));
  const shippingCents = Math.max(0, Math.round(input.shippingCents ?? 0));
  const beforeFeeCents = taxableSubtotalCents + taxCents + shippingCents;
  const paymentFeeCents = calculatePaymentProcessorFee(beforeFeeCents);
  const totalCents = beforeFeeCents + paymentFeeCents;

  return {
    cartId: cart?.id ?? null,
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalCents,
    rewardDiscountCents,
    taxCents,
    shippingCents,
    paymentFeeCents,
    totalCents,
    estimatedGrams,
    estimatedPrintMinutes
  };
}

export function calculatePaymentProcessorFee(
  baseCents: number,
  percentValue = stripeStandardPaymentProcessingPercent,
  fixedCents = stripeStandardPaymentProcessingFixedCents
) {
  if (baseCents <= 0) return 0;
  const percent = normalizePercent(percentValue);
  if (percent <= 0) return Math.max(0, Math.round(fixedCents));
  return Math.max(0, Math.round((baseCents * percent + fixedCents) / Math.max(0.01, 1 - percent)));
}

function clampQuantity(quantity?: number | null) {
  return Math.min(20, Math.max(1, Math.round(quantity ?? 1)));
}

function resolveSelectedFilament(
  product: Prisma.ProductGetPayload<{ include: { allowedFilaments: { include: { filamentMaterial: true } } } }>,
  selectedFilamentMaterialId?: string | null
) {
  const selected = selectedFilamentMaterialId
    ? product.allowedFilaments.find((item) => item.filamentMaterialId === selectedFilamentMaterialId)
    : product.allowedFilaments.find((item) => item.filamentMaterialId === product.defaultFilamentMaterialId) ?? product.allowedFilaments[0];
  if (!selected) throw new Error("No enabled filament is available for this product.");
  return selected;
}

function resolveSelectedFilaments(
  product: Prisma.ProductGetPayload<{ include: { allowedFilaments: { include: { filamentMaterial: true } } } }>,
  selectedFilamentMaterialIds?: string[] | null
) {
  const slotCount = Math.max(1, Math.min(6, product.colorSlotCount ?? 1));
  const ids = selectedFilamentMaterialIds?.filter(Boolean).slice(0, slotCount) ?? [];
  const fallback = resolveSelectedFilament(product, ids[0]);
  const selected = Array.from({ length: slotCount }, (_, index) => {
    const id = ids[index] ?? fallback.filamentMaterialId;
    return resolveSelectedFilament(product, id);
  });
  return selected;
}

function jsonStringArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}
