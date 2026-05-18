-- CreateEnum
CREATE TYPE "RewardTransactionType" AS ENUM ('EARNED', 'REDEEM_RESERVED', 'REDEEMED', 'RESERVATION_RELEASED', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "RewardTransactionStatus" AS ENUM ('PENDING', 'POSTED', 'VOID');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "rewardsPointsBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "rewardPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rewardDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rewardPointsEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderPricingSnapshot" ADD COLUMN "preRewardCustomerPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rewardDiscountCents" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing pricing snapshots so pre-reward totals match existing totals.
UPDATE "OrderPricingSnapshot"
SET "preRewardCustomerPriceCents" = "finalCustomerPriceCents"
WHERE "preRewardCustomerPriceCents" = 0;

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "RewardTransactionType" NOT NULL,
    "status" "RewardTransactionStatus" NOT NULL DEFAULT 'POSTED',
    "points" INTEGER NOT NULL,
    "centsBasis" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RewardTransaction_userId_createdAt_idx" ON "RewardTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardTransaction_orderId_type_idx" ON "RewardTransaction"("orderId", "type");

-- CreateIndex
CREATE INDEX "RewardTransaction_status_expiresAt_idx" ON "RewardTransaction"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
