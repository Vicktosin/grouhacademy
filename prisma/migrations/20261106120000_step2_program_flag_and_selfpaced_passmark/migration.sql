-- Step 2 (additive only): program exclusion flag + self-paced cert pass mark

-- Flag on each track/program. Set to true for Special Class (and any other
-- program that must always use cohorts and never join mixed-track pools).
-- Default false so all existing programs are unaffected until an admin opts in.
ALTER TABLE "InternshipProgram"
  ADD COLUMN "excludeFromSelfPacedAndPools" BOOLEAN NOT NULL DEFAULT false;

-- Platform-wide score pass mark for self-paced certificates.
-- Separate from certificateMinimumCompletion (which controls task completion %).
-- Default 70 matches every existing cohort's certificatePassMark.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "selfPacedCertificatePassMark" INTEGER NOT NULL DEFAULT 70;
