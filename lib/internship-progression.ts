import { getPrisma } from "@/lib/prisma";
import { awardLevelUpAchievement } from "@/lib/achievements";
import { computeInternProgress } from "@/lib/internship-progress";
import { computeSelfPacedProgress } from "@/lib/self-paced-tasks";
import { cohortTimeline } from "@/lib/task-schedule";
import { getAcceptanceFee } from "@/lib/internship-levels";
import { reassignLeaderIfNeeded } from "@/lib/internship-groups";
import { notifyCertificateIssued } from "@/lib/internship-certificate-notify";
import {
  internshipCertificateNumber,
  internshipCertificatePrefix,
} from "@/lib/certificate-branding";

// Finishing a level and moving up. An intern earns a certificate for each
// level of a track; with it they can join the next level without an entrance
// exam, by paying that level's fee.
//
// Moving up creates the next level's application straight away, but it stays
// queued behind the current one (an earlier createdAt — the rest of the app
// treats the newest application as the intern's current one) so their
// workspace, tasks and certificate are untouched until the fee is paid.
// activatePromotion() then makes it current.

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/** A new number with the admin's prefix (Certificate rules / MCP). */
async function generateCertificateNumber(): Promise<string> {
  return internshipCertificateNumber(await internshipCertificatePrefix());
}

export const certificateApplicationInclude = {
  program: true,
  cohort: true,
  level: true,
} as const;

/** The intern's current application: their newest one. */
export function getCurrentApplication(userId: string) {
  return getPrisma().internshipApplication.findFirst({
    where: { studentId: userId },
    include: certificateApplicationInclude,
    orderBy: { createdAt: "desc" },
  });
}

type CurrentApplication = NonNullable<
  Awaited<ReturnType<typeof getCurrentApplication>>
>;

/**
 * The certificate earned at an application's level. Certificates from
 * before levels existed may have no application, and were all Entry.
 */
function findCertificate(application: CurrentApplication) {
  return getPrisma().internshipCertificate.findFirst({
    where: {
      userId: application.studentId,
      OR: [
        { applicationId: application.id },
        ...(application.level.rank === 1
          ? [{ applicationId: null, programId: application.programId }]
          : []),
      ],
    },
    orderBy: { issuedAt: "desc" },
  });
}

export type CertificateCheck =
  | {
      eligible: true;
      certificateId: string;
      /** True when this check issued the certificate. */
      issuedNow?: boolean;
    }
  | {
      eligible: false;
      reason: string;
      progressPercent?: number;
      passMark?: number;
      completedTasks?: number;
      totalTasks?: number;
      cohortEndLabel?: string;
    };

/**
 * Issues the certificate for the application's level once its cohort has
 * ended and the intern passed at least the cohort's pass mark of its tasks.
 * Once issued, a certificate stays available.
 */
export async function checkCertificate(
  application: CurrentApplication,
): Promise<CertificateCheck> {
  const existing = await findCertificate(application);
  if (existing) return { eligible: true, certificateId: existing.id };

  const { cohort } = application;

  // Self-paced interns have no cohort. Eligible once their accepted-task
  // percentage meets the platform's certificateMinimumCompletion pass mark.
  // Whether to auto-issue follows the automaticCertificateIssue setting.
  if (!cohort) {
    if (!application.selfPacedStartDate)
      return {
        eligible: false,
        reason: "You'll be able to earn a certificate once you're placed in a cohort.",
      };
    const [progress, platformSettings] = await Promise.all([
      computeSelfPacedProgress(application.id),
      getPrisma().platformSettings.findFirst({
        select: {
          certificateMinimumCompletion: true,
          automaticCertificateIssue: true,
          selfPacedCertificatePassMark: true,
        },
      }),
    ]);
    const completionMark = platformSettings?.certificateMinimumCompletion ?? 100;
    const scoreMark = platformSettings?.selfPacedCertificatePassMark ?? 70;
    const details = {
      progressPercent: progress.progressPercent,
      passMark: completionMark,
      completedTasks: progress.completedTasks,
      totalTasks: progress.totalTasks,
    };
    if (progress.totalTasks === 0)
      return {
        eligible: false,
        reason: "No tasks have been assigned yet.",
        ...details,
      };
    if (progress.progressPercent < completionMark)
      return {
        eligible: false,
        reason: `Pass at least ${completionMark}% of your tasks to earn your certificate — you've passed ${progress.progressPercent}% so far.`,
        ...details,
      };
    if (progress.scorePercent < scoreMark)
      return {
        eligible: false,
        reason: `Your task completion qualifies, but your score (${progress.scorePercent}%) must reach ${scoreMark}% to earn your certificate.`,
        ...details,
      };
    // Eligible. Issue automatically only when the setting allows it.
    // When auto-issue is off, an admin issues the cert manually; we signal
    // eligibility with a placeholder id — the cert row doesn't exist yet.
    if (!platformSettings?.automaticCertificateIssue)
      return { eligible: true, certificateId: "pending-admin-issue" };
    const certificate = await getPrisma().internshipCertificate.create({
      data: {
        userId: application.studentId,
        programId: application.programId,
        applicationId: application.id,
        title:
          application.level.rank > 1
            ? `${application.program.name} ${application.level.name} Level Completion Certificate`
            : `${application.program.name} Completion Certificate`,
        certificateNumber: await generateCertificateNumber(),
      },
    });
    await notifyCertificateIssued(certificate.id);
    return { eligible: true, certificateId: certificate.id, issuedNow: true };
  }

  const progress = await computeInternProgress(
    application.studentId,
    cohort.id,
  );
  const timeline = cohortTimeline(cohort.startDate, cohort.endDate);
  const passMark = cohort.certificatePassMark;
  const details = {
    progressPercent: progress.progressPercent,
    passMark,
    completedTasks: progress.completedTasks,
    totalTasks: progress.totalTasks,
    cohortEndLabel: formatDate(cohort.endDate),
  };

  if (!timeline.ended)
    return {
      eligible: false,
      reason: `Certificates are issued when your cohort ends on ${details.cohortEndLabel}. You need to pass at least ${passMark}% of your tasks — you've passed ${progress.progressPercent}% so far.`,
      ...details,
    };
  if (progress.totalTasks === 0 || progress.progressPercent < passMark)
    return {
      eligible: false,
      reason: `Your cohort has ended. The certificate required passing at least ${passMark}% of tasks, and you passed ${progress.progressPercent}%.`,
      ...details,
    };

  const certificate = await getPrisma().internshipCertificate.create({
    data: {
      userId: application.studentId,
      programId: application.programId,
      applicationId: application.id,
      title:
        application.level.rank > 1
          ? `${application.program.name} ${application.level.name} Level Completion Certificate`
          : `${application.program.name} Completion Certificate`,
      certificateNumber: await generateCertificateNumber(),
    },
  });
  await notifyCertificateIssued(certificate.id);
  return { eligible: true, certificateId: certificate.id, issuedNow: true };
}

export type Progression = {
  programName: string;
  levelName: string;
  /** Set once the current level's certificate is issued and still valid. */
  certificateId: string | null;
  /** The level above the current one, if there is one. */
  nextLevel: {
    id: string;
    name: string;
    /** Null while the fee for this track isn't set (not open yet). */
    acceptanceFee: number | null;
  } | null;
  /** The queued next-level application, once "Move to next level" is used. */
  queuedApplicationId: string | null;
};

export async function getProgression(
  userId: string,
): Promise<Progression | null> {
  const application = await getCurrentApplication(userId);
  if (!application) return null;
  const prisma = getPrisma();

  const check = await checkCertificate(application);
  const certificate = check.eligible
    ? await prisma.internshipCertificate.findUnique({
        where: { id: check.certificateId },
        select: { id: true, revokedAt: true },
      })
    : null;
  const validCertificateId =
    certificate && !certificate.revokedAt ? certificate.id : null;

  const next = await prisma.internshipLevel.findFirst({
    where: { rank: { gt: application.level.rank } },
    orderBy: { rank: "asc" },
    select: { id: true, name: true },
  });
  const queued = await prisma.internshipApplication.findUnique({
    where: { promotedFromId: application.id },
    select: { id: true },
  });

  return {
    programName: application.program.name,
    levelName: application.level.name,
    certificateId: validCertificateId,
    nextLevel: next
      ? {
          ...next,
          acceptanceFee: await getAcceptanceFee(application.programId, next.id),
        }
      : null,
    queuedApplicationId: queued?.id ?? null,
  };
}

/**
 * Queues the intern's next-level application (or returns the one already
 * queued). The certificate stands in for the entrance exam, recorded as a
 * passed attempt with no assessment so payment and access checks treat it
 * like any other pass.
 */
export async function startNextLevel(
  userId: string,
): Promise<{ applicationId: string } | { error: string; status: number }> {
  const application = await getCurrentApplication(userId);
  const progression = await getProgression(userId);
  if (!application || !progression)
    return { error: "No internship application found.", status: 404 };
  if (!progression.certificateId)
    return {
      error: "Earn this level's certificate before moving up.",
      status: 403,
    };
  const next = progression.nextLevel;
  if (!next)
    return { error: "You've completed the highest level.", status: 409 };
  if (next.acceptanceFee === null)
    return {
      error: `${next.name} level isn't open for ${progression.programName} yet. Please check back soon.`,
      status: 409,
    };
  if (progression.queuedApplicationId)
    return { applicationId: progression.queuedApplicationId };

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return { error: "Account not found.", status: 404 };

  // Queued: just older than the current application, so it isn't current yet.
  const queuedAt = new Date(application.createdAt.getTime() - 1000);
  const existing = await prisma.internshipApplication.findUnique({
    where: {
      studentId_programId_levelId: {
        studentId: userId,
        programId: application.programId,
        levelId: next.id,
      },
    },
    select: { id: true, payment: { select: { status: true } } },
  });
  if (existing?.payment?.status === "PAID")
    return { error: "You've already joined this level.", status: 409 };

  return prisma.$transaction(async (tx) => {
    // An earlier, unpaid application for this level (e.g. one started
    // through onboarding) is reused rather than duplicated.
    const queued = existing
      ? await tx.internshipApplication.update({
          where: { id: existing.id },
          data: { promotedFromId: application.id, createdAt: queuedAt },
          select: { id: true },
        })
      : await tx.internshipApplication.create({
          data: {
            studentId: userId,
            programId: application.programId,
            levelId: next.id,
            promotedFromId: application.id,
            onboardingAnswers: application.onboardingAnswers ?? {},
            createdAt: queuedAt,
          },
          select: { id: true },
        });

    const passed = await tx.assessmentAttempt.count({
      where: { applicationId: queued.id, status: "PASSED" },
    });
    if (!passed)
      await tx.assessmentAttempt.create({
        data: {
          applicationId: queued.id,
          assessmentId: null,
          status: "PASSED",
          outcomeEmail: user.email,
          submittedAt: new Date(),
        },
      });
    return { applicationId: queued.id };
  });
}

/**
 * Makes a paid, queued next-level application the intern's current one and
 * takes them out of their previous cohort's group so they can join a group
 * in their new cohort. Safe to call repeatedly and for any application;
 * call it after the payment is marked paid and the cohort assigned.
 */
export async function activatePromotion(applicationId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      studentId: true,
      programId: true,
      cohortId: true,
      createdAt: true,
      level: { select: { id: true, name: true } },
      program: { select: { name: true } },
      payment: { select: { status: true } },
      promotedFrom: { select: { createdAt: true } },
    },
  });
  if (
    !application?.promotedFrom ||
    application.payment?.status !== "PAID" ||
    application.createdAt > application.promotedFrom.createdAt
  )
    return;

  await prisma.$transaction(async (tx) => {
    await tx.internshipApplication.update({
      where: { id: application.id },
      data: { createdAt: new Date() },
    });

    // Group membership is one per track, so the old group must be left.
    const membership = await tx.internshipGroupMember.findUnique({
      where: {
        programId_userId: {
          programId: application.programId,
          userId: application.studentId,
        },
      },
      select: {
        id: true,
        groupId: true,
        group: { select: { cohortId: true } },
      },
    });
    if (membership && membership.group.cohortId !== application.cohortId) {
      await tx.internshipGroupMember.delete({ where: { id: membership.id } });
      await reassignLeaderIfNeeded(tx, membership.groupId);
    }
    await awardLevelUpAchievement(tx, {
      userId: application.studentId,
      programId: application.programId,
      levelId: application.level.id,
      levelName: application.level.name,
      trackName: application.program.name,
      applicationId: application.id,
    });
  });
}
