import { getPrisma } from "@/lib/prisma";
import { computeInternProgress } from "@/lib/internship-progress";

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
            select: {
              programId: true,
              cohortId: true,
              cohort: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return Promise.all(
    assignments.map(async ({ internId, programId, program, intern }) => {
      const application = intern.internshipApplications.find(
        (item) => item.programId === programId,
      );
      // Live, so it always reflects the cohort's current task list.
      const progress = await computeInternProgress(
        internId,
        application?.cohortId ?? null,
      );
      return {
        internId,
        name: intern.name?.trim() || intern.email,
        email: intern.email,
        avatarUrl: intern.avatarUrl,
        programId,
        programName: program.name,
        cohortName: application?.cohort?.name ?? null,
        progressPercent: progress.progressPercent,
        completedTasks: progress.completedTasks,
        totalTasks: progress.totalTasks,
      };
    }),
  );
}

/**
 * A TaskSubmission filter matching only work by the given interns on tasks
 * from the programme each is assigned to this mentor for.
 */
export function submissionsForInterns(interns: MentorIntern[]) {
  if (interns.length === 0) return { id: { in: [] as string[] } };
  // A group submission is listed when any of the mentor's interns submitted
  // it or took part in it.
  return {
    OR: interns.map((intern) => ({
      task: { module: { programId: intern.programId } },
      OR: [
        { userId: intern.internId },
        { participants: { some: { userId: intern.internId } } },
      ],
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

/** Submission statuses in mentor-facing language. */
export const SUBMISSION_LABELS = {
  DRAFT: { label: "Draft", tone: "blue" },
  SUBMITTED: { label: "Pending review", tone: "amber" },
  UNDER_REVIEW: { label: "In review", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Needs changes", tone: "red" },
} as const;
