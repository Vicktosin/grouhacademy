-- Groups now belong to a cohort, and group numbers restart at 1 per cohort.
--
-- Written to be re-runnable: the first attempt to apply this migration failed
-- partway through (after adding the column and dropping the old index), so
-- every step tolerates having already run.
ALTER TABLE "InternshipGroup" ADD COLUMN IF NOT EXISTS "cohortId" TEXT;

DROP INDEX IF EXISTS "InternshipGroup_programId_number_key";

-- Discard any partial backfill from the failed attempt before recomputing.
UPDATE "InternshipGroup" SET "cohortId" = NULL WHERE "cohortId" IS NOT NULL;

-- Backfill: a group whose members all share one cohort of the group's own
-- program joins that cohort. Groups that mix cohorts, have unplaced members,
-- or whose members point at another program's cohort stay without a cohort
-- so an administrator can reorganise them from the Groups page.
UPDATE "InternshipGroup" AS g
SET "cohortId" = sub."cohortId"
FROM (
    SELECT m."groupId", MIN(c."id") AS "cohortId"
    FROM "InternshipGroupMember" AS m
    JOIN "InternshipApplication" AS a
      ON a."studentId" = m."userId" AND a."programId" = m."programId"
    LEFT JOIN "InternshipCohort" AS c
      ON c."id" = a."cohortId" AND c."programId" = m."programId"
    GROUP BY m."groupId"
    HAVING COUNT(DISTINCT c."id") = 1
       AND COUNT(*) = COUNT(c."id")
) AS sub
WHERE g."id" = sub."groupId";

CREATE UNIQUE INDEX IF NOT EXISTS "InternshipGroup_cohortId_number_key" ON "InternshipGroup"("cohortId", "number");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'InternshipGroup_cohortId_fkey'
    ) THEN
        ALTER TABLE "InternshipGroup" ADD CONSTRAINT "InternshipGroup_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "InternshipCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
