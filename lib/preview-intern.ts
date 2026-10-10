import { cookies, headers } from "next/headers";
import { RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { PATH_HEADER } from "@/lib/request-path";

// "Experience as intern": each admin has one hidden preview intern, a real
// intern record (admitted: a passed assessment and a ₦0 fee) that the admin
// places in any track, level and cohort. While the preview cookie is set,
// the internship's pages and APIs treat the admin as that intern
// (lib/route-guards), so they see and use the internship exactly as an
// intern there does, submissions included. Admin pages stay the admin's.
//
// The preview intern must never show up anywhere else: every list, count,
// report, email and notification about interns filters it out with
// REAL_USER (isPreview: false).

export { REAL_USER } from "@/lib/real-user";

/** Set while an admin is experiencing the internship as their preview intern. */
export const PREVIEW_COOKIE = "grouh-intern-preview";

/** The intern side: where an admin in preview is their preview intern. */
export function isPreviewScopedPath(path: string) {
  return (
    path === "/internship" ||
    path.startsWith("/internship/") ||
    path.startsWith("/api/internship/") ||
    // Shared learner APIs the internship's pages use (bell, header, settings).
    path.startsWith("/api/student/") ||
    path === "/api/announcements"
  );
}

/**
 * The admin's preview intern, when this request should be served as them:
 * the preview cookie is set and the request is for the intern side.
 * Only ever called for a signed-in admin (route-guards).
 */
export async function previewInternForRequest(adminId: string): Promise<string | null> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  if (cookieStore.get(PREVIEW_COOKIE)?.value !== "1") return null;
  const path = headerStore.get(PATH_HEADER);
  if (!path || !isPreviewScopedPath(path)) return null;
  const preview = await getPrisma().user.findUnique({
    where: { previewOwnerId: adminId },
    select: { id: true },
  });
  return preview?.id ?? null;
}

export type PreviewPlacement = {
  programId: string;
  levelId: string;
  cohortId: string | null;
};

/** The admin's preview intern (created on first use). */
async function ensurePreviewIntern(adminId: string) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { previewOwnerId: adminId },
    select: { id: true, email: true },
  });
  if (existing) return existing;
  const role = await prisma.role.findUnique({ where: { name: RoleName.INTERN } });
  if (!role) throw new Error("The INTERN role is missing.");
  return prisma.user.create({
    data: {
      // Not a real address (.invalid never resolves): nothing is ever sent.
      email: `preview-${adminId}@preview.grouh.invalid`,
      name: "Preview Intern",
      status: "ACTIVE",
      isPreview: true,
      previewOwnerId: adminId,
      roles: { create: { roleId: role.id } },
    },
    select: { id: true, email: true },
  });
}

/** Removes applications (and what hangs off them) the preview no longer uses. */
async function deleteApplications(ids: string[]) {
  if (!ids.length) return;
  const prisma = getPrisma();
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { applicationId: { in: ids } },
    select: { id: true },
  });
  const attemptIds = attempts.map((attempt) => attempt.id);
  await prisma.$transaction([
    prisma.assessmentAnswer.deleteMany({ where: { attemptId: { in: attemptIds } } }),
    prisma.assessmentUpload.deleteMany({ where: { attemptId: { in: attemptIds } } }),
    prisma.assessmentAttempt.deleteMany({ where: { id: { in: attemptIds } } }),
    prisma.internshipPayment.deleteMany({ where: { applicationId: { in: ids } } }),
    prisma.internshipApplication.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

/**
 * Places the admin's preview intern in a track, level and cohort, admitted
 * (passed, ₦0 fee paid) and onboarded, with no other applications: what it
 * sees is exactly what an intern there sees.
 */
export async function placePreviewIntern(adminId: string, placement: PreviewPlacement) {
  const prisma = getPrisma();
  const intern = await ensurePreviewIntern(adminId);
  const applications = await prisma.internshipApplication.findMany({
    where: { studentId: intern.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, programId: true, levelId: true },
  });
  const keep =
    applications.find((app) => app.programId === placement.programId && app.levelId === placement.levelId) ??
    applications[0];
  await deleteApplications(applications.filter((app) => app.id !== keep?.id).map((app) => app.id));

  const data = {
    programId: placement.programId,
    levelId: placement.levelId,
    cohortId: placement.cohortId,
    status: "ACTIVE" as const,
    premiumTier: "NONE" as const,
    premiumActivatedAt: null,
    promotedFromId: null,
    onboardingAnswers: { source: "admin-preview" },
  };
  const application = keep
    ? await prisma.internshipApplication.update({ where: { id: keep.id }, data, select: { id: true } })
    : await prisma.internshipApplication.create({ data: { ...data, studentId: intern.id }, select: { id: true } });

  const assessment = await prisma.internshipAssessment.findFirst({
    where: { programId: placement.programId, levelId: placement.levelId },
    select: { id: true },
  });
  const passed = await prisma.assessmentAttempt.findFirst({
    where: { applicationId: application.id, status: "PASSED" },
    select: { id: true },
  });
  if (passed) {
    await prisma.assessmentAttempt.update({
      where: { id: passed.id },
      data: { assessmentId: assessment?.id ?? null },
    });
  } else {
    await prisma.assessmentAttempt.create({
      data: {
        applicationId: application.id,
        assessmentId: assessment?.id ?? null,
        status: "PASSED",
        submittedAt: new Date(),
        outcomeEmail: intern.email,
        scorePercent: 100,
      },
    });
  }
  await prisma.internshipPayment.upsert({
    where: { applicationId: application.id },
    create: {
      applicationId: application.id,
      reference: `admin-preview-${application.id}`,
      amount: 0,
      status: "PAID",
      paidAt: new Date(),
    },
    update: { status: "PAID", paidAt: new Date() },
  });
  return intern.id;
}

/**
 * Clears everything the preview intern did (submissions, lab work,
 * progress, notifications, interviews, certificates), keeping its place.
 */
export async function resetPreviewIntern(adminId: string) {
  const prisma = getPrisma();
  const intern = await prisma.user.findUnique({
    where: { previewOwnerId: adminId },
    select: { id: true },
  });
  if (!intern) return;
  const userId = intern.id;
  await prisma.$transaction([
    prisma.taskSubmission.deleteMany({ where: { userId } }),
    prisma.taskSubmissionParticipant.deleteMany({ where: { userId } }),
    prisma.labAttempt.deleteMany({ where: { userId } }),
    prisma.internshipProgress.deleteMany({ where: { userId } }),
    prisma.internResourceLessonProgress.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.interviewSession.deleteMany({ where: { userId } }),
    prisma.internshipCertificate.deleteMany({ where: { userId } }),
  ]);
  const current = await getPreviewPlacement(adminId);
  if (current) await placePreviewIntern(adminId, current);
}

/** Where the admin's preview intern is placed, if it exists. */
export async function getPreviewPlacement(adminId: string): Promise<PreviewPlacement | null> {
  const application = await getPrisma().internshipApplication.findFirst({
    where: { student: { previewOwnerId: adminId } },
    orderBy: { createdAt: "desc" },
    select: { programId: true, levelId: true, cohortId: true },
  });
  return application;
}

/** What the preview banner shows: where the preview intern is placed. */
export async function describePreviewIntern(userId: string) {
  const application = await getPrisma().internshipApplication.findFirst({
    where: { studentId: userId, student: { isPreview: true } },
    orderBy: { createdAt: "desc" },
    select: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      cohort: { select: { name: true } },
    },
  });
  return application
    ? {
        track: application.program.name,
        level: application.level.name,
        cohort: application.cohort?.name ?? null,
      }
    : null;
}
