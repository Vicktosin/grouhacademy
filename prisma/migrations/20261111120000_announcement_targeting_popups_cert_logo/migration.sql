-- Announcements: target one or more cohorts, and optionally show as a pop-up
-- that each intern sees once (dismissals recorded per intern).
-- Certificates: a configurable logo (null keeps the bundled /logo.png).
-- Additive only: existing rows keep working unchanged.

ALTER TABLE "Announcement"
  ADD COLUMN "cohortIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "showAsPopup" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AnnouncementDismissal" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementDismissal_announcementId_userId_key"
  ON "AnnouncementDismissal"("announcementId", "userId");
CREATE INDEX "AnnouncementDismissal_userId_idx"
  ON "AnnouncementDismissal"("userId");

ALTER TABLE "AnnouncementDismissal"
  ADD CONSTRAINT "AnnouncementDismissal_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDismissal"
  ADD CONSTRAINT "AnnouncementDismissal_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformSettings"
  ADD COLUMN "certificateLogoUrl" TEXT;
