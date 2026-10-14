-- Every well-graded task is celebrated, once, at the best tier reached:
-- 75%+ Ace, 90%+ Prodigy, 100% Wizard (lib/achievements awards only the
-- highest). These repeat per task instead of only the first time.
UPDATE "AchievementDefinition" SET "isRepeatable" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('seed-achievement-perfect-score', 'seed-achievement-high-score')
  AND "title" IN ('Wizard of {track}', '100% Legend', '{track} Prodigy', 'Outstanding Performer');

INSERT INTO "AchievementDefinition"
    ("id", "title", "description", "congratulatoryMessage", "category", "trigger", "conditions", "isRepeatable", "rarity", "icon", "updatedAt")
VALUES
    ('seed-achievement-ace', '{track} Ace', 'Scored 75% or more on an internship task.', 'Solid, sharp work. Your mentor gave it the thumbs up!', 'Exceptional Performance', 'SCORE_THRESHOLD', '{"minPercent":75}', true, 'RARE', 'star', CURRENT_TIMESTAMP),
    ('seed-achievement-first-submission', 'First Mission Shipped', 'Handed in a first internship task.', 'You shipped real work. That is how careers start!', 'Consistency and Progress', 'TASK_SUBMITTED', '{"minCount":1}', false, 'COMMON', 'rocket', CURRENT_TIMESTAMP),
    ('seed-achievement-hustle-mode', 'Hustle Mode: ON', 'Handed in five more internship tasks.', 'Five more tasks shipped. Nothing can stop you now!', 'Consistency and Progress', 'TASK_SUBMITTED', '{"minCount":5}', true, 'RARE', 'flame', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
