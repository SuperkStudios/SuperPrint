-- CreateEnum
CREATE TYPE "HeartbeatStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'STALE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Printer"
ADD COLUMN "modelName" TEXT NOT NULL DEFAULT 'Elegoo Centauri Carbon',
ADD COLUMN "nozzleSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
ADD COLUMN "buildVolumeXmm" INTEGER NOT NULL DEFAULT 256,
ADD COLUMN "buildVolumeYmm" INTEGER NOT NULL DEFAULT 256,
ADD COLUMN "buildVolumeZmm" INTEGER NOT NULL DEFAULT 256,
ADD COLUMN "supportedMaterials" JSONB NOT NULL DEFAULT '["PLA","PETG"]',
ADD COLUMN "cameraSource" TEXT,
ADD COLUMN "cameraStatus" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "maintenanceProfile" TEXT NOT NULL DEFAULT 'Elegoo Centauri Carbon standard maintenance',
ADD COLUMN "totalRuntimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedPrintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failedPrintCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "heartbeatStatus" "HeartbeatStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN "heartbeatLatencyMs" INTEGER;
