CREATE TYPE "ReferralPayoutStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');
CREATE TYPE "ReferralPayoutPreference" AS ENUM ('WHEN_ELIGIBLE', 'MONTHLY');

ALTER TABLE "PlatformSettings"
ADD COLUMN "referralPayoutMinimumNaira" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN "referralPayoutMonthlyEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
ADD COLUMN "referralPayoutPreference" "ReferralPayoutPreference" NOT NULL DEFAULT 'WHEN_ELIGIBLE';

CREATE TABLE "ReferralPayout" (
  "id" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "ReferralPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "adminNote" TEXT,
  "thresholdNotificationSent" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReferralPayout_userId_requestedAt_idx" ON "ReferralPayout"("userId", "requestedAt");
CREATE INDEX "ReferralPayout_status_requestedAt_idx" ON "ReferralPayout"("status", "requestedAt");
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
