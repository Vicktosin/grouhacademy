-- Admins can pause a group's discussion (members can read, not post).
ALTER TABLE "InternshipGroup" ADD COLUMN "discussionOpen" BOOLEAN NOT NULL DEFAULT true;
