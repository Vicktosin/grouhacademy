CREATE TABLE "InternshipOnboardingQuestion" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InternshipOnboardingQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InternshipOnboardingQuestion_active_order_idx" ON "InternshipOnboardingQuestion"("active", "order");

INSERT INTO "InternshipOnboardingQuestion" ("id", "prompt", "fieldType", "options", "required", "order", "active", "updatedAt") VALUES
  ('onboarding-experience-level', 'What''s your experience level?', 'select', '["Complete beginner", "Some self-taught experience", "Studied it formally", "Have work experience"]', true, 10, true, CURRENT_TIMESTAMP),
  ('onboarding-availability', 'How much time can you commit weekly?', 'select', '["Less than 10 hrs/week", "10–20 hrs/week", "20–30 hrs/week", "30+ hrs/week"]', true, 20, true, CURRENT_TIMESTAMP),
  ('onboarding-motivation', 'Why do you want to join this internship?', 'textarea', '[]', true, 30, true, CURRENT_TIMESTAMP);
