-- AlterTable
ALTER TABLE "PrintJob"
ADD COLUMN "currentLayer" INTEGER,
ADD COLUMN "progressPercent" INTEGER,
ADD COLUMN "elapsedSeconds" INTEGER,
ADD COLUMN "remainingSeconds" INTEGER,
ADD COLUMN "nozzleTempC" DOUBLE PRECISION,
ADD COLUMN "bedTempC" DOUBLE PRECISION,
ADD COLUMN "telemetryUpdatedAt" TIMESTAMP(3);
