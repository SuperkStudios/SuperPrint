-- AlterEnum
ALTER TYPE "PrintJobStatus" ADD VALUE 'AWAITING_OPERATOR_START';

-- AlterEnum
ALTER TYPE "PlatformEventType" ADD VALUE 'OPERATOR_PRINT_START_APPROVED';
ALTER TYPE "PlatformEventType" ADD VALUE 'PRINT_COMMAND_ACKNOWLEDGED';

-- AlterTable
ALTER TABLE "PrintJob"
ADD COLUMN "operatorStartApprovedById" TEXT,
ADD COLUMN "operatorStartApprovedAt" TIMESTAMP(3),
ADD COLUMN "operatorStartChecklist" JSONB,
ADD COLUMN "printCommandAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "printCommandAcknowledgedByNodeId" TEXT;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_operatorStartApprovedById_fkey" FOREIGN KEY ("operatorStartApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
