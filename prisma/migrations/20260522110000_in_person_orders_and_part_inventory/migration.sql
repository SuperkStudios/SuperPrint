ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "Order" ADD COLUMN "paymentSource" TEXT;
ALTER TABLE "Order" ADD COLUMN "amountPaidCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "depositCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "balanceDueCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "Order" ADD COLUMN "cardBrand" TEXT;
ALTER TABLE "Order" ADD COLUMN "cardLast4" TEXT;
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "orderSource" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Order" ADD COLUMN "internalNotes" TEXT;

CREATE TABLE "ProductPartInventory" (
    "id" TEXT NOT NULL,
    "productPartId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT 'Storage',
    "notes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPartInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductPartInventory_productPartId_color_location_key" ON "ProductPartInventory"("productPartId", "color", "location");
CREATE INDEX "ProductPartInventory_color_idx" ON "ProductPartInventory"("color");

ALTER TABLE "ProductPartInventory" ADD CONSTRAINT "ProductPartInventory_productPartId_fkey" FOREIGN KEY ("productPartId") REFERENCES "ProductPart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPartInventory" ADD CONSTRAINT "ProductPartInventory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
