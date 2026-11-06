-- Step 1: Task Library, Cohort Switch, and Pool foundations
-- Additive only: no existing column is dropped, renamed, or made stricter.
-- All existing InternshipTask rows keep cohortId (now nullable).
-- All existing tasks, groups, and submissions are unchanged.

-- ── PlatformSettings: cohort-system switch (Step 3) ──────────────────────────
ALTER TABLE "PlatformSettings"
  ADD COLUMN "cohortSystemEnabled" BOOLEAN NOT NULL DEFAULT true;

-- ── InternshipApplication: self-paced start date (Step 3) ───────────────────
ALTER TABLE "InternshipApplication"
  ADD COLUMN "selfPacedStartDate" TIMESTAMP(3);

-- ── InternshipTask: make cohortId nullable + add templateId (Step 2) ─────────
-- DROP NOT NULL is non-destructive: existing rows all have a value already.
ALTER TABLE "InternshipTask"
  ALTER COLUMN "cohortId" DROP NOT NULL;

ALTER TABLE "InternshipTask"
  ADD COLUMN "templateId" TEXT;

-- applicationId links a self-paced task to exactly one intern's application.
-- Null on all existing cohort tasks; set only when cohortId is null.
ALTER TABLE "InternshipTask"
  ADD COLUMN "applicationId" TEXT;

CREATE INDEX "InternshipTask_templateId_idx"
  ON "InternshipTask"("templateId");

CREATE INDEX "InternshipTask_applicationId_idx"
  ON "InternshipTask"("applicationId");

-- ── InternshipCohort: pool link (Step 4) ─────────────────────────────────────
ALTER TABLE "InternshipCohort"
  ADD COLUMN "poolId" TEXT;

-- ── InternshipGroup: pool link (Step 4) ──────────────────────────────────────
ALTER TABLE "InternshipGroup"
  ADD COLUMN "poolId" TEXT;

CREATE INDEX "InternshipGroup_poolId_idx"
  ON "InternshipGroup"("poolId");

-- ── InternshipGroupPool (Step 4) ─────────────────────────────────────────────
CREATE TABLE "InternshipGroupPool" (
  "id"        TEXT         NOT NULL,
  "levelId"   TEXT         NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternshipGroupPool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternshipGroupPool_levelId_startDate_key"
  ON "InternshipGroupPool"("levelId", "startDate");

CREATE INDEX "InternshipGroupPool_levelId_idx"
  ON "InternshipGroupPool"("levelId");

-- ── InternshipTaskTemplate (Step 2) ──────────────────────────────────────────
CREATE TABLE "InternshipTaskTemplate" (
  "id"            TEXT         NOT NULL,
  "programId"     TEXT,
  "levelId"       TEXT         NOT NULL,
  "title"         TEXT         NOT NULL,
  "description"   TEXT,
  "kind"          "TaskKind"   NOT NULL DEFAULT 'INDIVIDUAL',
  "opensWeek"     INTEGER      NOT NULL,
  "opensDay"      INTEGER      NOT NULL,
  "opensTime"     TEXT         NOT NULL,
  "dueWeek"       INTEGER      NOT NULL,
  "dueDay"        INTEGER      NOT NULL,
  "dueTime"       TEXT         NOT NULL,
  "maxScore"      INTEGER      NOT NULL DEFAULT 100,
  "labScenarioId" TEXT,
  "labPassMark"   INTEGER      NOT NULL DEFAULT 70,
  "officeLifeDay" INTEGER,
  "isShared"      BOOLEAN      NOT NULL DEFAULT false,
  "archived"      BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternshipTaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternshipTaskTemplate_programId_levelId_idx"
  ON "InternshipTaskTemplate"("programId", "levelId");

CREATE INDEX "InternshipTaskTemplate_levelId_archived_idx"
  ON "InternshipTaskTemplate"("levelId", "archived");

-- ── Foreign-key constraints ───────────────────────────────────────────────────
ALTER TABLE "InternshipTaskTemplate"
  ADD CONSTRAINT "InternshipTaskTemplate_programId_fkey"
    FOREIGN KEY ("programId")
    REFERENCES "InternshipProgram"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternshipTaskTemplate"
  ADD CONSTRAINT "InternshipTaskTemplate_levelId_fkey"
    FOREIGN KEY ("levelId")
    REFERENCES "InternshipLevel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternshipTaskTemplate"
  ADD CONSTRAINT "InternshipTaskTemplate_labScenarioId_fkey"
    FOREIGN KEY ("labScenarioId")
    REFERENCES "LabScenario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternshipGroupPool"
  ADD CONSTRAINT "InternshipGroupPool_levelId_fkey"
    FOREIGN KEY ("levelId")
    REFERENCES "InternshipLevel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternshipTask"
  ADD CONSTRAINT "InternshipTask_templateId_fkey"
    FOREIGN KEY ("templateId")
    REFERENCES "InternshipTaskTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternshipTask"
  ADD CONSTRAINT "InternshipTask_applicationId_fkey"
    FOREIGN KEY ("applicationId")
    REFERENCES "InternshipApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InternshipCohort"
  ADD CONSTRAINT "InternshipCohort_poolId_fkey"
    FOREIGN KEY ("poolId")
    REFERENCES "InternshipGroupPool"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InternshipGroup"
  ADD CONSTRAINT "InternshipGroup_poolId_fkey"
    FOREIGN KEY ("poolId")
    REFERENCES "InternshipGroupPool"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
