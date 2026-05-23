CREATE TYPE "MerchantApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "MerchantBusinessType" AS ENUM ('SOLE_PROPRIETORSHIP', 'LLC', 'CORPORATION', 'PARTNERSHIP', 'NONPROFIT', 'OTHER');
CREATE TYPE "MerchantTaxIdType" AS ENUM ('EIN', 'SSN');
CREATE TYPE "MerchantDocumentType" AS ENUM ('BUSINESS_LICENSE', 'TAX_DOCUMENT', 'IDENTITY_DOCUMENT', 'ADDRESS_VERIFICATION', 'OTHER');
CREATE TYPE "MerchantConnectStatus" AS ENUM ('NOT_STARTED', 'ACCOUNT_CREATED', 'ONBOARDING_STARTED', 'RESTRICTED', 'ENABLED', 'FAILED');

CREATE TABLE "MerchantApplication" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "MerchantApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "businessName" TEXT NOT NULL,
  "legalBusinessName" TEXT,
  "businessType" "MerchantBusinessType" NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "street1" TEXT NOT NULL,
  "street2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zip" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'US',
  "taxIdType" "MerchantTaxIdType" NOT NULL,
  "taxIdLast4" TEXT NOT NULL,
  "encryptedTaxId" JSONB,
  "stripeConnectStatus" "MerchantConnectStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "stripeAccountId" TEXT,
  "stripeTerminalLocationId" TEXT,
  "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "stripeRequirementsDue" JSONB NOT NULL DEFAULT '[]',
  "reviewNotes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantDocument" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "MerchantDocumentType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MerchantDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantProduct" (
  "id" TEXT NOT NULL,
  "merchantUserId" TEXT NOT NULL,
  "applicationId" TEXT,
  "name" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantOrder" (
  "id" TEXT NOT NULL,
  "merchantUserId" TEXT NOT NULL,
  "applicationId" TEXT,
  "productId" TEXT,
  "customerEmail" TEXT NOT NULL,
  "itemSummary" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "receiptUrl" TEXT,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MerchantApplication_userId_status_idx" ON "MerchantApplication"("userId", "status");
CREATE INDEX "MerchantApplication_status_updatedAt_idx" ON "MerchantApplication"("status", "updatedAt");
CREATE INDEX "MerchantDocument_applicationId_uploadedAt_idx" ON "MerchantDocument"("applicationId", "uploadedAt");
CREATE INDEX "MerchantProduct_merchantUserId_active_idx" ON "MerchantProduct"("merchantUserId", "active");
CREATE INDEX "MerchantOrder_merchantUserId_createdAt_idx" ON "MerchantOrder"("merchantUserId", "createdAt");
CREATE UNIQUE INDEX "MerchantOrder_stripePaymentIntentId_key" ON "MerchantOrder"("stripePaymentIntentId");

ALTER TABLE "MerchantApplication" ADD CONSTRAINT "MerchantApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantDocument" ADD CONSTRAINT "MerchantDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MerchantApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_merchantUserId_fkey" FOREIGN KEY ("merchantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantProduct" ADD CONSTRAINT "MerchantProduct_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MerchantApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_merchantUserId_fkey" FOREIGN KEY ("merchantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MerchantApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantOrder" ADD CONSTRAINT "MerchantOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MerchantProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
