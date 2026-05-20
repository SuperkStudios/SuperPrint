import { NextResponse } from "next/server";
import { z } from "zod";
import {
  factoryMilestoneMetrics,
  factoryUpgradeCategories,
  factoryUpgradeStatuses,
  factoryVisibilities,
  parseLines,
  slugifyFactoryTitle
} from "@/domain/factory-evolution";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const baseSchema = z.object({
  resource: z.enum(["goal", "milestone", "tier", "unlockedUpgrade"]),
  action: z.enum(["upsert", "delete"]).default("upsert"),
  id: z.string().optional()
});

const goalSchema = baseSchema.extend({
  resource: z.literal("goal"),
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().min(1),
  category: z.enum(factoryUpgradeCategories),
  status: z.enum(factoryUpgradeStatuses),
  visibility: z.enum(factoryVisibilities),
  targetAmountCents: z.number().int().nonnegative(),
  currentAmountCents: z.number().int().nonnegative(),
  contributionCount: z.number().int().nonnegative().default(0),
  unlockBenefitsText: z.string().optional(),
  imageUrl: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().default(0),
  featured: z.boolean().default(false)
});

const milestoneSchema = baseSchema.extend({
  resource: z.literal("milestone"),
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().min(1),
  metric: z.enum(factoryMilestoneMetrics),
  targetValue: z.number().int().nonnegative(),
  currentValue: z.number().int().nonnegative(),
  unitLabel: z.string().trim().default(""),
  visibility: z.enum(factoryVisibilities),
  completed: z.boolean().default(false),
  displayOrder: z.number().int().default(0)
});

const tierSchema = baseSchema.extend({
  resource: z.literal("tier"),
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional().default(""),
  monthlyPriceCents: z.number().int().nonnegative().nullable().optional(),
  oneTimePriceCents: z.number().int().nonnegative().nullable().optional(),
  perksText: z.string().optional(),
  badgeIcon: z.string().trim().default("badge"),
  badgeColor: z.string().trim().default("#22d3ee"),
  priorityWeight: z.number().positive().default(1),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true)
});

const unlockedUpgradeSchema = baseSchema.extend({
  resource: z.literal("unlockedUpgrade"),
  goalId: z.string().nullable().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.enum(factoryUpgradeCategories),
  imageUrl: z.string().trim().optional().nullable(),
  displayOrder: z.number().int().default(0),
  public: z.boolean().default(true),
  unlockedAt: z.string().optional()
});

const requestSchema = z.discriminatedUnion("resource", [goalSchema, milestoneSchema, tierSchema, unlockedUpgradeSchema]);

export async function POST(request: Request) {
  const { session, response } = await requireAdmin("factory");
  if (response) return response;

  const rawBody = await request.json();
  const baseBody = baseSchema.parse(rawBody);
  if (baseBody.action === "delete") {
    await deleteResource(baseBody.resource, baseBody.id);
    return NextResponse.json({ ok: true });
  }
  const body = requestSchema.parse(rawBody);

  if (body.resource === "goal") {
    const resolvedStatus = body.status === "active" && body.targetAmountCents > 0 && body.currentAmountCents >= body.targetAmountCents ? "funded" : body.status;
    const statusCompleted = resolvedStatus === "completed" || resolvedStatus === "funded";
    const data = {
      title: body.title,
      slug: body.slug?.trim() || slugifyFactoryTitle(body.title),
      description: body.description,
      category: body.category,
      status: resolvedStatus,
      visibility: body.visibility,
      targetAmountCents: body.targetAmountCents,
      currentAmountCents: body.currentAmountCents,
      contributionCount: body.contributionCount,
      unlockBenefits: parseLines(body.unlockBenefitsText),
      imageUrl: body.imageUrl || null,
      displayOrder: body.displayOrder,
      featured: body.featured,
      completedAt: statusCompleted ? new Date() : null
    };
    const goal = body.id ? await prisma.factoryUpgradeGoal.update({ where: { id: body.id }, data }) : await prisma.factoryUpgradeGoal.create({ data });
    await prisma.factoryActivityEvent.create({
      data: {
        type: "MANUAL_PROGRESS_ADJUSTED",
        title: `${goal.title} progress updated`,
        goalId: goal.id,
        actorName: session!.user.name,
        amountCents: goal.currentAmountCents,
        public: goal.visibility === "public",
        metadata: { status: goal.status }
      }
    });
    return NextResponse.json({ goal });
  }

  if (body.resource === "milestone") {
    const data = {
      title: body.title,
      slug: body.slug?.trim() || slugifyFactoryTitle(body.title),
      description: body.description,
      metric: body.metric,
      targetValue: body.targetValue,
      currentValue: body.currentValue,
      unitLabel: body.unitLabel,
      visibility: body.visibility,
      completed: body.completed,
      displayOrder: body.displayOrder,
      completedAt: body.completed ? new Date() : null
    };
    const milestone = body.id ? await prisma.factoryMilestone.update({ where: { id: body.id }, data }) : await prisma.factoryMilestone.create({ data });
    if (milestone.completed) {
      await prisma.factoryActivityEvent.create({
        data: {
          type: "MILESTONE_COMPLETED",
          title: milestone.title,
          body: milestone.description,
          milestoneId: milestone.id,
          public: milestone.visibility === "public",
          metadata: { currentValue: milestone.currentValue, targetValue: milestone.targetValue }
        }
      });
    }
    return NextResponse.json({ milestone });
  }

  if (body.resource === "tier") {
    const data = {
      title: body.title,
      slug: body.slug?.trim() || slugifyFactoryTitle(body.title),
      description: body.description,
      monthlyPriceCents: body.monthlyPriceCents,
      oneTimePriceCents: body.oneTimePriceCents,
      perks: parseLines(body.perksText),
      badgeIcon: body.badgeIcon,
      badgeColor: body.badgeColor,
      priorityWeight: body.priorityWeight,
      displayOrder: body.displayOrder,
      active: body.active
    };
    const tier = body.id ? await prisma.supporterTier.update({ where: { id: body.id }, data }) : await prisma.supporterTier.create({ data });
    return NextResponse.json({ tier });
  }

  const data = {
    goalId: body.goalId || null,
    title: body.title,
    description: body.description,
    category: body.category,
    imageUrl: body.imageUrl || null,
    displayOrder: body.displayOrder,
    public: body.public,
    unlockedAt: body.unlockedAt ? new Date(body.unlockedAt) : new Date()
  };
  const unlockedUpgrade = body.id ? await prisma.factoryUnlockedUpgrade.update({ where: { id: body.id }, data }) : await prisma.factoryUnlockedUpgrade.create({ data });
  await prisma.factoryActivityEvent.create({
    data: {
      type: "UPGRADE_UNLOCKED",
      title: unlockedUpgrade.title,
      body: unlockedUpgrade.description,
      goalId: unlockedUpgrade.goalId,
      public: unlockedUpgrade.public,
      metadata: { category: unlockedUpgrade.category }
    }
  });
  return NextResponse.json({ unlockedUpgrade });
}

async function deleteResource(resource: string, id?: string) {
  if (!id) throw new Error("id is required");
  if (resource === "goal") return prisma.factoryUpgradeGoal.delete({ where: { id } });
  if (resource === "milestone") return prisma.factoryMilestone.delete({ where: { id } });
  if (resource === "tier") return prisma.supporterTier.delete({ where: { id } });
  return prisma.factoryUnlockedUpgrade.delete({ where: { id } });
}
