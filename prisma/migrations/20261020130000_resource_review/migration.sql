-- Support Admins send resources for review; only admins publish them.
ALTER TYPE "InternResourceStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'PUBLISHED';

ALTER TABLE "InternResource"
  ADD COLUMN "submittedForReviewAt" TIMESTAMP(3),
  ADD COLUMN "reviewNote" TEXT;
