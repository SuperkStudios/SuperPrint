CREATE TYPE "ProductionPlateJobStatus" AS ENUM ('PLANNED', 'SLICING', 'READY', 'NEEDS_FILAMENT', 'PRINTING', 'PRINTED', 'INVENTORIED', 'CANCELED', 'FAILED');

CREATE TABLE "ProductionPlateJob" (
  "id" TEXT NOT NULL,
  "productPartId" TEXT NOT NULL,
  "filamentId" TEXT,
  "color" TEXT NOT NULL,
  "status" "ProductionPlateJobStatus" NOT NULL DEFAULT 'PLANNED',
  "quantityPlanned" INTEGER NOT NULL,
  "requiredQuantity" INTEGER NOT NULL,
  "inventoryUsedQuantity" INTEGER NOT NULL DEFAULT 0,
  "maxPerPlate" INTEGER NOT NULL,
  "plateIndex" INTEGER NOT NULL DEFAULT 1,
  "plateCount" INTEGER NOT NULL DEFAULT 1,
  "orderRefs" JSONB NOT NULL DEFAULT '[]',
  "inputStorageKey" TEXT NOT NULL,
  "outputStorageKey" TEXT,
  "nodeLocalJobPath" TEXT,
  "slicerMessage" TEXT,
  "estimatedPrintMinutes" INTEGER,
  "estimatedGrams" INTEGER,
  "lastError" TEXT,
  "printedQuantity" INTEGER NOT NULL DEFAULT 0,
  "inventoriedQuantity" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionPlateJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionPlateJob_status_createdAt_idx" ON "ProductionPlateJob"("status", "createdAt");
CREATE INDEX "ProductionPlateJob_color_status_idx" ON "ProductionPlateJob"("color", "status");
CREATE INDEX "ProductionPlateJob_productPartId_color_idx" ON "ProductionPlateJob"("productPartId", "color");

ALTER TABLE "ProductionPlateJob" ADD CONSTRAINT "ProductionPlateJob_productPartId_fkey" FOREIGN KEY ("productPartId") REFERENCES "ProductPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionPlateJob" ADD CONSTRAINT "ProductionPlateJob_filamentId_fkey" FOREIGN KEY ("filamentId") REFERENCES "FilamentSpool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
