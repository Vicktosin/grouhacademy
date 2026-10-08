-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('STARTING', 'ACTIVE', 'ENDED', 'SCORED', 'FAILED');

-- CreateTable
CREATE TABLE "InterviewSetup" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "setupId" TEXT NOT NULL,
    "applicationId" TEXT,
    "mode" "InterviewMode" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'STARTING',
    "tavusConversationId" TEXT,
    "conversationUrl" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "shutdownReason" TEXT,
    "transcript" JSONB,
    "recordingUri" TEXT,
    "score" INTEGER,
    "feedback" JSONB,
    "scoredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSetup_programId_levelId_key" ON "InterviewSetup"("programId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSession_tavusConversationId_key" ON "InterviewSession"("tavusConversationId");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_setupId_idx" ON "InterviewSession"("userId", "setupId");

-- CreateIndex
CREATE INDEX "InterviewSession_status_idx" ON "InterviewSession"("status");

-- AddForeignKey
ALTER TABLE "InterviewSetup" ADD CONSTRAINT "InterviewSetup_programId_fkey" FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSetup" ADD CONSTRAINT "InterviewSetup_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "InterviewSetup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

