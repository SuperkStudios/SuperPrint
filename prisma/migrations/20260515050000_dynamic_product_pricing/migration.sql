ALTER TYPE "FilamentMaterial" ADD VALUE IF NOT EXISTS 'PLA_PLUS';
ALTER TYPE "FilamentMaterial" ADD VALUE IF NOT EXISTS 'ASA';
ALTER TYPE "FilamentMaterial" ADD VALUE IF NOT EXISTS 'CARBON_FIBER_PETG';

DO $$ BEGIN
  CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'DYNAMIC');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "FilamentSpool"
ADD COLUMN IF NOT EXISTS "name" TEXT,
ADD COLUMN IF NOT EXISTS "type" "FilamentMaterial" NOT NULL DEFAULT 'PLA',
ADD COLUMN IF NOT EXISTS "spoolWeightGrams" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS "costPerSpoolCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "costPerGramCents" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "markupMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "notes" TEXT;

UPDATE "FilamentSpool"
SET
  "name" = COALESCE("name", CONCAT("brand", ' ', "color", ' ', "material"::TEXT)),
  "type" = "material",
  "spoolWeightGrams" = COALESCE(NULLIF("startingGrams", 0), 1000),
  "costPerSpoolCents" = CASE WHEN "costPerSpoolCents" = 0 THEN "rollCostCents" ELSE "costPerSpoolCents" END,
  "costPerGramCents" = CASE
    WHEN "costPerGramCents" = 0 AND COALESCE(NULLIF("startingGrams", 0), 1000) > 0
      THEN "rollCostCents"::DOUBLE PRECISION / COALESCE(NULLIF("startingGrams", 0), 1000)::DOUBLE PRECISION
    ELSE "costPerGramCents"
  END;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "baseModelFile" TEXT,
ADD COLUMN IF NOT EXISTS "defaultFilamentMaterialId" TEXT,
ADD COLUMN IF NOT EXISTS "baseLaborMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "basePackagingCents" INTEGER NOT NULL DEFAULT 150,
ADD COLUMN IF NOT EXISTS "pricingMode" "PricingMode" NOT NULL DEFAULT 'DYNAMIC',
ADD COLUMN IF NOT EXISTS "fixedPriceCents" INTEGER;

UPDATE "Product"
SET
  "baseModelFile" = COALESCE("baseModelFile", "productFileStorageKey"),
  "pricingMode" = 'FIXED',
  "fixedPriceCents" = COALESCE("fixedPriceCents", "priceCents");

UPDATE "Product" p
SET "defaultFilamentMaterialId" = (
  SELECT s.id
  FROM "FilamentSpool" s
  WHERE s."material" = p."defaultMaterial"
  ORDER BY s."remainingGrams" DESC
  LIMIT 1
)
WHERE p."defaultFilamentMaterialId" IS NULL;

CREATE TABLE IF NOT EXISTS "ProductAllowedFilament" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "filamentMaterialId" TEXT NOT NULL,
  "estimatedGramsOverride" INTEGER,
  "estimatedPrintMinutesOverride" INTEGER,
  "priceAdjustmentCents" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductAllowedFilament_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ProductAllowedFilament" ("id", "productId", "filamentMaterialId", "enabled", "createdAt", "updatedAt")
SELECT CONCAT('paf_', md5(p.id || s.id)), p.id, s.id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Product" p
JOIN "FilamentSpool" s ON s.id = p."defaultFilamentMaterialId"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductAllowedFilament_productId_filamentMaterialId_key"
ON "ProductAllowedFilament"("productId", "filamentMaterialId");

CREATE INDEX IF NOT EXISTS "ProductAllowedFilament_filamentMaterialId_idx"
ON "ProductAllowedFilament"("filamentMaterialId");

CREATE TABLE IF NOT EXISTS "PricingSettings" (
  "id" TEXT NOT NULL,
  "machineHourlyRateCents" INTEGER NOT NULL DEFAULT 250,
  "laborHourlyRateCents" INTEGER NOT NULL DEFAULT 1800,
  "electricityHourlyRateCents" INTEGER NOT NULL DEFAULT 20,
  "maintenanceReservePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
  "failureReservePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
  "defaultProfitMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "paymentProcessingPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.029,
  "paymentProcessingFixedCents" INTEGER NOT NULL DEFAULT 30,
  "taxPercentEstimate" DOUBLE PRECISION,
  "minimumOrderPriceCents" INTEGER NOT NULL DEFAULT 500,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PricingSettings" (
  "id",
  "machineHourlyRateCents",
  "laborHourlyRateCents",
  "electricityHourlyRateCents",
  "maintenanceReservePercent",
  "failureReservePercent",
  "defaultProfitMultiplier",
  "paymentProcessingPercent",
  "paymentProcessingFixedCents",
  "minimumOrderPriceCents",
  "createdAt",
  "updatedAt"
) VALUES (
  'default',
  250,
  1800,
  20,
  0.08,
  0.12,
  2,
  0.029,
  30,
  500,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "selectedFilamentMaterialId" TEXT;

CREATE TABLE IF NOT EXISTS "OrderPricingSnapshot" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "filamentMaterialId" TEXT NOT NULL,
  "materialCostCents" INTEGER NOT NULL,
  "machineTimeCostCents" INTEGER NOT NULL,
  "electricityCostCents" INTEGER NOT NULL,
  "laborCostCents" INTEGER NOT NULL,
  "packagingCostCents" INTEGER NOT NULL,
  "maintenanceReserveCents" INTEGER NOT NULL,
  "failureReserveCents" INTEGER NOT NULL,
  "subtotalCostCents" INTEGER NOT NULL,
  "profitMarkupCents" INTEGER NOT NULL,
  "paymentFeeCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL,
  "shippingCents" INTEGER NOT NULL,
  "finalCustomerPriceCents" INTEGER NOT NULL,
  "internalCostCents" INTEGER NOT NULL DEFAULT 0,
  "marginCents" INTEGER NOT NULL DEFAULT 0,
  "marginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pricingFormulaVersion" TEXT NOT NULL DEFAULT 'product-pricing-v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderPricingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderPricingSnapshot_orderId_key" ON "OrderPricingSnapshot"("orderId");
CREATE INDEX IF NOT EXISTS "OrderPricingSnapshot_productId_idx" ON "OrderPricingSnapshot"("productId");
CREATE INDEX IF NOT EXISTS "OrderPricingSnapshot_filamentMaterialId_idx" ON "OrderPricingSnapshot"("filamentMaterialId");

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultFilamentMaterialId_fkey" FOREIGN KEY ("defaultFilamentMaterialId") REFERENCES "FilamentSpool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAllowedFilament" ADD CONSTRAINT "ProductAllowedFilament_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAllowedFilament" ADD CONSTRAINT "ProductAllowedFilament_filamentMaterialId_fkey" FOREIGN KEY ("filamentMaterialId") REFERENCES "FilamentSpool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_selectedFilamentMaterialId_fkey" FOREIGN KEY ("selectedFilamentMaterialId") REFERENCES "FilamentSpool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderPricingSnapshot" ADD CONSTRAINT "OrderPricingSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderPricingSnapshot" ADD CONSTRAINT "OrderPricingSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderPricingSnapshot" ADD CONSTRAINT "OrderPricingSnapshot_filamentMaterialId_fkey" FOREIGN KEY ("filamentMaterialId") REFERENCES "FilamentSpool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
