ALTER TABLE "OfficeLifeContent" ADD COLUMN "levelId" TEXT;
DROP INDEX "OfficeLifeContent_programId_key";

UPDATE "OfficeLifeContent"
SET "levelId" = (SELECT "id" FROM "InternshipLevel" ORDER BY "rank" ASC LIMIT 1)
WHERE "levelId" IS NULL;

ALTER TABLE "OfficeLifeContent" ALTER COLUMN "levelId" SET NOT NULL;

INSERT INTO "OfficeLifeContent" ("id", "programId", "levelId", "content", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, content."programId", level."id", content."content", content."createdAt", CURRENT_TIMESTAMP
FROM "OfficeLifeContent" content
CROSS JOIN "InternshipLevel" level
WHERE level."id" <> content."levelId";

CREATE UNIQUE INDEX "OfficeLifeContent_programId_levelId_key" ON "OfficeLifeContent"("programId", "levelId");
ALTER TABLE "OfficeLifeContent"
ADD CONSTRAINT "OfficeLifeContent_levelId_fkey"
FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeLifeDay" ADD COLUMN "levelId" TEXT;

UPDATE "OfficeLifeDay"
SET "levelId" = COALESCE(
		(
				SELECT application."levelId"
				FROM "InternshipApplication" application
				WHERE application."studentId" = "OfficeLifeDay"."userId"
					AND application."programId" = "OfficeLifeDay"."programId"
				ORDER BY application."createdAt" DESC
				LIMIT 1
		),
		(SELECT "id" FROM "InternshipLevel" ORDER BY "rank" ASC LIMIT 1)
)
WHERE "levelId" IS NULL;

ALTER TABLE "OfficeLifeDay" ALTER COLUMN "levelId" SET NOT NULL;
DROP INDEX "OfficeLifeDay_userId_programId_day_key";
CREATE UNIQUE INDEX "OfficeLifeDay_userId_programId_levelId_day_key" ON "OfficeLifeDay"("userId", "programId", "levelId", "day");
ALTER TABLE "OfficeLifeDay"
ADD CONSTRAINT "OfficeLifeDay_levelId_fkey"
FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;