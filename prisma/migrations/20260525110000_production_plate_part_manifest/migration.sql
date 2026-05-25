ALTER TABLE "ProductionPlateJob"
ADD COLUMN "partManifest" JSONB NOT NULL DEFAULT '[]';
