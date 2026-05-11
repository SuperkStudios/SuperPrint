-- AlterTable
ALTER TABLE "PrintJob"
ADD COLUMN "queueLockedAt" TIMESTAMP(3),
ADD COLUMN "queueLockToken" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "assignmentBlockedReason" TEXT;

-- CreateIndex
CREATE INDEX "PrintJob_status_queuePosition_idx" ON "PrintJob"("status", "queuePosition");

-- CreateIndex
CREATE INDEX "PrintJob_queueLockToken_idx" ON "PrintJob"("queueLockToken");
