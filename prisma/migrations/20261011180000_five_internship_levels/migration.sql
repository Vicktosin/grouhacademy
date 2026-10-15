-- Preserve existing IDs and foreign-key associations while normalizing both
-- the original three-level ladder and databases that already have five levels.
UPDATE "InternshipLevel" SET "rank" = "rank" + 100000;

UPDATE "InternshipLevel"
SET "name" = 'Beginner', "description" = 'The first level for new interns.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-entry';

UPDATE "InternshipLevel"
SET "name" = 'Intermediate', "description" = 'Build on the foundations from Novice level.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-intermediate'
  AND NOT EXISTS (
      SELECT 1 FROM "InternshipLevel" WHERE "name" = 'Intermediate' AND "id" <> 'level-intermediate'
  );

UPDATE "InternshipLevel"
SET "name" = 'Advanced', "description" = 'Apply advanced skills developed through Intermediate level.', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-senior'
  AND NOT EXISTS (
      SELECT 1 FROM "InternshipLevel" WHERE "name" = 'Advanced' AND "id" <> 'level-senior'
  );

INSERT INTO "InternshipLevel" ("id", "name", "rank", "description", "createdAt", "updatedAt")
SELECT 'level-novice', 'Novice', -100000, 'Develop core skills after Beginner level.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InternshipLevel" WHERE "name" = 'Novice')
  AND NOT EXISTS (SELECT 1 FROM "InternshipLevel" WHERE "id" = 'level-novice');

INSERT INTO "InternshipLevel" ("id", "name", "rank", "description", "createdAt", "updatedAt")
SELECT 'level-professional', 'Professional', -100001, 'Demonstrate professional-level expertise after Advanced level.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "InternshipLevel" WHERE "name" = 'Professional')
  AND NOT EXISTS (SELECT 1 FROM "InternshipLevel" WHERE "id" = 'level-professional');

UPDATE "InternshipLevel"
SET
    "rank" = CASE "name"
        WHEN 'Beginner' THEN 1
        WHEN 'Novice' THEN 2
        WHEN 'Intermediate' THEN 3
        WHEN 'Advanced' THEN 4
        WHEN 'Professional' THEN 5
    END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" IN ('Beginner', 'Novice', 'Intermediate', 'Advanced', 'Professional');

WITH custom_levels AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "rank", "id") + 5 AS "rank"
    FROM "InternshipLevel"
    WHERE "name" NOT IN ('Beginner', 'Novice', 'Intermediate', 'Advanced', 'Professional')
)
UPDATE "InternshipLevel" AS level
SET "rank" = custom_levels."rank"
FROM custom_levels
WHERE level."id" = custom_levels."id";