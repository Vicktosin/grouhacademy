ALTER TYPE "AuditActionType" ADD VALUE 'ACHIEVEMENT_CREATED';
ALTER TYPE "AuditActionType" ADD VALUE 'ACHIEVEMENT_UPDATED';
ALTER TYPE "AuditActionType" ADD VALUE 'ACHIEVEMENT_DEACTIVATED';

CREATE TYPE "AchievementTrigger" AS ENUM (
    'TASK_ACCEPTED',
    'GROUP_LEADERSHIP',
    'PERFECT_SCORE',
    'SCORE_THRESHOLD',
    'PRACTICE_LAB_COMPLETE',
    'WEEK_COMPLETE',
    'TASK_COUNT',
    'OFFICE_LIFE_COMPLETE',
    'LEVEL_UP'
);

CREATE TYPE "AchievementRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

CREATE TABLE "AchievementDefinition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "congratulatoryMessage" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "trigger" "AchievementTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "programId" TEXT,
    "levelId" TEXT,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "rarity" "AchievementRarity" NOT NULL DEFAULT 'COMMON',
    "icon" TEXT NOT NULL DEFAULT 'award',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AchievementDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AchievementUnlock" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "activityKey" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "messageSnapshot" TEXT NOT NULL,
    "categorySnapshot" TEXT NOT NULL,
    "raritySnapshot" "AchievementRarity" NOT NULL,
    "iconSnapshot" TEXT NOT NULL,
    "accomplishment" JSONB NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "celebratedAt" TIMESTAMP(3),
    CONSTRAINT "AchievementUnlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AchievementShare" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "achievementUnlockId" TEXT NOT NULL,
    "referrerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AchievementShare_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralClick" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrationStartedAt" TIMESTAMP(3),
    CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "clickId" TEXT,
    "referrerId" UUID NOT NULL,
    "referredUserId" UUID NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AchievementUnlock_definitionId_userId_activityKey_key"
    ON "AchievementUnlock"("definitionId", "userId", "activityKey");
CREATE INDEX "AchievementUnlock_userId_celebratedAt_unlockedAt_idx"
    ON "AchievementUnlock"("userId", "celebratedAt", "unlockedAt");
CREATE INDEX "AchievementUnlock_definitionId_unlockedAt_idx"
    ON "AchievementUnlock"("definitionId", "unlockedAt");
CREATE INDEX "AchievementDefinition_isActive_trigger_idx"
    ON "AchievementDefinition"("isActive", "trigger");
CREATE INDEX "AchievementDefinition_programId_levelId_idx"
    ON "AchievementDefinition"("programId", "levelId");
CREATE UNIQUE INDEX "AchievementShare_code_key" ON "AchievementShare"("code");
CREATE UNIQUE INDEX "AchievementShare_achievementUnlockId_key"
    ON "AchievementShare"("achievementUnlockId");
CREATE INDEX "AchievementShare_referrerId_createdAt_idx"
    ON "AchievementShare"("referrerId", "createdAt");
CREATE UNIQUE INDEX "ReferralClick_shareId_visitorKey_key"
    ON "ReferralClick"("shareId", "visitorKey");
CREATE INDEX "ReferralClick_shareId_firstVisitedAt_idx"
    ON "ReferralClick"("shareId", "firstVisitedAt");
CREATE UNIQUE INDEX "ReferralAttribution_clickId_key" ON "ReferralAttribution"("clickId");
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key"
    ON "ReferralAttribution"("referredUserId");
CREATE INDEX "ReferralAttribution_shareId_registeredAt_idx"
    ON "ReferralAttribution"("shareId", "registeredAt");
CREATE INDEX "ReferralAttribution_referrerId_registeredAt_idx"
    ON "ReferralAttribution"("referrerId", "registeredAt");

ALTER TABLE "AchievementDefinition"
    ADD CONSTRAINT "AchievementDefinition_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementDefinition"
    ADD CONSTRAINT "AchievementDefinition_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "InternshipLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementUnlock"
    ADD CONSTRAINT "AchievementUnlock_definitionId_fkey"
    FOREIGN KEY ("definitionId") REFERENCES "AchievementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AchievementUnlock"
    ADD CONSTRAINT "AchievementUnlock_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementShare"
    ADD CONSTRAINT "AchievementShare_achievementUnlockId_fkey"
    FOREIGN KEY ("achievementUnlockId") REFERENCES "AchievementUnlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementShare"
    ADD CONSTRAINT "AchievementShare_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralClick"
    ADD CONSTRAINT "ReferralClick_shareId_fkey"
    FOREIGN KEY ("shareId") REFERENCES "AchievementShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution"
    ADD CONSTRAINT "ReferralAttribution_shareId_fkey"
    FOREIGN KEY ("shareId") REFERENCES "AchievementShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution"
    ADD CONSTRAINT "ReferralAttribution_clickId_fkey"
    FOREIGN KEY ("clickId") REFERENCES "ReferralClick"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution"
    ADD CONSTRAINT "ReferralAttribution_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution"
    ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AchievementDefinition"
    ("id", "title", "description", "congratulatoryMessage", "category", "trigger", "conditions", "rarity", "icon", "updatedAt")
VALUES
    ('seed-achievement-first-task', 'Mission Starter', 'Your first task was accepted by a mentor.', 'A great start. Keep building your momentum!', 'Consistency and Progress', 'TASK_ACCEPTED', '{}', 'COMMON', 'award', CURRENT_TIMESTAMP),
    ('seed-achievement-team-captain', 'Team Captain', 'Lead a group task that is accepted by a mentor.', 'Your team delivered, and your leadership made a difference!', 'Leadership and Teamwork', 'GROUP_LEADERSHIP', '{}', 'RARE', 'trophy', CURRENT_TIMESTAMP),
    ('seed-achievement-lab-complete', 'Challenge Crusher', 'Submit a completed Practice Lab challenge.', 'You took on the challenge and submitted your work!', 'Problem Solving', 'PRACTICE_LAB_COMPLETE', '{}', 'COMMON', 'zap', CURRENT_TIMESTAMP),
    ('seed-achievement-perfect-score', '100% Legend', 'Earn a perfect score on an accepted internship task.', 'Flawless work. You earned every point!', 'Exceptional Performance', 'PERFECT_SCORE', '{}', 'EPIC', 'award', CURRENT_TIMESTAMP),
    ('seed-achievement-high-score', 'Outstanding Performer', 'Score at least 90% on an accepted task.', 'Excellent work. Your preparation really showed!', 'Exceptional Performance', 'SCORE_THRESHOLD', '{"minPercent":90}', 'RARE', 'award', CURRENT_TIMESTAMP),
    ('seed-achievement-week-complete', 'Week Warrior', 'Get every assigned task in a cohort week accepted.', 'You completed the full week. Keep that momentum going!', 'Consistency and Progress', 'WEEK_COMPLETE', '{}', 'RARE', 'calendar-check', CURRENT_TIMESTAMP),
    ('seed-achievement-task-count', 'Task Terminator', 'Have five internship tasks accepted.', 'Five milestones down. You are proving your consistency!', 'Consistency and Progress', 'TASK_COUNT', '{"minCount":5}', 'RARE', 'check-check', CURRENT_TIMESTAMP),
    ('seed-achievement-office-life', 'Office Life Pro', 'Complete an Office Life workday.', 'You handled the workday from start to finish!', 'Professional Practice', 'OFFICE_LIFE_COMPLETE', '{}', 'COMMON', 'briefcase-business', CURRENT_TIMESTAMP),
    ('seed-achievement-level-up', 'Level-Up Legend', 'Advance to a new paid internship level.', 'You have earned your next challenge. Congratulations!', 'Consistency and Progress', 'LEVEL_UP', '{}', 'EPIC', 'trending-up', CURRENT_TIMESTAMP);
