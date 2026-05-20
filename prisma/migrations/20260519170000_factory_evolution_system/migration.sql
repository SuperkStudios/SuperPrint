ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_CONTRIBUTION_CREATED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_GOAL_FUNDED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_GOAL_COMPLETED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_SUPPORTER_JOINED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_MILESTONE_COMPLETED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'FACTORY_UPGRADE_UNLOCKED';

DO $$ BEGIN
  CREATE TYPE "FactoryUpgradeCategory" AS ENUM ('printer', 'material', 'camera', 'automation', 'facility', 'livestream', 'quality', 'experimental');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryUpgradeStatus" AS ENUM ('active', 'funded', 'installing', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryVisibility" AS ENUM ('public', 'private');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryActivityType" AS ENUM ('CONTRIBUTION_CREATED', 'GOAL_FUNDED', 'GOAL_INSTALLING', 'GOAL_COMPLETED', 'SUPPORTER_JOINED', 'MILESTONE_COMPLETED', 'UPGRADE_UNLOCKED', 'MANUAL_PROGRESS_ADJUSTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryMilestoneMetric" AS ENUM ('completed_prints', 'filament_grams', 'queue_watch_hours', 'printer_uptime_hours', 'contribution_cents', 'livestream_engagement', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "FactoryUpgradeGoal" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "FactoryUpgradeCategory" NOT NULL,
  "status" "FactoryUpgradeStatus" NOT NULL DEFAULT 'active',
  "visibility" "FactoryVisibility" NOT NULL DEFAULT 'public',
  "targetAmountCents" INTEGER NOT NULL,
  "currentAmountCents" INTEGER NOT NULL DEFAULT 0,
  "contributionCount" INTEGER NOT NULL DEFAULT 0,
  "unlockBenefits" JSONB NOT NULL DEFAULT '[]',
  "imageUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "FactoryUpgradeGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FactoryContribution" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "message" TEXT,
  "anonymous" BOOLEAN NOT NULL DEFAULT false,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "paymentStatus" TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FactoryContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupporterTier" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "monthlyPriceCents" INTEGER,
  "oneTimePriceCents" INTEGER,
  "perks" JSONB NOT NULL DEFAULT '[]',
  "badgeIcon" TEXT NOT NULL,
  "badgeColor" TEXT NOT NULL,
  "priorityWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupporterTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSupporterProfile" (
  "userId" TEXT NOT NULL,
  "tierId" TEXT,
  "lifetimeContributionCents" INTEGER NOT NULL DEFAULT 0,
  "badges" JSONB NOT NULL DEFAULT '[]',
  "supporterSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "founder" BOOLEAN NOT NULL DEFAULT false,
  "queuePriorityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSupporterProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "FactoryMilestone" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "metric" "FactoryMilestoneMetric" NOT NULL DEFAULT 'custom',
  "targetValue" INTEGER NOT NULL,
  "currentValue" INTEGER NOT NULL DEFAULT 0,
  "unitLabel" TEXT NOT NULL DEFAULT '',
  "visibility" "FactoryVisibility" NOT NULL DEFAULT 'public',
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "FactoryMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FactoryActivityEvent" (
  "id" TEXT NOT NULL,
  "type" "FactoryActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "goalId" TEXT,
  "milestoneId" TEXT,
  "actorName" TEXT,
  "amountCents" INTEGER,
  "public" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FactoryActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FactoryUnlockedUpgrade" (
  "id" TEXT NOT NULL,
  "goalId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "FactoryUpgradeCategory" NOT NULL,
  "imageUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "public" BOOLEAN NOT NULL DEFAULT true,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactoryUnlockedUpgrade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FactoryStat" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "unit" TEXT,
  "description" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'gauge',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "visibility" "FactoryVisibility" NOT NULL DEFAULT 'public',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FactoryStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FactoryUpgradeGoal_slug_key" ON "FactoryUpgradeGoal"("slug");
CREATE INDEX "FactoryUpgradeGoal_visibility_status_displayOrder_idx" ON "FactoryUpgradeGoal"("visibility", "status", "displayOrder");
CREATE INDEX "FactoryUpgradeGoal_featured_displayOrder_idx" ON "FactoryUpgradeGoal"("featured", "displayOrder");
CREATE UNIQUE INDEX "FactoryContribution_stripeCheckoutSessionId_key" ON "FactoryContribution"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "FactoryContribution_stripePaymentIntentId_key" ON "FactoryContribution"("stripePaymentIntentId");
CREATE INDEX "FactoryContribution_goalId_createdAt_idx" ON "FactoryContribution"("goalId", "createdAt");
CREATE INDEX "FactoryContribution_userId_createdAt_idx" ON "FactoryContribution"("userId", "createdAt");
CREATE UNIQUE INDEX "SupporterTier_slug_key" ON "SupporterTier"("slug");
CREATE UNIQUE INDEX "FactoryMilestone_slug_key" ON "FactoryMilestone"("slug");
CREATE INDEX "FactoryMilestone_visibility_completed_displayOrder_idx" ON "FactoryMilestone"("visibility", "completed", "displayOrder");
CREATE INDEX "FactoryActivityEvent_public_createdAt_idx" ON "FactoryActivityEvent"("public", "createdAt");
CREATE INDEX "FactoryActivityEvent_type_createdAt_idx" ON "FactoryActivityEvent"("type", "createdAt");
CREATE INDEX "FactoryUnlockedUpgrade_public_unlockedAt_idx" ON "FactoryUnlockedUpgrade"("public", "unlockedAt");
CREATE UNIQUE INDEX "FactoryStat_key_key" ON "FactoryStat"("key");

ALTER TABLE "FactoryContribution" ADD CONSTRAINT "FactoryContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FactoryContribution" ADD CONSTRAINT "FactoryContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FactoryUpgradeGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSupporterProfile" ADD CONSTRAINT "UserSupporterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSupporterProfile" ADD CONSTRAINT "UserSupporterProfile_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SupporterTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FactoryActivityEvent" ADD CONSTRAINT "FactoryActivityEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FactoryUpgradeGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FactoryActivityEvent" ADD CONSTRAINT "FactoryActivityEvent_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "FactoryMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FactoryUnlockedUpgrade" ADD CONSTRAINT "FactoryUnlockedUpgrade_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "FactoryUpgradeGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
