import { getPrisma } from "@/lib/prisma";
import { submissionBlockedReason } from "@/lib/task-submission";
import { compareWeekOrder } from "@/lib/internship-task-order";
import { generateSelfPacedTasks, pacedLockedReason, pacedOpenWeek } from "@/lib/task-generation";
import { SubmissionStatus } from "@/generated/prisma/client";
import type { InternshipTaskItem, TaskStatusLabel, TaskTone } from "@/lib/internship-data";
import type { InternTaskContext } from "@/lib/intern-tasks";

const REVIEW_STATUS: Record<SubmissionStatus, { status: TaskStatusLabel; tone: TaskTone } | null> = {
  DRAFT: null,
  SUBMITTED: { status: "Submitted", tone: "green" },
  UNDER_REVIEW: { status: "Under review", tone: "green" },
  ACCEPTED: { status: "Passed", tone: "green" },
  REJECTED: { status: "Changes requested", tone: "red" },
};

/** Sets selfPacedStartDate on an application to activate self-paced mode. */
export async function activateSelfPacedMode(applicationId: string): Promise<void> {
  await getPrisma().internshipApplication.update({
    where: { id: applicationId },
    data: { selfPacedStartDate: new Date() },
  });
}

/** Makes this intern's tasks from the Task Library (lib/task-generation). */
export async function materialiseSelfPacedTasks(
  applicationId: string,
  programId: string,
  levelId: string,
  selfPacedStartDate: Date,
): Promise<number> {
  return generateSelfPacedTasks({ id: applicationId, programId, levelId, selfPacedStartDate });
}

/**
 * Lazily materialises and returns self-paced task items for an intern.
 * No group tasks — self-paced interns work individually only.
 */
export async function getSelfPacedTasks(
  userId: string,
  context: InternTaskContext & { selfPacedStartDate: Date },
  // false: only the tasks already created (an intern who has since joined a
  // cohort keeps their earlier work but gets no new self-paced tasks).
  { materialise = true }: { materialise?: boolean } = {},
): Promise<InternshipTaskItem[]> {
  const { id: applicationId, programId, levelId, selfPacedStartDate } = context;
  if (materialise) await materialiseSelfPacedTasks(applicationId, programId, levelId, selfPacedStartDate);

  const tasks = await getPrisma().internshipTask.findMany({
    where: { applicationId },
    include: {
      submissions: {
        where: { userId, groupId: null },
        select: {
          id: true,
          status: true,
          score: true,
          submittedAt: true,
          content: true,
          feedback: true,
        },
      },
    },
    orderBy: [{ opensWeek: "asc" }, { opensAt: "asc" }, { dueDate: "asc" }, { title: "asc" }],
  });

  const openWeek = pacedOpenWeek(tasks);
  return [...tasks].sort(compareWeekOrder).map((task) => {
    const submission = task.submissions[0] ?? null;
    // Weeks open by finishing the one before; nothing closes.
    const lockedReason = pacedLockedReason(task.opensWeek, openWeek);
    const window = lockedReason ? ("UPCOMING" as const) : ("OPEN" as const);
    let label: { status: TaskStatusLabel; tone: TaskTone } | null =
      submission ? REVIEW_STATUS[submission.status] : null;
    if (!label)
      label =
        window === "UPCOMING"
          ? { status: "Not open yet", tone: "slate" }
          : { status: "Not submitted", tone: "slate" };

    const score = submission?.score ?? null;
    const blockedReason = submissionBlockedReason({
      task: { ...task, lockedReason },
      existingStatus: submission?.status ?? undefined,
      group: null,
      userId,
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      kind: "INDIVIDUAL" as const,
      weekLabel: `Week ${task.opensWeek}`,
      weekNumber: task.opensWeek,
      window,
      opensLabel: lockedReason ? `When you finish Week ${task.opensWeek - 1}` : "Open now",
      dueDateLabel: "No deadline",
      timeLeftLabel: lockedReason ? "Locked" : "Go at your own speed",
      status: label.status,
      tone: label.tone,
      scoreLabel: score != null ? `${score}/${task.maxScore} marks` : `${task.maxScore} marks`,
      score,
      maxScore: task.maxScore,
      submittedAt: submission?.submittedAt?.toISOString() ?? null,
      submission: submission
        ? { content: submission.content, feedback: submission.feedback }
        : null,
      canSubmit: blockedReason === null,
      blockedReason,
      group: null,
      labScenarioId: task.labScenarioId,
      labPassMark: task.labPassMark,
      officeLifeDay: task.officeLifeDay,
      officeLife: null,
    };
  });
}

/**
 * Whether the intern is learning self-paced right now: a self-paced start
 * and no cohort (someone who switched to a cohort is a cohort intern).
 */
export function isSelfPacedNow(context: { selfPacedStartDate: Date | null; cohortId: string | null }) {
  return Boolean(context.selfPacedStartDate) && !context.cohortId;
}

/** Earlier self-paced work of an intern who joined a cohort: shown, read-only. */
export async function earlierSelfPacedWork(
  userId: string,
  context: InternTaskContext & { selfPacedStartDate: Date },
): Promise<InternshipTaskItem[]> {
  const items = await getSelfPacedTasks(userId, context, { materialise: false });
  return items
    .filter((item) => item.submittedAt)
    .map((item) => ({
      ...item,
      weekLabel: "Earlier self-paced work",
      canSubmit: false,
      blockedReason: "You've joined a cohort. This is work you did at your own pace.",
    }));
}

/**
 * Progress for a self-paced intern: completion % and score %.
 * scorePercent = earned score on ACCEPTED submissions / total possible score.
 */
export async function computeSelfPacedProgress(applicationId: string) {
  const prisma = getPrisma();
  const tasks = await prisma.internshipTask.findMany({
    where: { applicationId },
    select: {
      maxScore: true,
      submissions: {
        where: { status: "ACCEPTED", groupId: null },
        select: { score: true },
        take: 1,
      },
    },
  });
  const totalTasks = tasks.length;
  const accepted = tasks.filter((t) => t.submissions.length > 0);
  const completedTasks = accepted.length;
  const totalScore = tasks.reduce((s, t) => s + t.maxScore, 0);
  const earnedScore = accepted.reduce(
    (s, t) => s + (t.submissions[0]?.score ?? 0),
    0,
  );
  return {
    totalTasks,
    completedTasks,
    progressPercent: totalTasks
      ? Math.min(100, Math.round((completedTasks / totalTasks) * 100))
      : 0,
    scorePercent: totalScore
      ? Math.min(100, Math.round((earnedScore / totalScore) * 100))
      : 0,
  };
}
