-- CreateTable
CREATE TABLE "SuperNode" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "printerId" TEXT,
    "heartbeatStatus" "HeartbeatStatus" NOT NULL DEFAULT 'UNKNOWN',
    "printerStatus" "PrinterStatus" NOT NULL DEFAULT 'OFFLINE',
    "cameraStatus" "CameraStatus" NOT NULL DEFAULT 'UNKNOWN',
    "localUploadPath" TEXT,
    "localSlicedPath" TEXT,
    "localVideoPath" TEXT,
    "localTimelapsePath" TEXT,
    "localThumbnailPath" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperNode_nodeId_key" ON "SuperNode"("nodeId");

-- CreateIndex
CREATE INDEX "SuperNode_heartbeatStatus_lastHeartbeatAt_idx" ON "SuperNode"("heartbeatStatus", "lastHeartbeatAt");

-- AddForeignKey
ALTER TABLE "SuperNode" ADD CONSTRAINT "SuperNode_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
