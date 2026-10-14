-- Celebrate handing a task in, not only its grade. Used by the next
-- migration (a new enum value can't be used in the transaction adding it).
ALTER TYPE "AchievementTrigger" ADD VALUE IF NOT EXISTS 'TASK_SUBMITTED';
