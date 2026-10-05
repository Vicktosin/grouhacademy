import { getPrisma } from "@/lib/prisma";

// Gives /dev/auth test interns and students a complete internship (onboarded,
// exam passed, ₦0 acceptance fee paid) so every internship page can be tested
// directly. Their records live in a separate "Dev Test Cohort" so they never
// join real interns' cohorts or groups. Development bypass only.

const DEV_COHORT_SLUG_PREFIX = "dev-test-cohort";
const COHORT_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function ensureDevelopmentInternship(
  userId: string,
  email: string,
) {
  const prisma = getPrisma();
  const program = await prisma.internshipProgram.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      assessments: { select: { id: true }, take: 1 },
    },
  });
  if (!program) return;

  const slug = `${DEV_COHORT_SLUG_PREFIX}-${program.slug}`;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cohort =
    (await prisma.internshipCohort.findUnique({ where: { slug } })) ??
    (await prisma.internshipCohort.create({
      data: {
        programId: program.id,
        slug,
        name: "Dev Test Cohort",
        description:
          "Created automatically for /dev/auth test logins during local development. Safe to ignore.",
        startDate: today,
        endDate: new Date(today.getTime() + (COHORT_DAYS - 1) * DAY_MS),
        status: "ACTIVE",
      },
    }));

  const existing = await prisma.internshipApplication.findUnique({
    where: {
      studentId_programId: { studentId: userId, programId: program.id },
    },
    select: { id: true, cohortId: true, onboardingAnswers: true },
  });
  const application = existing
    ? await prisma.internshipApplication.update({
        where: { id: existing.id },
        data: {
          // Keep a cohort an admin chose; otherwise use the dev cohort.
          cohortId: existing.cohortId ?? cohort.id,
          onboardingAnswers: existing.onboardingAnswers ?? {
            source: "dev-auth",
          },
        },
        select: { id: true },
      })
    : await prisma.internshipApplication.create({
        data: {
          studentId: userId,
          programId: program.id,
          cohortId: cohort.id,
          onboardingAnswers: { source: "dev-auth" },
        },
        select: { id: true },
      });

  const passed = await prisma.assessmentAttempt.count({
    where: { applicationId: application.id, status: "PASSED" },
  });
  if (!passed)
    await prisma.assessmentAttempt.create({
      data: {
        applicationId: application.id,
        assessmentId: program.assessments[0]?.id ?? null,
        status: "PASSED",
        submittedAt: new Date(),
        outcomeEmail: email,
        scorePercent: 100,
      },
    });

  await prisma.internshipPayment.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      reference: `dev-auth-${application.id}`,
      amount: 0,
      status: "PAID",
      paidAt: new Date(),
    },
    update: { status: "PAID", paidAt: new Date() },
  });
}
