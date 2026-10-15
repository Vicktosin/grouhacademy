CREATE TYPE "FinanceEntryType" AS ENUM (
    'AD_SPEND',
    'STAFF_PAYMENT',
    'BUSINESS_SAVINGS',
    'CAPITAL_INVESTMENT',
    'UNPLANNED_EXPENSE',
    'SUBSCRIPTION',
    'OTHER'
);

CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "type" "FinanceEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "adType" TEXT,
    "campaignName" TEXT,
    "conversions" INTEGER,
    "attributedRevenue" INTEGER,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinanceEntry_type_occurredAt_idx" ON "FinanceEntry"("type", "occurredAt");
CREATE INDEX "FinanceEntry_createdById_idx" ON "FinanceEntry"("createdById");

ALTER TABLE "FinanceEntry"
ADD CONSTRAINT "FinanceEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
