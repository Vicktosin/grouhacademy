import { getPrisma } from "@/lib/prisma";
import { scheduleToDate, formatWat, taskWindowState } from "@/lib/task-schedule";
import { submissionBlockedReason } from "@/lib/task-submission";
import { durationLabel } from "@/lib/intern-tasks";
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

async function weekModuleId(programId: string, week: number): Promise<string> {
  const prisma = getPrisma();
  const title = `Week ${week}`;
  const existing = await prisma.internshipModule.findFirst({
    where: { programId, title },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.internshipModule.create({
    data: { programId, title, order: week },
    select: { id: true },
  });
  return created.id;
}

/** Sets selfPacedStartDate on an application to activate self-paced mode. */
export async function activateSelfPacedMode(applicationId: string): Promise<void> {
  await getPrisma().internshipApplication.update({
    where: { id: applicationId },
    data: { selfPacedStartDate: new Date() },
  });
}

/**
 * Idempotently creates InternshipTask rows from INDIVIDUAL non-archived
 * templates for this intern. Only creates tasks that don't exist yet.
 */
export async function materialiseSelfPacedTasks(
  applicationId: string,
  programId: string,
  levelId: string,
  selfPacedStartDate: Date,
): Promise<number> {
  const prisma = getPrisma();
  const [templates, existing] = await Promise.all([
    prisma.internshipTaskTemplate.findMany({
      where: { levelId, programId, kind: "INDIVIDUAL", archived: false },
      orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }],
    }),
    prisma.internshipTask.findMany({
      where: { applicationId },
      select: { templateId: true },
    }),
  ]);

  const existingTemplateIds = new Set(
    existing.map((t) => t.templateId).filter((id): id is string => id !== null),
  );
  const toCreate = templates.filter((t) => !existingTemplateIds.has(t.id));
  if (toCreate.length === 0) return 0;

  for (const template of toCreate) {
    const moduleId = await weekModuleId(programId, template.opensWeek);
    const opensAt = scheduleToDate(selfPacedStartDate, {
      week: template.opensWeek,
      day: template.opensDay,
      time: template.opensTime,
    });
    const dueDate = scheduleToDate(selfPacedStartDate, {
      week: template.dueWeek,
      day: template.dueDay,
      time: template.dueTime,
    });
    await prisma.internshipTask.create({
      data: {
        title: template.title,
        description: template.description,
        kind: "INDIVIDUAL",
        moduleId,
        cohortId: null,
        applicationId,
        templateId: template.id,
        opensWeek: template.opensWeek,
        opensDay: template.opensDay,
        opensTime: template.opensTime,
        dueWeek: template.dueWeek,
        dueDay: template.dueDay,
        dueTime: template.dueTime,
        opensAt,
        dueDate,
        maxScore: template.maxScore,
        labScenarioId: template.labScenarioId,
        labPassMark: template.labPassMark,
        officeLifeDay: template.officeLifeDay,
      },
    });
  }
  return toCreate.length;
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
    orderBy: [{ opensAt: "asc" }, { dueDate: "asc" }, { title: "asc" }],
  });

  const now = new Date();
  return tasks.map((task) => {
    const submission = task.submissions[0] ?? null;
    const window = taskWindowState(task.opensAt, task.dueDate, now);
    let label: { status: TaskStatusLabel; tone: TaskTone } | null =
      submission ? REVIEW_STATUS[submission.status] : null;
    if (!label)
      label =
        window === "UPCOMING"
          ? { status: "Not open yet", tone: "slate" }
          : window === "OPEN"
            ? { status: "Not submitted", tone: "slate" }
            : { status: "Missed", tone: "red" };

    const score = submission?.score ?? null;
    const blockedReason = submissionBlockedReason({
      task,
      existingStatus: submission?.status ?? undefined,
      group: null,
      userId,
      now,
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      kind: "INDIVIDUAL" as const,
      weekLabel: `Week ${task.opensWeek}`,
      weekNumber: task.opensWeek,
      window,
      opensLabel: formatWat(task.opensAt),
      dueDateLabel: formatWat(task.dueDate),
      timeLeftLabel:
        window === "UPCOMING"
          ? `Opens in ${durationLabel(task.opensAt.getTime() - now.getTime())}`
          : window === "OPEN"
            ? `${durationLabel(task.dueDate.getTime() - now.getTime())} left`
            : "Closed",
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
