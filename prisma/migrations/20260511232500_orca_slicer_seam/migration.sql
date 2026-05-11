-- CreateEnum
CREATE TYPE "SliceJobStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "PrintJob" ADD COLUMN "sliceJobId" TEXT;

-- CreateTable
CREATE TABLE "SlicerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "profilePath" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlicerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "profilePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilamentProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material" "FilamentMaterial" NOT NULL,
    "profilePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilamentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SliceJob" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "slicerProfileId" TEXT NOT NULL,
    "machineProfileId" TEXT NOT NULL,
    "filamentProfileId" TEXT NOT NULL,
    "status" "SliceJobStatus" NOT NULL DEFAULT 'PENDING',
    "inputStorageKey" TEXT NOT NULL,
    "outputStorageKey" TEXT,
    "watchedFolderPath" TEXT,
    "commandPreview" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SliceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchedFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastScanAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchedFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SliceJob_status_createdAt_idx" ON "SliceJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_sliceJobId_fkey" FOREIGN KEY ("sliceJobId") REFERENCES "SliceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceJob" ADD CONSTRAINT "SliceJob_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "ModelUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceJob" ADD CONSTRAINT "SliceJob_slicerProfileId_fkey" FOREIGN KEY ("slicerProfileId") REFERENCES "SlicerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceJob" ADD CONSTRAINT "SliceJob_machineProfileId_fkey" FOREIGN KEY ("machineProfileId") REFERENCES "MachineProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SliceJob" ADD CONSTRAINT "SliceJob_filamentProfileId_fkey" FOREIGN KEY ("filamentProfileId") REFERENCES "FilamentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
