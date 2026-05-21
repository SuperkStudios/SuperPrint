export type RewardsSettingsInput = {
  pointsPerDollar: number;
  redemptionPointsPerDollar: number;
  maxDiscountPercent: number;
  minimumRedemptionPoints: number;
  earnOnDiscountedAmount: boolean;
  includeShippingInEarnBasis: boolean;
  reservationTtlMinutes: number;
};

export type RewardPreset = {
  id: string;
  label: string;
  description: string;
  points: number;
  kind: "AMOUNT_OFF" | "PERCENT_OFF" | "FREE_SHIPPING";
  valueCents?: number;
  percent?: number;
};

export const MINIMUM_POST_REWARD_SUBTOTAL_CENTS = 500;

export const rewardPresets: RewardPreset[] = [
  { id: "amount-100", label: "$1 off", description: "Take $1 off a product order.", points: 100, kind: "AMOUNT_OFF", valueCents: 100 },
  { id: "amount-250", label: "$2.50 off", description: "Take $2.50 off a product order.", points: 250, kind: "AMOUNT_OFF", valueCents: 250 },
  { id: "amount-500", label: "$5 off", description: "Take $5 off a product order.", points: 500, kind: "AMOUNT_OFF", valueCents: 500 },
  { id: "amount-1000", label: "$10 off", description: "Take $10 off a product order.", points: 1000, kind: "AMOUNT_OFF", valueCents: 1000 },
  { id: "percent-10", label: "10% off", description: "Take 10% off a product order.", points: 500, kind: "PERCENT_OFF", percent: 0.1 },
  { id: "percent-20", label: "20% off", description: "Take 20% off a product order.", points: 1000, kind: "PERCENT_OFF", percent: 0.2 },
  { id: "free-shipping", label: "Free shipping", description: "Use points to cover standard shipping.", points: 750, kind: "FREE_SHIPPING" }
];

export const defaultRewardsSettings: RewardsSettingsInput = {
  pointsPerDollar: 10,
  redemptionPointsPerDollar: 100,
  maxDiscountPercent: 0.2,
  minimumRedemptionPoints: 500,
  earnOnDiscountedAmount: true,
  includeShippingInEarnBasis: false,
  reservationTtlMinutes: 60
};

export function rewardSettingKeys() {
  return [
    "rewards.pointsPerDollar",
    "rewards.redemptionPointsPerDollar",
    "rewards.maxDiscountPercent",
    "rewards.minimumRedemptionPoints",
    "rewards.earnOnDiscountedAmount",
    "rewards.includeShippingInEarnBasis",
    "rewards.reservationTtlMinutes"
  ];
}

export function resolveRewardsSettings(settings: Record<string, unknown> = {}) {
  return {
    pointsPerDollar: positiveNumber(settings["rewards.pointsPerDollar"], defaultRewardsSettings.pointsPerDollar),
    redemptionPointsPerDollar: positiveNumber(settings["rewards.redemptionPointsPerDollar"], defaultRewardsSettings.redemptionPointsPerDollar),
    maxDiscountPercent: percent(settings["rewards.maxDiscountPercent"], defaultRewardsSettings.maxDiscountPercent),
    minimumRedemptionPoints: nonNegativeInteger(settings["rewards.minimumRedemptionPoints"], defaultRewardsSettings.minimumRedemptionPoints),
    earnOnDiscountedAmount: booleanSetting(settings["rewards.earnOnDiscountedAmount"], defaultRewardsSettings.earnOnDiscountedAmount),
    includeShippingInEarnBasis: booleanSetting(settings["rewards.includeShippingInEarnBasis"], defaultRewardsSettings.includeShippingInEarnBasis),
    reservationTtlMinutes: positiveNumber(settings["rewards.reservationTtlMinutes"], defaultRewardsSettings.reservationTtlMinutes)
  } satisfies RewardsSettingsInput;
}

export function buildRewardsSettingsUpdate(input: Partial<RewardsSettingsInput>) {
  const updates: Record<string, number | boolean> = {};
  if (typeof input.pointsPerDollar === "number") updates["rewards.pointsPerDollar"] = Math.max(0, input.pointsPerDollar);
  if (typeof input.redemptionPointsPerDollar === "number") updates["rewards.redemptionPointsPerDollar"] = Math.max(1, input.redemptionPointsPerDollar);
  if (typeof input.maxDiscountPercent === "number") updates["rewards.maxDiscountPercent"] = Math.max(0, input.maxDiscountPercent);
  if (typeof input.minimumRedemptionPoints === "number") updates["rewards.minimumRedemptionPoints"] = Math.max(0, Math.round(input.minimumRedemptionPoints));
  if (typeof input.earnOnDiscountedAmount === "boolean") updates["rewards.earnOnDiscountedAmount"] = input.earnOnDiscountedAmount;
  if (typeof input.includeShippingInEarnBasis === "boolean") updates["rewards.includeShippingInEarnBasis"] = input.includeShippingInEarnBasis;
  if (typeof input.reservationTtlMinutes === "number") updates["rewards.reservationTtlMinutes"] = Math.max(1, input.reservationTtlMinutes);
  return updates;
}

export function calculateRewardRedemption(input: {
  userBalance: number;
  productSubtotalCents: number;
  shippingCents?: number;
  rewardId?: string | null;
  requestedPoints?: number | null;
  settings?: RewardsSettingsInput;
}) {
  const settings = input.settings ?? defaultRewardsSettings;
  const preset = resolveRewardPreset(input.rewardId, input.requestedPoints);
  const requestedPoints = preset?.points ?? Math.max(0, Math.floor(input.requestedPoints ?? 0));
  if (!requestedPoints) return emptyRedemption("No rewards requested.");
  if (!preset && requestedPoints < settings.minimumRedemptionPoints) return emptyRedemption(`Redeem at least ${settings.minimumRedemptionPoints} points.`);
  if (requestedPoints > input.userBalance) {
    return emptyRedemption("Not enough rewards points.");
  }

  const maxProductDiscountCents = Math.max(0, input.productSubtotalCents - MINIMUM_POST_REWARD_SUBTOTAL_CENTS);
  if (preset?.kind === "FREE_SHIPPING") {
    const shippingDiscountCents = Math.max(0, Math.round(input.shippingCents ?? 0));
    if (shippingDiscountCents <= 0) return emptyRedemption("Free shipping can only be used on shipped orders with a shipping charge.");
    return {
      pointsRedeemed: preset.points,
      discountCents: shippingDiscountCents,
      productDiscountCents: 0,
      shippingDiscountCents,
      maxDiscountCents: shippingDiscountCents,
      rewardId: preset.id,
      error: null
    };
  }

  const requestedDiscountCents = preset?.kind === "AMOUNT_OFF"
    ? preset.valueCents ?? 0
    : preset?.kind === "PERCENT_OFF"
      ? Math.floor(Math.max(0, input.productSubtotalCents) * (preset.percent ?? 0))
      : Math.floor((requestedPoints / settings.redemptionPointsPerDollar) * 100);
  const productDiscountCents = Math.min(requestedDiscountCents, maxProductDiscountCents);
  if (productDiscountCents <= 0) return emptyRedemption("Rewards require at least a $5 product subtotal after discount.");

  const pointsRedeemed = preset?.points ?? Math.min(requestedPoints, Math.ceil((productDiscountCents / 100) * settings.redemptionPointsPerDollar));
  if (!preset && pointsRedeemed < settings.minimumRedemptionPoints) return emptyRedemption(`Redeem at least ${settings.minimumRedemptionPoints} points.`);

  return {
    pointsRedeemed,
    discountCents: productDiscountCents,
    productDiscountCents,
    shippingDiscountCents: 0,
    maxDiscountCents: maxProductDiscountCents,
    rewardId: preset?.id ?? null,
    error: null
  };
}

export function calculateRewardEarnedPoints(input: {
  paidProductSubtotalCents: number;
  shippingCents?: number;
  settings?: RewardsSettingsInput;
}) {
  const settings = input.settings ?? defaultRewardsSettings;
  const earnBasisCents = Math.max(0, Math.round(input.paidProductSubtotalCents + (settings.includeShippingInEarnBasis ? input.shippingCents ?? 0 : 0)));
  return Math.floor((earnBasisCents / 100) * settings.pointsPerDollar);
}

function emptyRedemption(error: string) {
  return {
    pointsRedeemed: 0,
    discountCents: 0,
    productDiscountCents: 0,
    shippingDiscountCents: 0,
    maxDiscountCents: 0,
    rewardId: null,
    error
  };
}

export function resolveRewardPreset(rewardId?: string | null, requestedPoints?: number | null) {
  if (rewardId) return rewardPresets.find((preset) => preset.id === rewardId) ?? null;
  const points = Math.max(0, Math.floor(requestedPoints ?? 0));
  return rewardPresets.find((preset) => preset.kind === "AMOUNT_OFF" && preset.points === points) ?? null;
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function percent(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return value > 1 ? value / 100 : value;
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}
