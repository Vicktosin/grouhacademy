ALTER TABLE "InternshipTask" ADD COLUMN "officeLifeDay" INTEGER;

ALTER TABLE "InternshipTask"
ADD CONSTRAINT "InternshipTask_officeLifeDay_check"
CHECK ("officeLifeDay" IS NULL OR "officeLifeDay" BETWEEN 1 AND 4);ALTER TABLE "InternshipTask" ADD COLUMN "officeLifeDay" INTEGER;

ALTER TABLE "InternshipTask"
ADD CONSTRAINT "InternshipTask_officeLifeDay_check"
CHECK ("officeLifeDay" IS NULL OR "officeLifeDay" BETWEEN 1 AND 4);