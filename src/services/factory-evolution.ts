import { Prisma } from "@prisma/client";
import { factoryProgressPercent, milestoneProgressPercent, publicSupporterName } from "@/domain/factory-evolution";
import { prisma } from "@/lib/prisma";
import { recordPlatformEvent } from "@/services/events";

type Tx = Prisma.TransactionClient;

export async function getPublicFactoryEvolution() {
  const [goals, platformStats, milestones, unlockedUpgrades, activity, tiers, supporterCount] = await Promise.all([
    prisma.factoryUpgradeGoal.findMany({
      where: { visibility: "public", status: { not: "cancelled" } },
      orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
      take: 12
    }),
    getLiveFactoryStats(),
    prisma.factoryMilestone.findMany({
      where: { visibility: "public" },
      orderBy: [{ completed: "asc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
      take: 10
    }),
    prisma.factoryUnlockedUpgrade.findMany({
      where: { public: true },
      orderBy: [{ displayOrder: "asc" }, { unlockedAt: "desc" }],
      take: 8
    }),
    prisma.factoryActivityEvent.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      take: 16
    }),
    prisma.supporterTier.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { oneTimePriceCents: "asc" }]
    }),
    prisma.userSupporterProfile.count()
  ]);

  return {
    goals: goals.map((goal) => ({
      ...goal,
      unlockBenefits: jsonArray(goal.unlockBenefits),
      progressPercent: factoryProgressPercent(goal.currentAmountCents, goal.targetAmountCents)
    })),
    stats: platformStats,
    milestones: milestones.map((milestone) => ({
      ...milestone,
      progressPercent: milestoneProgressPercent(milestone.currentValue, milestone.targetValue)
    })),
    unlockedUpgrades,
    activity,
    tiers: tiers.map((tier) => ({ ...tier, perks: jsonArray(tier.perks) })),
    supporterCount
  };
}

export async function getAdminFactoryEvolution() {
  const [goals, stats, milestones, unlockedUpgrades, tiers, activity] = await Promise.all([
    prisma.factoryUpgradeGoal.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }),
    getLiveFactoryStats(),
    prisma.factoryMilestone.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.factoryUnlockedUpgrade.findMany({ orderBy: [{ displayOrder: "asc" }, { unlockedAt: "desc" }] }),
    prisma.supporterTier.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.factoryActivityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 })
  ]);

  return {
    goals: goals.map((goal) => ({ ...goal, unlockBenefits: jsonArray(goal.unlockBenefits) })),
    stats,
    milestones,
    unlockedUpgrades,
    tiers: tiers.map((tier) => ({ ...tier, perks: jsonArray(tier.perks) })),
    activity
  };
}

export async function applyFactoryContribution(input: {
  userId: string;
  goalId: string;
  amountCents: number;
  message?: string;
  anonymous?: boolean;
  paymentStatus?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
}) {
  if (input.stripeCheckoutSessionId) {
    const existing = await prisma.factoryContribution.findUnique({
      where: { stripeCheckoutSessionId: input.stripeCheckoutSessionId },
      include: { goal: true }
    });
    if (existing) return { contribution: existing, goal: existing.goal };
  }

  const result = await prisma.$transaction(async (tx) => {
    const contribution = await tx.factoryContribution.create({
      data: {
        userId: input.userId,
        goalId: input.goalId,
        amountCents: input.amountCents,
        message: input.message,
        anonymous: input.anonymous ?? false,
        paymentStatus: input.paymentStatus ?? "manual",
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId
      },
      include: { user: true, goal: true }
    });
    const goal = await updateGoalProgress(tx, input.goalId);
    const supporterName = publicSupporterName({
      anonymous: input.anonymous,
      name: contribution.user.name,
      username: contribution.user.username,
      email: contribution.user.email
    });

    await tx.userSupporterProfile.upsert({
      where: { userId: input.userId },
      update: {
        lifetimeContributionCents: { increment: input.amountCents },
        queuePriorityMultiplier: 1.03
      },
      create: {
        userId: input.userId,
        lifetimeContributionCents: input.amountCents,
        badges: ["Factory Supporter"],
        queuePriorityMultiplier: 1.03
      }
    });

    await tx.factoryActivityEvent.create({
      data: {
        type: "CONTRIBUTION_CREATED",
        title: `${supporterName} backed ${goal.title}`,
        body: input.message?.trim() || null,
        goalId: goal.id,
        actorName: supporterName,
        amountCents: input.amountCents,
        public: true,
        metadata: { contributionId: contribution.id }
      }
    });

    if (goal.status === "funded") {
      await tx.factoryActivityEvent.create({
        data: {
          type: "GOAL_FUNDED",
          title: `${goal.title} reached its unlock target`,
          goalId: goal.id,
          public: true,
          metadata: { progressPercent: 100 }
        }
      });
    }

    return { contribution, goal };
  });

  await recordPlatformEvent({
    type: "FACTORY_CONTRIBUTION_CREATED",
    actorId: input.userId,
    payload: {
      goalId: result.goal.id,
      goalTitle: result.goal.title,
      amountCents: input.amountCents,
      anonymous: input.anonymous ?? false
    }
  });
  if (result.goal.status === "funded") {
    await recordPlatformEvent({
      type: "FACTORY_GOAL_FUNDED",
      actorId: input.userId,
      payload: { goalId: result.goal.id, goalTitle: result.goal.title }
    });
  }
  return result;
}

export async function updateGoalProgress(tx: Tx, goalId: string) {
  const aggregate = await tx.factoryContribution.aggregate({
    where: { goalId, paymentStatus: { in: ["manual", "paid", "succeeded"] } },
    _sum: { amountCents: true },
    _count: { id: true }
  });
  const existing = await tx.factoryUpgradeGoal.findUniqueOrThrow({ where: { id: goalId } });
  const currentAmountCents = aggregate._sum.amountCents ?? 0;
  const becameFunded = existing.status === "active" && currentAmountCents >= existing.targetAmountCents;
  return tx.factoryUpgradeGoal.update({
    where: { id: goalId },
    data: {
      currentAmountCents,
      contributionCount: aggregate._count.id,
      status: becameFunded ? "funded" : existing.status,
      completedAt: becameFunded ? new Date() : existing.completedAt
    }
  });
}

export async function recordFactoryPlatformEvent(input: {
  type:
    | "FACTORY_CONTRIBUTION_CREATED"
    | "FACTORY_GOAL_FUNDED"
    | "FACTORY_GOAL_COMPLETED"
    | "FACTORY_SUPPORTER_JOINED"
    | "FACTORY_MILESTONE_COMPLETED"
    | "FACTORY_UPGRADE_UNLOCKED";
  actorId?: string;
  payload: Record<string, unknown>;
}) {
  return recordPlatformEvent(input);
}

export async function activateSupporterTier(userId: string, tierId: string, priorityWeight: number) {
  const firstProfile = await prisma.userSupporterProfile.findUnique({ where: { userId } });
  const profile = await prisma.userSupporterProfile.upsert({
    where: { userId },
    update: {
      tierId,
      queuePriorityMultiplier: Math.min(1.15, Math.max(1, priorityWeight)),
      badges: ["Factory Supporter"]
    },
    create: {
      userId,
      tierId,
      queuePriorityMultiplier: Math.min(1.15, Math.max(1, priorityWeight)),
      badges: ["Factory Supporter"]
    }
  });
  await prisma.factoryActivityEvent.create({
    data: {
      type: "SUPPORTER_JOINED",
      title: "A new supporter joined the factory floor",
      public: true,
      metadata: { tierId, founder: !firstProfile }
    }
  });
  await recordPlatformEvent({
    type: "FACTORY_SUPPORTER_JOINED",
    actorId: userId,
    payload: { tierId, founder: !firstProfile }
  });
  return profile;
}

function jsonArray(value: Prisma.JsonValue) {
  return Array.isArray(value) ? value.map(String) : [];
}

async function getLiveFactoryStats() {
  const [
    printers,
    filament,
    completedPrints,
    failedPrints,
    queuedJobs,
    activeJobs,
    contributionTotal
  ] = await Promise.all([
    prisma.printer.findMany({ select: { heartbeatStatus: true, totalRuntimeMinutes: true } }),
    prisma.filamentSpool.findMany({ select: { material: true, color: true, startingGrams: true, remainingGrams: true, active: true } }),
    prisma.printJob.count({ where: { status: "COMPLETED" } }),
    prisma.printJob.count({ where: { status: "FAILED" } }),
    prisma.printJob.count({ where: { status: { in: ["QUEUED", "READY_ON_NODE", "AWAITING_OPERATOR_START"] } } }),
    prisma.printJob.count({ where: { status: "PRINTING" } }),
    prisma.factoryContribution.aggregate({
      where: { paymentStatus: { in: ["manual", "paid", "succeeded"] } },
      _sum: { amountCents: true }
    })
  ]);

  const onlinePrinters = printers.filter((printer) => printer.heartbeatStatus === "ONLINE").length;
  const runtimeHours = Math.round(printers.reduce((total, printer) => total + printer.totalRuntimeMinutes, 0) / 60);
  const activeMaterials = new Set(
    filament
      .filter((spool) => spool.active && spool.remainingGrams > 0)
      .map((spool) => `${spool.material}:${spool.color.toLowerCase()}`)
  ).size;
  const filamentProcessedKg = Number((filament.reduce((total, spool) => total + Math.max(0, spool.startingGrams - spool.remainingGrams), 0) / 1000).toFixed(1));
  const successEligible = completedPrints + failedPrints;
  const successRate = successEligible > 0 ? Math.round((completedPrints / successEligible) * 100) : 100;
  const uptimePercent = printers.length > 0 ? Math.round((onlinePrinters / printers.length) * 100) : 100;
  const totalContributions = contributionTotal._sum.amountCents ?? 0;

  return [
    { id: "live-printers", key: "live-printers", label: "Live printers", value: String(onlinePrinters), unit: `/${printers.length}`, description: "Online printer cells", icon: "factory" },
    { id: "queue-load", key: "queue-load", label: "Queue load", value: String(queuedJobs + activeJobs), unit: " jobs", description: "Printing, staged, and queued jobs", icon: "activity" },
    { id: "active-materials", key: "active-materials", label: "Active materials", value: String(activeMaterials), unit: "", description: "Available material and color combinations", icon: "boxes" },
    { id: "success-rate", key: "success-rate", label: "Print success rate", value: String(successRate), unit: "%", description: "Completed prints divided by completed plus failed prints", icon: "shield" },
    { id: "factory-uptime", key: "factory-uptime", label: "Factory uptime", value: String(uptimePercent), unit: "%", description: "Share of registered printers reporting online", icon: "gauge" },
    { id: "runtime-hours", key: "runtime-hours", label: "Runtime", value: String(runtimeHours), unit: "h", description: "Tracked printer runtime", icon: "wrench" },
    { id: "filament-processed", key: "filament-processed", label: "Filament processed", value: String(filamentProcessedKg), unit: "kg", description: "Material consumed from tracked spools", icon: "circuit" },
    { id: "community-support", key: "community-support", label: "Factory support", value: formatCompactMoney(totalContributions), unit: "", description: "Confirmed community goal support", icon: "sparkles" }
  ];
}

function formatCompactMoney(cents: number) {
  if (cents >= 100000) return `$${Math.round(cents / 100 / 1000)}k`;
  return `$${Math.round(cents / 100)}`;
}
