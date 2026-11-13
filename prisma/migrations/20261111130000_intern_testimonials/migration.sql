-- Testimonials: text only. Videos stay in Google Drive; we store the folder
-- link (per cohort, or a global fallback) and an optional pasted video link.

CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "InternshipCohort" ADD COLUMN "testimonialDriveUrl" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN "testimonialDriveUrl" TEXT;

CREATE TABLE "InternTestimonial" (
  "id" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "applicationId" TEXT NOT NULL,
  "cohortId" TEXT,
  "programId" TEXT NOT NULL,
  "videoLink" TEXT,
  "testimonial" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "consent" BOOLEAN NOT NULL DEFAULT false,
  "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternTestimonial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternTestimonial_applicationId_key" ON "InternTestimonial"("applicationId");
CREATE INDEX "InternTestimonial_cohortId_idx" ON "InternTestimonial"("cohortId");
CREATE INDEX "InternTestimonial_programId_idx" ON "InternTestimonial"("programId");
CREATE INDEX "InternTestimonial_status_idx" ON "InternTestimonial"("status");

ALTER TABLE "InternTestimonial"
  ADD CONSTRAINT "InternTestimonial_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternTestimonial"
  ADD CONSTRAINT "InternTestimonial_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "InternshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InternTestimonial"
  ADD CONSTRAINT "InternTestimonial_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "InternshipCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InternTestimonial"
  ADD CONSTRAINT "InternTestimonial_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "InternshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
