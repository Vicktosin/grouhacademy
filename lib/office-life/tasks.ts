import { LearnerAudience, NotificationType, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { awardTaskAchievements, awardTaskSubmittedAchievements } from "@/lib/achievements";
import { recomputeInternProgress } from "@/lib/internship-progress";
import { recordSubmissionEvent } from "@/lib/submission-history";
import { MAX_SUBMISSION_LENGTH } from "@/lib/task-submission";
import { formatWat } from "@/lib/task-schedule";
import type { InternshipOfficeLifeInfo } from "@/lib/internship-data";
import type { DayState } from "@/lib/office-life/server";

// Office Life tasks: an individual task linked to a workday (its "Work-Life
// week", InternshipTask.officeLifeDay = OfficeLifeDay.day, in the cohort's
// track and level). Finishing the workday is what earns the task, so the
// intern's submission is created for them and accepted straight away, like
// a Practice Lab task is graded when its exercise is submitted. It's about
// taking part: the Office Life score is in the text for the mentor, never
// the task's score, so it doesn't touch grades, pass marks or certificates.

/** Shown on the submission, and in its history, so everyone sees why it passed. */
export function officeLifeAcceptedFeedback(day: number) {
  return `Accepted automatically: you completed Office Life workday ${day}. This task is about taking part, so the Office Life score doesn't count toward its grade.`;
}

/** A workday decision nobody has changed yet: mentors may change it too (lib/submission-history). */
export function isOfficeLifeAutoDecision(submission: { reviewedById: string | null; task: { officeLifeDay: number | null } }) {
  return submission.reviewedById === null && submission.task.officeLifeDay !== null;
}

const clip = (text: string, max: number) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/**
 * The submission text a mentor reads: the workday, when it was finished,
 * the day's Office Life score, and each step with its score and short
 * feedback. Always within a submission's length limit.
 */
export function officeLifeSubmissionText(input: {
  day: number;
  title: string | null;
  completedAt: Date;
  score: number | null;
  state: Pick<DayState, "steps" | "workday">;
}) {
  const steps = input.state.workday?.steps ?? Object.keys(input.state.steps).map((id) => ({ id, kind: "step", title: id }));
  const lines = steps.map((step, index) => {
    const result = input.state.steps[step.id];
    const head = `${index + 1}. ${step.title}`;
    if (!result) return `${head}: not done`;
    if (step.kind === "inbox") return `${head}: read`;
    const feedback = result.feedback;
    if (!feedback) return `${head}: done`;
    const notes = [
      feedback.strengths[0] && `Did well: ${clip(feedback.strengths[0], 200)}`,
      feedback.improvements[0] && `To improve: ${clip(feedback.improvements[0], 200)}`,
    ].filter(Boolean);
    return [`${head}: ${feedback.score}/100`, ...notes.map((note) => `   ${note}`)].join("\n");
  });
  const header = [
    `Office Life workday ${input.day}${input.title ? `: ${input.title}` : ""}`,
    `Finished: ${formatWat(input.completedAt)} (WAT)`,
    `Office Life score for the day: ${input.score === null ? "not scored" : `${input.score}/100`} (for information only; it doesn't count toward this task)`,
    "",
    "Steps:",
  ].join("\n");
  const text = `${header}\n${lines.join("\n")}`;
  if (text.length <= MAX_SUBMISSION_LENGTH) return text;
  const note = "\n… (shortened to fit)";
  return `${text.slice(0, MAX_SUBMISSION_LENGTH - note.length)}${note}`;
}

type CompletedDay = { userId: string; programId: string; levelId: string; day: number };
type LinkedTask = { id: string; cohortId: string | null; /** Self-paced: the one intern whose task it is. */ ownerId?: string | null; kind: "INDIVIDUAL" | "GROUP"; officeLifeDay: number | null; programId: string; levelId: string };

/**
 * Which submissions to create: every individual task linked to a finished
 * workday, in a cohort the intern is in (same track and level as the
 * workday), that they don't already have a submission for.
 */
export function planOfficeLifeSubmissions({
  days,
  tasks,
  enrolments,
  existing,
}: {
  days: CompletedDay[];
  tasks: LinkedTask[];
  enrolments: Array<{ userId: string; cohortId: string }>;
  existing: Array<{ taskId: string; userId: string }>;
}) {
  const enrolled = new Set(enrolments.map((item) => `${item.userId}:${item.cohortId}`));
  const done = new Set(existing.map((item) => `${item.taskId}:${item.userId}`));
  const plan: Array<{ day: CompletedDay; task: LinkedTask }> = [];
  for (const day of days)
    for (const task of tasks) {
      if (task.kind !== "INDIVIDUAL" || task.officeLifeDay !== day.day) continue;
      if (task.programId !== day.programId || task.levelId !== day.levelId) continue;
      if (task.ownerId ? task.ownerId !== day.userId : !enrolled.has(`${day.userId}:${task.cohortId}`)) continue;
      const key = `${task.id}:${day.userId}`;
      if (done.has(key)) continue;
      done.add(key);
      plan.push({ day, task });
    }
  return plan;
}

const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Submits and accepts the Office Life tasks earned by finished workdays.
 * Called when a workday is finished, when the intern opens their tasks
 * (so a task linked after they finished still counts), and by the backfill.
 * Never touches a submission that already exists, so running it again (or
 * twice at once) creates nothing more and never undoes a mentor's decision.
 * Returns how many submissions were created (`dryRun`: would be created).
 */
export async function submitOfficeLifeTasks(
  filter: { userId?: string; programId?: string; levelId?: string; day?: number; taskId?: string } = {},
  { dryRun = false } = {},
) {
  const prisma = getPrisma();
  const rows = await prisma.officeLifeDay.findMany({
    where: {
      completedAt: { not: null },
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.programId ? { programId: filter.programId } : {}),
      ...(filter.levelId ? { levelId: filter.levelId } : {}),
      ...(filter.day ? { day: filter.day } : {}),
    },
    select: { userId: true, programId: true, levelId: true, day: true, state: true, score: true, completedAt: true },
  });
  if (!rows.length) return 0;

  const tasks = await prisma.internshipTask.findMany({
    where: {
      ...(filter.taskId ? { id: filter.taskId } : {}),
      kind: "INDIVIDUAL",
      officeLifeDay: { in: [...new Set(rows.map((row) => row.day))] },
      OR: [
        { cohort: { programId: { in: [...new Set(rows.map((row) => row.programId))] }, levelId: { in: [...new Set(rows.map((row) => row.levelId))] } } },
        { cohortId: null, application: { studentId: { in: [...new Set(rows.map((row) => row.userId))] }, status: { not: "REMOVED" } } },
      ],
    },
    select: { id: true, title: true, cohortId: true, kind: true, officeLifeDay: true, cohort: { select: { programId: true, levelId: true } }, application: { select: { studentId: true, programId: true, levelId: true } } },
  });
  if (!tasks.length) return 0;

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const taskIds = tasks.map((task) => task.id);
  const [enrolments, existing] = await Promise.all([
    prisma.internshipApplication.findMany({
      where: { studentId: { in: userIds }, cohortId: { in: [...new Set(tasks.map((task) => task.cohortId).filter((id): id is string => id !== null))] }, status: { not: "REMOVED" } },
      select: { studentId: true, cohortId: true },
    }),
    prisma.taskSubmission.findMany({
      where: { taskId: { in: taskIds }, userId: { in: userIds }, groupId: null },
      select: { taskId: true, userId: true },
    }),
  ]);

  const plan = planOfficeLifeSubmissions({
    days: rows,
    tasks: tasks.flatMap((task) => {
      const place = task.cohort ?? task.application;
      return place ? [{ ...task, programId: place.programId, levelId: place.levelId, ownerId: task.cohort ? null : task.application!.studentId }] : [];
    }),
    enrolments: enrolments.flatMap((item) => (item.cohortId ? [{ userId: item.studentId, cohortId: item.cohortId }] : [])),
    existing,
  });
  if (dryRun) return plan.length;

  const byKey = new Map(rows.map((row) => [`${row.userId}:${row.programId}:${row.levelId}:${row.day}`, row]));
  const titles = new Map(tasks.map((task) => [task.id, task.title]));
  const progress = new Set<string>();
  let created = 0;
  for (const { day, task } of plan) {
    const row = byKey.get(`${day.userId}:${day.programId}:${day.levelId}:${day.day}`)!;
    const state = (row.state && typeof row.state === "object" ? row.state : {}) as Partial<DayState>;
    const content = officeLifeSubmissionText({
      day: row.day,
      title: state.workday?.title ?? null,
      completedAt: row.completedAt!,
      score: row.score,
      state: { steps: state.steps ?? {}, workday: state.workday },
    });
    const feedback = officeLifeAcceptedFeedback(row.day);
    try {
      await prisma.$transaction(async (tx) => {
        // Unique per intern and task: a second run at the same moment fails here.
        const saved = await tx.taskSubmission.create({
          data: {
            taskId: task.id,
            userId: row.userId,
            content,
            status: "ACCEPTED",
            // Completion-based: no task score, so Office Life scores never count.
            score: null,
            feedback,
            submittedAt: row.completedAt!,
            reviewedAt: new Date(),
            // Accepted automatically, not by a person.
            reviewedById: null,
          },
          select: { id: true },
        });
        // History: the work (the intern's, done in Office Life), then the automatic decision.
        await recordSubmissionEvent(tx, { submissionId: saved.id, kind: "SUBMITTED", content, actorId: row.userId, actorRole: "INTERN" });
        await awardTaskSubmittedAchievements(tx, saved.id);
        await recordSubmissionEvent(tx, { submissionId: saved.id, kind: "AUTO_GRADED", status: "ACCEPTED", score: null, feedback, actorRole: "SYSTEM" });
        await awardTaskAchievements(tx, row.userId, saved.id);
        await tx.notification.create({
          data: {
            userId: row.userId,
            title: "Task submitted and accepted",
            message: `“${titles.get(task.id)}” was submitted and accepted because you completed Office Life workday ${row.day}.`,
            type: NotificationType.SUCCESS,
            audience: LearnerAudience.INTERNSHIP,
          },
        });
        // The achievement checks are many small queries.
      }, { maxWait: 10_000, timeout: 30_000 });
      created++;
      progress.add(`${row.userId}:${row.programId}`);
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  for (const key of progress) {
    const [userId, programId] = key.split(":");
    await recomputeInternProgress(userId, programId).catch((error) =>
      console.error("[office-life] Progress update failed.", error instanceof Error ? error.message : error),
    );
  }
  return created;
}

type OverviewDay = {
  day: number;
  title: string;
  opensAt: string | null;
  dueAt: string | null;
  stepsDone: number;
  stepsTotal: number;
  completedAt: string | null;
};

/** The linked workday's status, for the task card. */
export function officeLifeTaskInfo(day: number, workday: OverviewDay | undefined, submitted: boolean, now = new Date()): InternshipOfficeLifeInfo {
  const opensAt = workday?.opensAt ? new Date(workday.opensAt) : null;
  const dueAt = workday?.dueAt ? new Date(workday.dueAt) : null;
  const state = workday?.completedAt ? "COMPLETED" : workday?.stepsDone ? "IN_PROGRESS" : "NOT_STARTED";
  return {
    day,
    title: workday?.title ?? null,
    state,
    statusLabel:
      state === "COMPLETED"
        ? submitted
          ? "Completed and submitted"
          : "Completed"
        : state === "IN_PROGRESS"
          ? `In progress (${workday!.stepsDone} of ${workday!.stepsTotal} steps done)`
          : "Not started",
    stepsDone: workday?.stepsDone ?? 0,
    stepsTotal: workday?.stepsTotal ?? 0,
    // Never closes: a workday stays open while the intern is on the level.
    window: opensAt ? (now < opensAt ? "UPCOMING" : "OPEN") : null,
    opensLabel: opensAt ? formatWat(opensAt) : null,
    dueLabel: dueAt ? formatWat(dueAt) : null,
    completedLabel: workday?.completedAt ? formatWat(new Date(workday.completedAt)) : null,
  };
}
