-- AlterEnum
ALTER TYPE "PrintJobStatus" ADD VALUE 'READY_ON_NODE';

-- AlterEnum
ALTER TYPE "SliceJobStatus" ADD VALUE 'BLOCKED';

-- AlterEnum
ALTER TYPE "PlatformEventType" ADD VALUE 'SLICING_BLOCKED';
ALTER TYPE "PlatformEventType" ADD VALUE 'SLICING_FAILED';
ALTER TYPE "PlatformEventType" ADD VALUE 'SLICING_COMPLETE';
ALTER TYPE "PlatformEventType" ADD VALUE 'QUEUE_ADMITTED';
ALTER TYPE "PlatformEventType" ADD VALUE 'JOB_READY_ON_NODE';

-- AlterTable
ALTER TABLE "ModelUpload"
ADD COLUMN "checksumSha256" TEXT,
ADD COLUMN "adminNotes" TEXT,
ADD COLUMN "estimatedGrams" INTEGER,
ADD COLUMN "selectedMaterial" "FilamentMaterial",
ADD COLUMN "selectedPrinterId" TEXT;

-- AlterTable
ALTER TABLE "PrintJob"
ADD COLUMN "reservedFilamentGrams" INTEGER,
ADD COLUMN "readyOnNodeAt" TIMESTAMP(3),
ADD COLUMN "readyOnNodeId" TEXT,
ADD COLUMN "nodeLocalJobPath" TEXT;

-- AlterTable
ALTER TABLE "SliceJob"
ADD COLUMN "estimatedPrintMinutes" INTEGER,
ADD COLUMN "estimatedGrams" INTEGER,
ADD COLUMN "warnings" JSONB,
ADD COLUMN "errorLog" TEXT,
ADD COLUMN "stdoutLog" TEXT,
ADD COLUMN "stderrLog" TEXT,
ADD COLUMN "blockedReason" TEXT;

-- AddForeignKey
ALTER TABLE "ModelUpload" ADD CONSTRAINT "ModelUpload_selectedPrinterId_fkey" FOREIGN KEY ("selectedPrinterId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
