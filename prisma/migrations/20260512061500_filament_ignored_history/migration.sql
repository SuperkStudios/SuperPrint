ALTER TABLE "FilamentSpool"
ADD COLUMN "ignoredPrinterHistory" JSONB NOT NULL DEFAULT '[]';
