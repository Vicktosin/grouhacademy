-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('NOT_CONTACTED', 'CONTACTED', 'NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "FollowUpStage" AS ENUM ('PASSED_UNPAID', 'FAILED');

-- CreateEnum
CREATE TYPE "FollowUpChannel" AS ENUM ('WHATSAPP', 'CALL');

-- CreateTable
CREATE TABLE "InternshipFollowUp" (
    "applicationId" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "note" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "lastContactedById" UUID,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipFollowUp_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "InternshipFollowUpLog" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "adminId" UUID,
    "channel" "FollowUpChannel" NOT NULL,
    "stage" "FollowUpStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipFollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipFollowUpTemplate" (
    "stage" "FollowUpStage" NOT NULL,
    "body" TEXT NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipFollowUpTemplate_pkey" PRIMARY KEY ("stage")
);

-- CreateIndex
CREATE INDEX "InternshipFollowUp_status_idx" ON "InternshipFollowUp"("status");

-- CreateIndex
CREATE INDEX "InternshipFollowUp_nextFollowUpAt_idx" ON "InternshipFollowUp"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "InternshipFollowUpLog_applicationId_createdAt_idx" ON "InternshipFollowUpLog"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "InternshipFollowUp" ADD CONSTRAINT "InternshipFollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipFollowUp" ADD CONSTRAINT "InternshipFollowUp_lastContactedById_fkey" FOREIGN KEY ("lastContactedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipFollowUpLog" ADD CONSTRAINT "InternshipFollowUpLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipFollowUpLog" ADD CONSTRAINT "InternshipFollowUpLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipFollowUpTemplate" ADD CONSTRAINT "InternshipFollowUpTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

