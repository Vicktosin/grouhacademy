-- Preserve the existing level IDs and every foreign-key association while
-- changing the shared internship ladder to Beginner → Professional.

UPDATE "InternshipLevel"
SET "rank" = "rank" + 100;

UPDATE "InternshipLevel"
SET
    "name" = 'Beginner',
    "rank" = 1,
    "description" = 'The first level for new interns.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-entry';

UPDATE "InternshipLevel"
SET
    "name" = 'Intermediate',
    "rank" = 3,
    "description" = 'Build on the foundations from Novice level.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-intermediate';

UPDATE "InternshipLevel"
SET
    "name" = 'Advanced',
    "rank" = 4,
    "description" = 'Apply advanced skills developed through Intermediate level.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'level-senior';

-- Keep any additional custom levels after the five standard levels.
UPDATE "InternshipLevel"
SET "rank" = "rank" - 98
WHERE "id" NOT IN ('level-entry', 'level-intermediate', 'level-senior');

INSERT INTO "InternshipLevel" ("id", "name", "rank", "description", "createdAt", "updatedAt") VALUES
    ('level-novice', 'Novice', 2, 'Develop core skills after Beginner level.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('level-professional', 'Professional', 5, 'Demonstrate professional-level expertise after Advanced level.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);