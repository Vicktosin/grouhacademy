-- The Affiliate Program gets its own tables, separate from referrals
-- (achievement "brag" shares). Earlier affiliate work kept affiliates inside
-- the referral tables (ReferralClick/ReferralAttribution rows without a
-- share, User.referralCode, ReferralPayout); anything stored that way is
-- moved into the new tables before the old columns are removed.

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "AffiliateProfile" (
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "autoMonthlyPayout" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" UUID NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "affiliateId" UUID NOT NULL,
    "referredUserId" UUID NOT NULL,
    "clickId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" UUID NOT NULL,
    "referralId" TEXT NOT NULL,
    "internshipPaymentId" TEXT NOT NULL,
    "paymentAmount" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "affiliateId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'PENDING',
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "adminNote" TEXT,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateProfile_code_key" ON "AffiliateProfile"("code");
CREATE INDEX "AffiliateClick_affiliateId_firstVisitedAt_idx" ON "AffiliateClick"("affiliateId", "firstVisitedAt");
CREATE UNIQUE INDEX "AffiliateClick_affiliateId_visitorKey_key" ON "AffiliateClick"("affiliateId", "visitorKey");
CREATE UNIQUE INDEX "AffiliateReferral_referredUserId_key" ON "AffiliateReferral"("referredUserId");
CREATE UNIQUE INDEX "AffiliateReferral_clickId_key" ON "AffiliateReferral"("clickId");
CREATE INDEX "AffiliateReferral_affiliateId_registeredAt_idx" ON "AffiliateReferral"("affiliateId", "registeredAt");
CREATE UNIQUE INDEX "AffiliateCommission_internshipPaymentId_key" ON "AffiliateCommission"("internshipPaymentId");
CREATE INDEX "AffiliateCommission_affiliateId_createdAt_idx" ON "AffiliateCommission"("affiliateId", "createdAt");
CREATE INDEX "AffiliatePayout_affiliateId_requestedAt_idx" ON "AffiliatePayout"("affiliateId", "requestedAt");
CREATE INDEX "AffiliatePayout_status_requestedAt_idx" ON "AffiliatePayout"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "AffiliateClick"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "AffiliateReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_internshipPaymentId_fkey" FOREIGN KEY ("internshipPaymentId") REFERENCES "InternshipPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "AffiliateProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Move earlier affiliate data into the new tables. Commissions aren't
-- copied: the app records them from the paid internship payments.
INSERT INTO "AffiliateProfile" ("userId", "code", "autoMonthlyPayout", "joinedAt", "updatedAt")
SELECT "id", "referralCode", "referralPayoutPreference" = 'MONTHLY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" WHERE "referralCode" IS NOT NULL;

INSERT INTO "AffiliateClick" ("id", "affiliateId", "visitorKey", "firstVisitedAt", "lastVisitedAt")
SELECT c."id", c."referrerId", c."visitorKey", c."firstVisitedAt", c."lastVisitedAt"
FROM "ReferralClick" c
JOIN "AffiliateProfile" p ON p."userId" = c."referrerId"
WHERE c."shareId" IS NULL;

INSERT INTO "AffiliateReferral" ("id", "affiliateId", "referredUserId", "clickId", "registeredAt")
SELECT a."id", a."referrerId", a."referredUserId",
       CASE WHEN EXISTS (SELECT 1 FROM "AffiliateClick" k WHERE k."id" = a."clickId") THEN a."clickId" END,
       a."registeredAt"
FROM "ReferralAttribution" a
JOIN "AffiliateProfile" p ON p."userId" = a."referrerId"
WHERE a."shareId" IS NULL;

-- Earlier payout requests had no bank details; the admin can see that.
INSERT INTO "AffiliatePayout" ("id", "affiliateId", "amount", "status", "bankName", "accountNumber", "accountName", "requestedAt", "processedAt", "adminNote")
SELECT r."id", r."userId", r."amount", r."status"::TEXT::"AffiliatePayoutStatus", 'Not provided', 'Not provided', 'Not provided', r."requestedAt", r."processedAt", r."adminNote"
FROM "ReferralPayout" r
JOIN "AffiliateProfile" p ON p."userId" = r."userId";

-- Referrals (brag shares) always have a share again.
DELETE FROM "ReferralAttribution" WHERE "shareId" IS NULL;
DELETE FROM "ReferralClick" WHERE "shareId" IS NULL;

ALTER TABLE "ReferralAttribution" ALTER COLUMN "shareId" SET NOT NULL;

ALTER TABLE "ReferralClick" DROP CONSTRAINT "ReferralClick_referrerId_fkey";
DROP INDEX "ReferralClick_referrerId_visitorKey_key";
ALTER TABLE "ReferralClick" DROP COLUMN "referrerId",
ALTER COLUMN "shareId" SET NOT NULL;

-- Settings keep the values an admin already chose.
ALTER TABLE "PlatformSettings" RENAME COLUMN "referralCommissionPercent" TO "affiliateCommissionPercent";
ALTER TABLE "PlatformSettings" RENAME COLUMN "referralPayoutMinimumNaira" TO "affiliatePayoutMinimum";
ALTER TABLE "PlatformSettings" DROP COLUMN "referralPayoutMonthlyEnabled";

DROP INDEX "User_referralCode_key";
ALTER TABLE "User" DROP COLUMN "referralCode",
DROP COLUMN "referralPayoutPreference";

DROP TABLE "ReferralPayout";
DROP TYPE "ReferralPayoutPreference";
DROP TYPE "ReferralPayoutStatus";
