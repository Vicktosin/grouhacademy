-- CreateEnum
CREATE TYPE "LearnerAudience" AS ENUM ('COURSES', 'INTERNSHIP');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "audience" "LearnerAudience";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "audience" "LearnerAudience";

-- CreateIndex
CREATE INDEX "Notification_userId_audience_read_idx" ON "Notification"("userId", "audience", "read");


-- Every existing notification was sent from the admin internship page to
-- internship applicants.
UPDATE "Notification" SET "audience" = 'INTERNSHIP' WHERE "audience" IS NULL;
