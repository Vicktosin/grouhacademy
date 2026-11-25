-- Task Library from the curriculum. Additive only.
-- curriculumKey: which curriculum task a template is, so the import can be
-- rerun without duplicates. The unique indexes stop two requests at the same
-- moment from making the same task twice for a cohort or an intern (rows
-- without a template aren't affected: NULLs are always distinct).
ALTER TABLE "InternshipTaskTemplate" ADD COLUMN IF NOT EXISTS "curriculumKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InternshipTaskTemplate_curriculumKey_key" ON "InternshipTaskTemplate"("curriculumKey");
CREATE UNIQUE INDEX IF NOT EXISTS "InternshipTask_cohortId_templateId_key" ON "InternshipTask"("cohortId", "templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "InternshipTask_applicationId_templateId_key" ON "InternshipTask"("applicationId", "templateId");
