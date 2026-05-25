-- Production operator loop, mobile push tokens, and plate safety checkpoints.
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_PLATE_READY';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_FILAMENT_CHANGE_REQUIRED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_FILAMENT_CHANGE_COMPLETED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_PLATE_CLEAR_CHECK_PASSED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_PLATE_CLEAR_CHECK_FAILED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_PLATE_PRINT_STARTED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_PLATE_PRINT_COMPLETED';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'PRODUCTION_ASSEMBLY_READY';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'MOBILE_PUSH_SENT';
ALTER TYPE "PlatformEventType" ADD VALUE IF NOT EXISTS 'MOBILE_PUSH_FAILED';

ALTER TABLE "ProductionPlateJob"
  ADD COLUMN "filamentConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "plateClearConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "aiPlateCheckStatus" TEXT,
  ADD COLUMN "aiPlateCheckConfidence" INTEGER,
  ADD COLUMN "aiPlateCheckReason" TEXT;

CREATE TABLE "MobilePushToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceName" TEXT,
  "appVersion" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MobilePushToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionOperatorCheckpoint" (
  "id" TEXT NOT NULL,
  "plateJobId" TEXT,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "printerId" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionOperatorCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobilePushToken_token_key" ON "MobilePushToken"("token");
CREATE INDEX "MobilePushToken_userId_enabled_idx" ON "MobilePushToken"("userId", "enabled");
CREATE INDEX "ProductionOperatorCheckpoint_plateJobId_createdAt_idx" ON "ProductionOperatorCheckpoint"("plateJobId", "createdAt");
CREATE INDEX "ProductionOperatorCheckpoint_action_createdAt_idx" ON "ProductionOperatorCheckpoint"("action", "createdAt");

ALTER TABLE "MobilePushToken" ADD CONSTRAINT "MobilePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOperatorCheckpoint" ADD CONSTRAINT "ProductionOperatorCheckpoint_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
