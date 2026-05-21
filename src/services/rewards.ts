import { Prisma } from "@prisma/client";
import {
  calculateRewardEarnedPoints,
  calculateRewardRedemption,
  defaultRewardsSettings,
  rewardPresets,
  resolveRewardsSettings,
  resolveRewardPreset,
  rewardSettingKeys,
  type RewardsSettingsInput
} from "@/domain/rewards";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

export async function getRewardsSettings() {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: rewardSettingKeys() } } });
  return resolveRewardsSettings(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
}

export async function getRewardsSummary(userId: string) {
  await releaseExpiredRewardReservations(userId);
  const [user, settings, transactions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { rewardsPointsBalance: true } }),
    getRewardsSettings(),
    prisma.rewardTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);
  return {
    balance: user.rewardsPointsBalance,
    redeemableCents: Math.floor((user.rewardsPointsBalance / settings.redemptionPointsPerDollar) * 100),
    settings,
    rewardPresets,
    activeRedemptions: transactions.filter((transaction) => transaction.type === "REDEEM_RESERVED" && transaction.status === "PENDING" && !transaction.orderId),
    transactions
  };
}

export async function previewRewardRedemption(input: {
  userId: string;
  productSubtotalCents: number;
  shippingCents?: number;
  rewardId?: string | null;
  requestedPoints?: number | null;
  settings?: RewardsSettingsInput;
}) {
  const [user, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { rewardsPointsBalance: true } }),
    input.settings ? Promise.resolve(input.settings) : getRewardsSettings()
  ]);
  return calculateRewardRedemption({
    userBalance: user.rewardsPointsBalance,
    productSubtotalCents: input.productSubtotalCents,
    shippingCents: input.shippingCents,
    rewardId: input.rewardId,
    requestedPoints: input.requestedPoints,
    settings
  });
}

export async function reserveRewardPoints(input: {
  tx: Tx;
  userId: string;
  orderId: string;
  productSubtotalCents: number;
  shippingCents?: number;
  rewardId?: string | null;
  requestedPoints?: number | null;
  settings?: RewardsSettingsInput;
}) {
  const selectedPreset = resolveRewardPreset(input.rewardId, input.requestedPoints);
  const requestedPoints = selectedPreset?.points ?? Math.max(0, Math.floor(input.requestedPoints ?? 0));
  if (!requestedPoints) return { pointsRedeemed: 0, discountCents: 0 };

  const settings = input.settings ?? defaultRewardsSettings;
  const user = await input.tx.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { rewardsPointsBalance: true }
  });
  const redemption = calculateRewardRedemption({
    userBalance: user.rewardsPointsBalance,
    productSubtotalCents: input.productSubtotalCents,
    shippingCents: input.shippingCents,
    rewardId: selectedPreset?.id ?? input.rewardId,
    requestedPoints,
    settings
  });
  if (redemption.error) throw new Error(redemption.error);

  await input.tx.user.update({
    where: { id: input.userId },
    data: { rewardsPointsBalance: { decrement: redemption.pointsRedeemed } }
  });
  await input.tx.rewardTransaction.create({
    data: {
      userId: input.userId,
      orderId: input.orderId,
      type: "REDEEM_RESERVED",
      status: "PENDING",
      points: -redemption.pointsRedeemed,
      centsBasis: redemption.discountCents,
      description: `${selectedPreset?.label ?? formatCents(redemption.discountCents)} checkout reward reserved. ${rewardDescriptionTag(selectedPreset?.id ?? redemption.rewardId)}`,
      expiresAt: new Date(Date.now() + settings.reservationTtlMinutes * 60 * 1000)
    }
  });

  return {
    pointsRedeemed: redemption.pointsRedeemed,
    discountCents: redemption.discountCents
  };
}

export async function createRewardRedemption(input: { userId: string; requestedPoints?: number; rewardId?: string }) {
  await releaseExpiredRewardReservations(input.userId);
  const selectedPreset = resolveRewardPreset(input.rewardId, input.requestedPoints);
  if (!selectedPreset) throw new Error("Choose one of the available rewards.");
  const requestedPoints = selectedPreset.points;
  const discountCents = selectedPreset.kind === "AMOUNT_OFF" ? selectedPreset.valueCents ?? 0 : 0;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { rewardsPointsBalance: true }
    });
    const activeReservations = await tx.rewardTransaction.findMany({
      where: {
        userId: input.userId,
        type: "REDEEM_RESERVED",
        status: "PENDING",
        orderId: null
      }
    });
    const pointsToReturn = activeReservations.reduce((total, reservation) => total + Math.abs(reservation.points), 0);
    if (requestedPoints > user.rewardsPointsBalance + pointsToReturn) throw new Error("Not enough rewards points.");
    if (activeReservations.length) {
      await tx.rewardTransaction.updateMany({
        where: { id: { in: activeReservations.map((reservation) => reservation.id) } },
        data: {
          status: "VOID",
          finalizedAt: new Date(),
          description: "Replaced by a newer active checkout reward."
        }
      });
      await tx.rewardTransaction.createMany({
        data: activeReservations.map((reservation) => ({
          userId: input.userId,
          type: "RESERVATION_RELEASED" as const,
          status: "POSTED" as const,
          points: Math.abs(reservation.points),
          centsBasis: reservation.centsBasis,
          description: "Previous checkout reward returned before activating a new one.",
          finalizedAt: new Date()
        }))
      });
    }

    await tx.user.update({
      where: { id: input.userId },
      data: { rewardsPointsBalance: { increment: pointsToReturn - requestedPoints } }
    });
    return tx.rewardTransaction.create({
      data: {
        userId: input.userId,
        type: "REDEEM_RESERVED",
        status: "PENDING",
        points: -requestedPoints,
        centsBasis: discountCents,
        description: `${selectedPreset.label} checkout reward created. ${rewardDescriptionTag(selectedPreset.id)}`,
        expiresAt: null
      }
    });
  });
}

export async function releaseRewardRedemption(input: { userId: string; rewardTransactionId: string }) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.rewardTransaction.findFirst({
      where: {
        id: input.rewardTransactionId,
        userId: input.userId,
        type: "REDEEM_RESERVED",
        status: "PENDING",
        orderId: null
      }
    });
    if (!reservation) throw new Error("Only unused reward coupons can be unredeemed.");

    await tx.rewardTransaction.update({
      where: { id: reservation.id },
      data: {
        status: "VOID",
        finalizedAt: new Date(),
        description: `${reservation.description} Unredeemed back to points.`
      }
    });
    await tx.user.update({
      where: { id: input.userId },
      data: { rewardsPointsBalance: { increment: Math.abs(reservation.points) } }
    });
    return tx.rewardTransaction.create({
      data: {
        userId: input.userId,
        type: "RESERVATION_RELEASED",
        status: "POSTED",
        points: Math.abs(reservation.points),
        centsBasis: reservation.centsBasis,
        description: "Unused checkout reward returned to points.",
        finalizedAt: new Date()
      }
    });
  });
}

export async function applyRewardRedemptionToOrder(input: {
  tx: Tx;
  userId: string;
  orderId: string;
  productSubtotalCents: number;
  shippingCents?: number;
  settings?: RewardsSettingsInput;
}) {
  const settings = input.settings ?? defaultRewardsSettings;
  const reservation = await input.tx.rewardTransaction.findFirst({
    where: {
      userId: input.userId,
      type: "REDEEM_RESERVED",
      status: "PENDING",
      orderId: null
    },
    orderBy: { createdAt: "desc" }
  });
  if (!reservation) return { pointsRedeemed: 0, discountCents: 0, productDiscountCents: 0, shippingDiscountCents: 0 };

  const pointsRedeemed = Math.abs(reservation.points);
  const rewardId = rewardIdFromDescription(reservation.description);
  const redemption = calculateRewardRedemption({
    userBalance: pointsRedeemed,
    productSubtotalCents: input.productSubtotalCents,
    shippingCents: input.shippingCents,
    rewardId,
    requestedPoints: pointsRedeemed,
    settings
  });
  if (redemption.error) return { pointsRedeemed: 0, discountCents: 0, productDiscountCents: 0, shippingDiscountCents: 0 };

  await input.tx.rewardTransaction.update({
    where: { id: reservation.id },
    data: {
      orderId: input.orderId,
      centsBasis: redemption.discountCents,
      description: `${rewardLabel(rewardId, redemption.discountCents)} checkout reward applied. ${rewardDescriptionTag(rewardId)}`,
      expiresAt: new Date(Date.now() + settings.reservationTtlMinutes * 60 * 1000)
    }
  });
  return {
    pointsRedeemed,
    discountCents: redemption.discountCents,
    productDiscountCents: redemption.productDiscountCents,
    shippingDiscountCents: redemption.shippingDiscountCents
  };
}

export async function finalizeRewardRedemption(input: { tx: Tx; orderId: string; userId: string }) {
  const reservation = await input.tx.rewardTransaction.findFirst({
    where: {
      orderId: input.orderId,
      userId: input.userId,
      type: "REDEEM_RESERVED",
      status: "PENDING"
    }
  });
  if (!reservation) return null;
  return input.tx.rewardTransaction.update({
    where: { id: reservation.id },
    data: {
      type: "REDEEMED",
      status: "POSTED",
      finalizedAt: new Date(),
      description: `Redeemed ${Math.abs(reservation.points)} points for ${formatCents(reservation.centsBasis)} off.`
    }
  });
}

export async function awardOrderPoints(input: {
  tx: Tx;
  orderId: string;
  userId: string;
  paidProductSubtotalCents: number;
  shippingCents?: number;
  settings?: RewardsSettingsInput;
}) {
  const existing = await input.tx.rewardTransaction.findFirst({
    where: { orderId: input.orderId, userId: input.userId, type: "EARNED", status: "POSTED" }
  });
  if (existing) return existing;
  const redeemed = await input.tx.rewardTransaction.findFirst({
    where: { orderId: input.orderId, userId: input.userId, type: "REDEEMED", status: "POSTED" }
  });
  if (redeemed) {
    await input.tx.order.update({ where: { id: input.orderId }, data: { rewardPointsEarned: 0 } });
    return null;
  }

  const settings = input.settings ?? defaultRewardsSettings;
  const points = calculateRewardEarnedPoints({
    paidProductSubtotalCents: input.paidProductSubtotalCents,
    shippingCents: input.shippingCents,
    settings
  });
  if (points <= 0) return null;

  await input.tx.user.update({
    where: { id: input.userId },
    data: { rewardsPointsBalance: { increment: points } }
  });
  await input.tx.order.update({
    where: { id: input.orderId },
    data: { rewardPointsEarned: points }
  });
  return input.tx.rewardTransaction.create({
    data: {
      userId: input.userId,
      orderId: input.orderId,
      type: "EARNED",
      status: "POSTED",
      points,
      centsBasis: input.paidProductSubtotalCents,
      description: `Earned ${points} points from this order.`,
      finalizedAt: new Date()
    }
  });
}

export async function releaseExpiredRewardReservations(userId?: string) {
  const expired = await prisma.rewardTransaction.findMany({
    where: {
      ...(userId ? { userId } : {}),
      type: "REDEEM_RESERVED",
      status: "PENDING",
      expiresAt: { lt: new Date() }
    }
  });
  if (!expired.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const reservation of expired) {
      await tx.rewardTransaction.update({
        where: { id: reservation.id },
        data: {
          status: "VOID",
          finalizedAt: new Date(),
          description: `${reservation.description} Released after checkout expired.`
        }
      });
      await tx.user.update({
        where: { id: reservation.userId },
        data: { rewardsPointsBalance: { increment: Math.abs(reservation.points) } }
      });
      await tx.rewardTransaction.create({
        data: {
          userId: reservation.userId,
          orderId: reservation.orderId,
          type: "RESERVATION_RELEASED",
          status: "POSTED",
          points: Math.abs(reservation.points),
          centsBasis: reservation.centsBasis,
          description: "Released expired checkout reward reservation.",
          finalizedAt: new Date()
        }
      });
    }
  });
  return expired.length;
}

function formatCents(cents: number) {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

function rewardDescriptionTag(rewardId?: string | null) {
  return rewardId ? `[reward:${rewardId}]` : "";
}

function rewardIdFromDescription(description: string) {
  return /\[reward:([a-z0-9-]+)\]/i.exec(description)?.[1] ?? null;
}

function rewardLabel(rewardId: string | null, discountCents: number) {
  const preset = resolveRewardPreset(rewardId);
  return preset?.label ?? formatCents(discountCents);
}
