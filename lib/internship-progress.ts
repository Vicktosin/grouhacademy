import { getPrisma } from "@/lib/prisma";

export type InternProgress = {
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
};

/**
 * Tasks the intern has passed (an accepted submission they are credited
 * for): their own individual submission, or a group submission that lists
 * them as a participant.
 */
export function passedBy(userId: string) {
  return {
    submissions: {
      some: {
        status: "ACCEPTED" as const,
        OR: [
          { groupId: null, userId },
          { groupId: { not: null }, participants: { some: { userId } } },
        ],
      },
    },
  };
}

/** Passed tasks against every task created for the intern's cohort. */
export async function computeInternProgress(
  userId: string,
  cohortId: string | null,
): Promise<InternProgress> {
  if (!cohortId)
    return { completedTasks: 0, totalTasks: 0, progressPercent: 0 };
  const prisma = getPrisma();
  const [totalTasks, completedTasks] = await Promise.all([
    prisma.internshipTask.count({ where: { cohortId } }),
    prisma.internshipTask.count({ where: { cohortId, ...passedBy(userId) } }),
  ]);
  return {
    totalTasks,
    completedTasks,
    progressPercent: totalTasks
      ? Math.min(100, Math.round((completedTasks / totalTasks) * 100))
      : 0,
  };
}

/**
 * Stores an intern's progress for the mentor pages. Called when their work
 * is reviewed and when their cohort's task list changes.
 */
export async function recomputeInternProgress(
  userId: string,
  programId: string,
) {
  const prisma = getPrisma();
  // The intern's current (most recent) level in this track.
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId, programId },
    orderBy: { createdAt: "desc" },
    select: { id: true, cohortId: true, selfPacedStartDate: true },
  });

  // Self-paced interns: count their materialised tasks instead of cohort tasks.
  if (application?.selfPacedStartDate && !application.cohortId) {
    const { computeSelfPacedProgress } = await import("@/lib/self-paced-tasks");
    const progress = await computeSelfPacedProgress(application.id);
    await prisma.internshipProgress.upsert({
      where: { userId_programId: { userId, programId } },
      create: { userId, programId, ...progress },
      update: progress,
    });
    return;
  }

  const progress = await computeInternProgress(
    userId,
    application?.cohortId ?? null,
  );
  await prisma.internshipProgress.upsert({
    where: { userId_programId: { userId, programId } },
    create: { userId, programId, ...progress },
    update: progress,
  });
}

/** Recomputes stored progress for every intern in a cohort. */
export async function recomputeCohortProgress(cohortId: string) {
  const applications = await getPrisma().internshipApplication.findMany({
    where: { cohortId },
    select: { studentId: true, programId: true },
  });
  for (const { studentId, programId } of applications)
    await recomputeInternProgress(studentId, programId);
}
