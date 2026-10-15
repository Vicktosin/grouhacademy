-- Demo videos for the Office Life and Practice Lab "How it works" guides.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "officeLifeGuideVideoUrl" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "practiceLabGuideVideoUrl" TEXT;
