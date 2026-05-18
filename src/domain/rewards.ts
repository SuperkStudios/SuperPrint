export type RewardsSettingsInput = {
  pointsPerDollar: number;
  redemptionPointsPerDollar: number;
  maxDiscountPercent: number;
  minimumRedemptionPoints: number;
  earnOnDiscountedAmount: boolean;
  includeShippingInEarnBasis: boolean;
  reservationTtlMinutes: number;
};

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
  requestedPoints?: number | null;
  settings?: RewardsSettingsInput;
}) {
  const settings = input.settings ?? defaultRewardsSettings;
  const requestedPoints = Math.max(0, Math.floor(input.requestedPoints ?? 0));
  if (!requestedPoints) return emptyRedemption("No rewards requested.");
  if (requestedPoints < settings.minimumRedemptionPoints) {
    return emptyRedemption(`Redeem at least ${settings.minimumRedemptionPoints} points.`);
  }
  if (requestedPoints > input.userBalance) {
    return emptyRedemption("Not enough rewards points.");
  }

  const maxDiscountCents = Math.floor(Math.max(0, input.productSubtotalCents) * settings.maxDiscountPercent);
  const requestedDiscountCents = Math.floor((requestedPoints / settings.redemptionPointsPerDollar) * 100);
  const discountCents = Math.min(maxDiscountCents, requestedDiscountCents, Math.max(0, input.productSubtotalCents - 1));
  if (discountCents <= 0) return emptyRedemption("Rewards cannot reduce this order.");

  const pointsRedeemed = Math.min(requestedPoints, Math.ceil((discountCents / 100) * settings.redemptionPointsPerDollar));
  if (pointsRedeemed < settings.minimumRedemptionPoints) {
    return emptyRedemption(`Redeem at least ${settings.minimumRedemptionPoints} points.`);
  }

  return {
    pointsRedeemed,
    discountCents,
    maxDiscountCents,
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
    maxDiscountCents: 0,
    error
  };
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
