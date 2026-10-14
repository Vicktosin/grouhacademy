-- Share cards: the intern's own photo and the channels they shared on.
ALTER TABLE "AchievementShare" ADD COLUMN IF NOT EXISTS "photoKey" TEXT;
ALTER TABLE "AchievementShare" ADD COLUMN IF NOT EXISTS "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Brag-worthy titles for the starter achievements. {track} and {level} are
-- filled in when an intern unlocks one ("Wizard of Digital Marketing").
-- Only rows an admin hasn't renamed are changed.
UPDATE "AchievementDefinition" SET "title" = '{track} Rising Star', "description" = 'Got a first internship task accepted.', "congratulatoryMessage" = 'The first win is the hardest, and you just got it!', "icon" = 'star', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-first-task' AND "title" = 'Mission Starter';
UPDATE "AchievementDefinition" SET "title" = 'Wizard of {track}', "description" = 'Scored a perfect 100% on an internship task.', "congratulatoryMessage" = 'Flawless. Not a single point missed. Pure wizardry!', "rarity" = 'LEGENDARY', "icon" = 'wand', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-perfect-score' AND "title" = '100% Legend';
UPDATE "AchievementDefinition" SET "title" = '{track} Prodigy', "description" = 'Scored 90% or more on an internship task.', "congratulatoryMessage" = 'Top-tier work. Your mentors noticed!', "rarity" = 'EPIC', "icon" = 'rocket', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-high-score' AND "title" = 'Outstanding Performer';
UPDATE "AchievementDefinition" SET "description" = 'Finished every task in an internship week.', "congratulatoryMessage" = 'A full week, done and dusted. Unstoppable!', "isRepeatable" = true, "icon" = 'flame', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-week-complete' AND "title" = 'Week Warrior';
UPDATE "AchievementDefinition" SET "description" = 'Got five internship tasks accepted.', "congratulatoryMessage" = 'Five down. You are on a roll!', "icon" = 'zap', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-task-count' AND "title" = 'Task Terminator';
UPDATE "AchievementDefinition" SET "title" = 'Certified Office Pro', "description" = 'Completed a full workday in Office Life.', "congratulatoryMessage" = 'Emails, meetings, deliverables: you handled the whole day like a pro!', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-office-life' AND "title" = 'Office Life Pro';
UPDATE "AchievementDefinition" SET "title" = '{level} Level Unlocked', "description" = 'Advanced to a new internship level.', "congratulatoryMessage" = 'New level, bigger challenges. You earned this!', "rarity" = 'LEGENDARY', "icon" = 'crown', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-level-up' AND "title" = 'Level-Up Legend';
UPDATE "AchievementDefinition" SET "title" = 'Captain of the Squad', "description" = 'Led a group task that a mentor accepted.', "congratulatoryMessage" = 'Your team delivered, and your leadership made it happen!', "icon" = 'users', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-team-captain' AND "title" = 'Team Captain';
UPDATE "AchievementDefinition" SET "description" = 'Submitted a Practice Lab exercise.', "congratulatoryMessage" = 'You took on the challenge and shipped it!', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'seed-achievement-lab-complete' AND "title" = 'Challenge Crusher';

INSERT INTO "AchievementDefinition"
    ("id", "title", "description", "congratulatoryMessage", "category", "trigger", "conditions", "isRepeatable", "rarity", "icon", "updatedAt")
VALUES
    ('seed-achievement-hat-trick', 'Hat-Trick Hero', 'Got three internship tasks accepted.', 'Three for three. Keep that streak alive!', 'Consistency and Progress', 'TASK_COUNT', '{"minCount":3}', false, 'COMMON', 'flame', CURRENT_TIMESTAMP),
    ('seed-achievement-ten-tasks', 'Legend of {track}', 'Got ten internship tasks accepted.', 'Ten accepted tasks. Legends are made of this!', 'Consistency and Progress', 'TASK_COUNT', '{"minCount":10}', false, 'LEGENDARY', 'trophy', CURRENT_TIMESTAMP),
    ('seed-achievement-lab-genius', 'Lab Genius', 'Scored 100% on a Practice Lab exercise.', 'Every check passed. Certified genius!', 'Problem Solving', 'PRACTICE_LAB_COMPLETE', '{"minPercent":100}', false, 'EPIC', 'flask', CURRENT_TIMESTAMP),
    ('seed-achievement-officially-hired', 'Officially Hired', 'Clocked in for a first Office Life workday.', 'Welcome to the team! Your desk is ready.', 'Professional Practice', 'OFFICE_LIFE_CLOCK_IN', '{}', false, 'COMMON', 'briefcase-business', CURRENT_TIMESTAMP),
    ('seed-achievement-meeting-maestro', 'Meeting Maestro', 'Joined an Office Life meeting and spoke up.', 'You showed up, spoke up and made it count!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"meeting"}', false, 'COMMON', 'mic', CURRENT_TIMESTAMP),
    ('seed-achievement-boardroom-boss', 'Boardroom Boss', 'Scored 85+ in an Office Life meeting.', 'You owned that room. Boss moves only!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"meeting","minScore":85}', false, 'EPIC', 'crown', CURRENT_TIMESTAMP),
    ('seed-achievement-inbox-ninja', 'Inbox Ninja', 'Sent a first professional email in Office Life.', 'Clear, sharp and sent. Your inbox fears you now!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"email"}', false, 'COMMON', 'mail', CURRENT_TIMESTAMP),
    ('seed-achievement-email-guru', 'Email Guru', 'Wrote an Office Life email that scored 90+.', 'That email was chef''s kiss. Pure professionalism!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"email","minScore":90}', false, 'RARE', 'mail', CURRENT_TIMESTAMP),
    ('seed-achievement-report-rockstar', 'Report Rockstar', 'Delivered an Office Life report that scored 80+.', 'Numbers, insight, clarity. Your manager is impressed!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"report","minScore":80}', false, 'RARE', 'file-text', CURRENT_TIMESTAMP),
    ('seed-achievement-shipping-machine', 'Shipping Machine', 'Shipped Office Life work that scored 80+.', 'Delivered on time and on point. That is how pros work!', 'Professional Practice', 'OFFICE_LIFE_STEP', '{"stepKind":"work","minScore":80}', false, 'RARE', 'rocket', CURRENT_TIMESTAMP),
    ('seed-achievement-employee-of-month', 'Employee of the Month', 'Finished an Office Life workday with a score of 90+.', 'The whole office is talking about you. Outstanding!', 'Professional Practice', 'OFFICE_LIFE_COMPLETE', '{"minScore":90}', false, 'EPIC', 'trophy', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
