-- CreateEnum
CREATE TYPE "LabKind" AS ENUM ('WEB', 'REACT');

-- CreateEnum
CREATE TYPE "LabAttemptStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "InternshipTask" ADD COLUMN     "labScenarioId" TEXT;

-- CreateTable
CREATE TABLE "LabScenario" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "kind" "LabKind" NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "starterFiles" JSONB NOT NULL,
    "solutionFiles" JSONB,
    "checks" JSONB NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabAttempt" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "status" "LabAttemptStatus" NOT NULL DEFAULT 'DRAFT',
    "checksPassed" INTEGER,
    "checksTotal" INTEGER,
    "checkResults" JSONB,
    "review" JSONB,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabScenario_programId_levelId_published_idx" ON "LabScenario"("programId", "levelId", "published");

-- CreateIndex
CREATE INDEX "LabAttempt_scenarioId_idx" ON "LabAttempt"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "LabAttempt_userId_scenarioId_key" ON "LabAttempt"("userId", "scenarioId");

-- AddForeignKey
ALTER TABLE "InternshipTask" ADD CONSTRAINT "InternshipTask_labScenarioId_fkey" FOREIGN KEY ("labScenarioId") REFERENCES "LabScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabScenario" ADD CONSTRAINT "LabScenario_programId_fkey" FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabScenario" ADD CONSTRAINT "LabScenario_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAttempt" ADD CONSTRAINT "LabAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabAttempt" ADD CONSTRAINT "LabAttempt_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "LabScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

