-- Task submission history: every version submitted and every grade given.
-- Also who gave each submission's current grade (mentors may change their
-- own grades; admins any).

-- CreateEnum
CREATE TYPE "SubmissionEventKind" AS ENUM ('SUBMITTED', 'REVIEWED', 'AUTO_GRADED', 'SENT_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "SubmissionActorRole" AS ENUM ('INTERN', 'MENTOR', 'ADMIN', 'SYSTEM');

-- AlterTable
ALTER TABLE "TaskSubmission" ADD COLUMN "reviewedById" UUID;

-- CreateTable
CREATE TABLE "TaskSubmissionEvent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" "SubmissionEventKind" NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "status" "SubmissionStatus",
    "score" INTEGER,
    "feedback" TEXT,
    "actorId" UUID,
    "actorRole" "SubmissionActorRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSubmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSubmissionEvent_submissionId_createdAt_idx" ON "TaskSubmissionEvent"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskSubmissionEvent_actorId_idx" ON "TaskSubmissionEvent"("actorId");

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionEvent" ADD CONSTRAINT "TaskSubmissionEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionEvent" ADD CONSTRAINT "TaskSubmissionEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing submissions start their history with what's there now: the
-- latest version, and its grade if it has one (who graded it wasn't
-- recorded before, so the grader is left empty).
INSERT INTO "TaskSubmissionEvent" ("id", "submissionId", "kind", "content", "fileUrl", "actorId", "actorRole", "createdAt")
SELECT gen_random_uuid()::text, s."id", 'SUBMITTED', s."content", s."fileUrl", s."userId", 'INTERN', s."submittedAt"
FROM "TaskSubmission" s
WHERE s."status" <> 'DRAFT';

INSERT INTO "TaskSubmissionEvent" ("id", "submissionId", "kind", "status", "score", "feedback", "createdAt")
SELECT gen_random_uuid()::text, s."id", 'REVIEWED', s."status", s."score", s."feedback", s."reviewedAt"
FROM "TaskSubmission" s
WHERE s."reviewedAt" IS NOT NULL AND s."status" IN ('ACCEPTED', 'REJECTED', 'UNDER_REVIEW');
