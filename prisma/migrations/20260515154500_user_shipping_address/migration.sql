ALTER TABLE "User"
  ADD COLUMN "shippingName" TEXT,
  ADD COLUMN "shippingStreet1" TEXT,
  ADD COLUMN "shippingStreet2" TEXT,
  ADD COLUMN "shippingCity" TEXT,
  ADD COLUMN "shippingState" TEXT,
  ADD COLUMN "shippingZip" TEXT,
  ADD COLUMN "shippingCountry" TEXT DEFAULT 'US',
  ADD COLUMN "shippingPhone" TEXT;
