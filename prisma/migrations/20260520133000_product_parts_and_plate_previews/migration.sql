ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "maxBatchQuantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "previewPlateStorageKey" TEXT;

CREATE TABLE IF NOT EXISTS "ProductPart" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "fileStorageKey" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'part',
  "colorSlotIndex" INTEGER NOT NULL DEFAULT 0,
  "quantityPerUnit" INTEGER NOT NULL DEFAULT 1,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPart_productId_displayOrder_idx" ON "ProductPart"("productId", "displayOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductPart_productId_fkey'
  ) THEN
    ALTER TABLE "ProductPart"
    ADD CONSTRAINT "ProductPart_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
