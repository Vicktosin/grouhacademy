-- Internship levels. Everything that exists today belongs to Entry.

-- CreateTable
CREATE TABLE "InternshipLevel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternshipLevel_name_key" ON "InternshipLevel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InternshipLevel_rank_key" ON "InternshipLevel"("rank");

-- The starting levels. Admins can add more later.
INSERT INTO "InternshipLevel" ("id", "name", "rank", "description", "updatedAt") VALUES
    ('level-entry', 'Entry', 1, 'Where every intern starts.', CURRENT_TIMESTAMP),
    ('level-intermediate', 'Intermediate', 2, 'For interns who have completed Entry level.', CURRENT_TIMESTAMP),
    ('level-senior', 'Senior', 3, 'For interns who have completed Intermediate level.', CURRENT_TIMESTAMP);

-- Existing rows get Entry; the default is dropped so new rows must say.
ALTER TABLE "InternshipApplication" ADD COLUMN "levelId" TEXT NOT NULL DEFAULT 'level-entry';
ALTER TABLE "InternshipApplication" ALTER COLUMN "levelId" DROP DEFAULT;
ALTER TABLE "InternshipCohort" ADD COLUMN "levelId" TEXT NOT NULL DEFAULT 'level-entry';
ALTER TABLE "InternshipCohort" ALTER COLUMN "levelId" DROP DEFAULT;
ALTER TABLE "InternshipAssessment" ADD COLUMN "levelId" TEXT NOT NULL DEFAULT 'level-entry';
ALTER TABLE "InternshipAssessment" ALTER COLUMN "levelId" DROP DEFAULT;
ALTER TABLE "InternResource" ADD COLUMN "levelId" TEXT NOT NULL DEFAULT 'level-entry';
ALTER TABLE "InternResource" ALTER COLUMN "levelId" DROP DEFAULT;

-- One application per track per level (was one per track).
DROP INDEX "InternshipApplication_studentId_programId_key";
CREATE UNIQUE INDEX "InternshipApplication_studentId_programId_levelId_key" ON "InternshipApplication"("studentId", "programId", "levelId");
CREATE INDEX "InternshipApplication_levelId_idx" ON "InternshipApplication"("levelId");

DROP INDEX "InternshipAssessment_programId_idx";
CREATE INDEX "InternshipAssessment_programId_levelId_idx" ON "InternshipAssessment"("programId", "levelId");

CREATE INDEX "InternshipCohort_levelId_idx" ON "InternshipCohort"("levelId");

DROP INDEX "InternResource_status_idx";
CREATE INDEX "InternResource_status_levelId_idx" ON "InternResource"("status", "levelId");

-- AddForeignKey
ALTER TABLE "InternshipCohort" ADD CONSTRAINT "InternshipCohort_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternshipApplication" ADD CONSTRAINT "InternshipApplication_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternshipAssessment" ADD CONSTRAINT "InternshipAssessment_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternResource" ADD CONSTRAINT "InternResource_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
