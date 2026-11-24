import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";
import { getAcceptanceFee } from "@/lib/internship-levels";
import { effectiveLearningMode } from "@/lib/learning-mode-rules";

export type InternshipAccessStatus = {
  hasApplication: boolean;
  acceptanceFeePaid: boolean;
  assessmentPassed: boolean;
  programName: string | null;
  acceptanceFeeAmount: number | null;
  currency: string | null;
  premiumTier: "NONE" | "TIER_100K" | "TIER_400K";
  /** Paid but hasn't chosen self-paced or cohort yet (/internship/choose). */
  needsLearningModeChoice: boolean;
};

export async function getInternshipAccessStatus(
  userId: string,
): Promise<InternshipAccessStatus> {
  const prisma = getPrisma();

  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    include: {
      program: { select: { name: true } },
      payment: { select: { status: true, currency: true } },
      attempts: { where: { status: "PASSED" }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    return {
      hasApplication: false,
      acceptanceFeePaid: false,
      assessmentPassed: false,
      programName: null,
      acceptanceFeeAmount: null,
      currency: null,
      premiumTier: "NONE",
      needsLearningModeChoice: false,
    };
  }

  const acceptanceFeePaid = application.payment?.status === "PAID";
  return {
    hasApplication: true,
    acceptanceFeePaid,
    programName: application.program.name,
    assessmentPassed: application.attempts.length > 0,
    // Only the paywall shows it, so it isn't looked up once the fee is paid
    // (this runs on every internship page's shell request).
    acceptanceFeeAmount: acceptanceFeePaid
      ? null
      : await getAcceptanceFee(application.programId, application.levelId),
    currency: application.payment?.currency ?? "NGN",
    premiumTier: application.premiumTier,
    needsLearningModeChoice:
      acceptanceFeePaid && application.status !== "REMOVED" && effectiveLearningMode(application) === null,
  };
}

/** Whether the intern has paid for Premium (either tier). */
export async function isPremiumIntern(userId: string) {
  const application = await getPrisma().internshipApplication.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    select: { premiumTier: true },
  });
  return Boolean(application && application.premiumTier !== "NONE");
}

export async function hasInternshipWorkspaceAccess(
  userId: string,
): Promise<boolean> {
  const application = await getPrisma().internshipApplication.findFirst({
    where: {
      studentId: userId,
      // An intern an admin removed has no workspace until restored.
      status: { not: "REMOVED" },
      payment: { is: { status: "PAID" } },
    },
    select: { id: true },
  });

  return Boolean(application);
}

/**
 * Where someone without the workspace belongs (removed, choosing an optional
 * assessment, or yet to apply), or null for an
 * intern with access. The dashboard's pages are files served as they are,
 * so this decides on their behalf: in the shell request (the browser then
 * redirects) and in the dashboard's few server-rendered pages.
 */
export async function internshipWorkspaceRedirect(userId: string): Promise<string | null> {
  if (await hasInternshipWorkspaceAccess(userId)) return null;
  const prisma = getPrisma();
  const removed = await prisma.internshipApplication.count({
    where: { studentId: userId, status: "REMOVED" },
  });
  if (removed) return "/internship/removed";
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    include: {
      // Only attempts at the application's current level: an applicant
      // who moved to a lower level hasn't sat that level's exam yet.
      attempts: {
        where: { status: { in: ["PASSED", "FAILED", "IN_PROGRESS"] } },
        select: { status: true, assessment: { select: { levelId: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const currentAttempt = application?.attempts.find(
    (attempt) => attempt.assessment?.levelId === application.levelId,
  );
  if (currentAttempt && currentAttempt.status !== "IN_PROGRESS")
    return "/internship/results";
  return application?.onboardingAnswers
    ? "/internship/onboarding/assessment-choice"
    : application
      ? "/internship/onboarding"
      : "/internship/onboarding";
}

/**
 * For the internship workspace's APIs: the signed-in intern's id, or the
 * response to send instead (not signed in, or no workspace access). The
 * same rule as the dashboard, so an API answers exactly the people who can
 * open the pages that use it.
 */
export async function requireInternshipWorkspace(): Promise<{ userId: string } | { response: Response }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!(await hasInternshipWorkspaceAccess(userId))) {
    return {
      response: Response.json({ error: "This is only for interns with access to the internship workspace." }, { status: 403 }),
    };
  }
  return { userId };
}
