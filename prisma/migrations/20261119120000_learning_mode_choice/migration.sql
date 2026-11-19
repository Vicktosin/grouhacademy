-- Interns choose self-paced or cohort learning per level. Additive only:
-- two enums, nullable/defaulted columns, and a backfill that records what
-- existing interns already are (no one is moved).

CREATE TYPE "LearningMode" AS ENUM ('SELF_PACED', 'COHORT');
CREATE TYPE "LearningModePolicy" AS ENUM ('CHOOSE', 'COHORT_ONLY', 'SELF_PACED_ONLY');

ALTER TABLE "InternshipApplication" ADD COLUMN "learningMode" "LearningMode";
ALTER TABLE "InternshipApplication" ADD COLUMN "learningModeChosenAt" TIMESTAMP(3);
ALTER TABLE "InternshipApplication" ADD COLUMN "cohortWaitlistedAt" TIMESTAMP(3);
ALTER TABLE "InternshipApplication" ADD COLUMN "switchedToCohortAt" TIMESTAMP(3);

ALTER TABLE "PlatformSettings" ADD COLUMN "learningModePolicy" "LearningModePolicy" NOT NULL DEFAULT 'CHOOSE';

-- Existing interns keep exactly what they have.
UPDATE "InternshipApplication" SET "learningMode" = 'COHORT'
  WHERE "cohortId" IS NOT NULL AND "learningMode" IS NULL;
UPDATE "InternshipApplication" SET "learningMode" = 'SELF_PACED'
  WHERE "cohortId" IS NULL AND "selfPacedStartDate" IS NOT NULL AND "learningMode" IS NULL;
-- A platform that had the cohort system switched off stays self-paced only.
UPDATE "PlatformSettings" SET "learningModePolicy" = 'SELF_PACED_ONLY' WHERE "cohortSystemEnabled" = false;

CREATE INDEX "InternshipApplication_learningMode_idx" ON "InternshipApplication"("learningMode");
