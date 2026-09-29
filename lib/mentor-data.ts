import { getPrisma } from "@/lib/prisma";

export type MentorIntern = {
  internId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  programId: string;
  programName: string;
  cohortName: string | null;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
};

/** Below this progress an intern is flagged as needing attention. */
export const NEEDS_ATTENTION_BELOW = 50;

/** The interns currently assigned to a mentor, one row per assignment. */
export async function getMentorInterns(
  mentorId: string,
): Promise<MentorIntern[]> {
  const prisma = getPrisma();

  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      internId: true,
      programId: true,
      program: { select: { name: true } },
      intern: {
        select: {
          name: true,
          email: true,
          avatarUrl: true,
          internshipApplications: {
            select: { programId: true, cohort: { select: { name: true } } },
          },
          internshipProgress: {
            select: {
              programId: true,
              progressPercent: true,
              completedTasks: true,
              totalTasks: true,
            },
          },
        },
      },
    },
  });

  return assignments.map(({ internId, programId, program, intern }) => {
    const application = intern.internshipApplications.find(
      (item) => item.programId === programId,
    );
    const progress = intern.internshipProgress.find(
      (item) => item.programId === programId,
    );
    return {
      internId,
      name: intern.name?.trim() || intern.email,
      email: intern.email,
      avatarUrl: intern.avatarUrl,
      programId,
      programName: program.name,
      cohortName: application?.cohort?.name ?? null,
      progressPercent: progress?.progressPercent ?? 0,
      completedTasks: progress?.completedTasks ?? 0,
      totalTasks: progress?.totalTasks ?? 0,
    };
  });
}

/**
 * A TaskSubmission filter matching only work by the given interns on tasks
 * from the programme each is assigned to this mentor for.
 */
export function submissionsForInterns(interns: MentorIntern[]) {
  if (interns.length === 0) return { id: { in: [] as string[] } };
  return {
    OR: interns.map((intern) => ({
      userId: intern.internId,
      task: { module: { programId: intern.programId } },
    })),
  };
}

/** True when the intern is actively assigned to this mentor. */
export async function isAssignedIntern(mentorId: string, internId: string) {
  const count = await getPrisma().mentorAssignment.count({
    where: { mentorId, internId, status: "ACTIVE" },
  });
  return count > 0;
}

/**
 * Recomputes an intern's programme progress from their accepted task
 * submissions. Called whenever a submission is reviewed.
 */
export async function recomputeInternProgress(
  userId: string,
  programId: string,
) {
  const prisma = getPrisma();
  const [totalTasks, completedTasks] = await Promise.all([
    prisma.internshipTask.count({ where: { module: { programId } } }),
    prisma.taskSubmission.count({
      where: { userId, status: "ACCEPTED", task: { module: { programId } } },
    }),
  ]);
  const progressPercent = totalTasks
    ? Math.min(100, Math.round((completedTasks / totalTasks) * 100))
    : 0;

  await prisma.internshipProgress.upsert({
    where: { userId_programId: { userId, programId } },
    create: { userId, programId, totalTasks, completedTasks, progressPercent },
    update: { totalTasks, completedTasks, progressPercent },
  });
}

/** Submission statuses in mentor-facing language. */
export const SUBMISSION_LABELS = {
  DRAFT: { label: "Draft", tone: "blue" },
  SUBMITTED: { label: "Pending review", tone: "amber" },
  UNDER_REVIEW: { label: "In review", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Needs changes", tone: "red" },
} as const;
