ALTER TABLE "InternshipTask" ADD COLUMN IF NOT EXISTS "officeLifeDay" INTEGER;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'InternshipTask_officeLifeDay_check'
		  AND conrelid = '"InternshipTask"'::regclass
	) THEN
		ALTER TABLE "InternshipTask"
		ADD CONSTRAINT "InternshipTask_officeLifeDay_check"
		CHECK ("officeLifeDay" IS NULL OR "officeLifeDay" BETWEEN 1 AND 4);
	END IF;
END
$$;