-- AlterTable
ALTER TABLE "InternshipCohort" ADD COLUMN     "certificatePassMark" INTEGER NOT NULL DEFAULT 70;

-- AlterTable
ALTER TABLE "InternshipTask" ADD COLUMN     "cohortId" TEXT NOT NULL,
ADD COLUMN     "dueDay" INTEGER NOT NULL,
ADD COLUMN     "dueTime" TEXT NOT NULL,
ADD COLUMN     "dueWeek" INTEGER NOT NULL,
ADD COLUMN     "opensAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "opensDay" INTEGER NOT NULL,
ADD COLUMN     "opensTime" TEXT NOT NULL,
ADD COLUMN     "opensWeek" INTEGER NOT NULL,
ALTER COLUMN "dueDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "TaskSubmission" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "TaskSubmissionParticipant" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "TaskSubmissionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSubmissionParticipant_userId_idx" ON "TaskSubmissionParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmissionParticipant_submissionId_userId_key" ON "TaskSubmissionParticipant"("submissionId", "userId");

-- CreateIndex
CREATE INDEX "InternshipTask_cohortId_dueDate_idx" ON "InternshipTask"("cohortId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSubmission_taskId_groupId_key" ON "TaskSubmission"("taskId", "groupId");

-- AddForeignKey
ALTER TABLE "InternshipTask" ADD CONSTRAINT "InternshipTask_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "InternshipCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmission" ADD CONSTRAINT "TaskSubmission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "InternshipGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionParticipant" ADD CONSTRAINT "TaskSubmissionParticipant_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TaskSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubmissionParticipant" ADD CONSTRAINT "TaskSubmissionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

