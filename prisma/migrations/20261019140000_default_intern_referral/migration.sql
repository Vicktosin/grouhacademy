ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
ALTER TABLE "ReferralClick" ALTER COLUMN "shareId" DROP NOT NULL;
ALTER TABLE "ReferralClick" ADD COLUMN "referrerId" UUID;
ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ReferralClick_referrerId_visitorKey_key" ON "ReferralClick"("referrerId", "visitorKey");
ALTER TABLE "ReferralAttribution" ALTER COLUMN "shareId" DROP NOT NULL;
