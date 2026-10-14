-- GROUP_LEADERSHIP and PRACTICE_LAB_COMPLETE already exist where the first
-- achievements migration created them; IF NOT EXISTS keeps this safe there.
-- New enum values can't be used in the transaction that adds them, so the
-- achievements that use them are added by the next migration.
ALTER TYPE "AchievementTrigger" ADD VALUE IF NOT EXISTS 'GROUP_LEADERSHIP';
ALTER TYPE "AchievementTrigger" ADD VALUE IF NOT EXISTS 'PRACTICE_LAB_COMPLETE';
ALTER TYPE "AchievementTrigger" ADD VALUE IF NOT EXISTS 'OFFICE_LIFE_CLOCK_IN';
ALTER TYPE "AchievementTrigger" ADD VALUE IF NOT EXISTS 'OFFICE_LIFE_STEP';
