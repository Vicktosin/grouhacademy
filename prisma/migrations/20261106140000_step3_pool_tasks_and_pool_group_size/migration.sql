-- Step 3 migration: pool GROUP tasks + poolGroupSize setting
-- Pool tasks (cohortId null, applicationId null, poolId set) are shared across
-- all tracks in a pool. One row per shared template per pool.
-- poolGroupSize is used instead of maxGroupSize when forming pool groups.

ALTER TABLE "InternshipTask"
  ADD COLUMN "poolId" TEXT;

CREATE INDEX "InternshipTask_poolId_idx"
  ON "InternshipTask"("poolId");

ALTER TABLE "InternshipTask"
  ADD CONSTRAINT "InternshipTask_poolId_fkey"
    FOREIGN KEY ("poolId")
    REFERENCES "InternshipGroupPool"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformSettings"
  ADD COLUMN "poolGroupSize" INTEGER NOT NULL DEFAULT 4;
