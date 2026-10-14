-- Screenshots and WordPress site snapshots of Practice Lab task submissions,
-- so mentors see the intern's site, not only a text summary.
ALTER TABLE "TaskSubmission" ADD COLUMN IF NOT EXISTS "labArtifacts" JSONB;
