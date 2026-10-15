import { getPrisma } from "@/lib/prisma";
import { recomputeCohortProgress } from "@/lib/internship-progress";
import {
  isValidSchedulePoint,
  scheduleToDate,
  type SchedulePoint,
} from "@/lib/task-schedule";
import {
  DEFAULT_LAB_PASS_MARK,
  parseLabPassMark,
} from "@/lib/lab-task-grading";
import { REAL_USER } from "@/lib/real-user";
import { submitOfficeLifeTasks } from "@/lib/office-life/tasks";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "@/lib/office-life/content";

// Creating and changing cohort tasks, for the admin tasks page
// (app/api/admin/internship/tasks) and admin scripts alike, so every task is
// validated the same way.

type Result = { error: string; status: number } | { taskId: string };

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 10_000;

function point(body: Record<string, unknown>, prefix: "opens" | "due") {
  return {
    week: Number(body[`${prefix}Week`]),
    day: Number(body[`${prefix}Day`]),
    time: String(body[`${prefix}Time`] ?? ""),
  } satisfies SchedulePoint;
}

/** Validates a task payload against its cohort; returns an error message or the data. */
export async function parseTask(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const cohortId = String(body.cohortId ?? "").trim();
  const description = String(body.description ?? "").trim();
  const kind = body.kind === "GROUP" ? "GROUP" : "INDIVIDUAL";
  const opens = point(body, "opens");
  const due = point(body, "due");

  if (!title || title.length > MAX_TITLE_LENGTH)
    return `Give the task a name (up to ${MAX_TITLE_LENGTH} characters).`;
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return "The task brief is too long.";
  if (!cohortId) return "Choose the cohort this task is for.";
  if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due))
    return "Set a valid week, day (1–7) and time for when the task opens and when it is due.";

  const cohort = await getPrisma().internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, programId: true, levelId: true, startDate: true, program: { select: { name: true } }, level: { select: { name: true } } },
  });
  if (!cohort) return "The selected cohort was not found.";

  // Optional Practice Lab exercise, from the cohort's own track.
  const labScenarioId =
    typeof body.labScenarioId === "string" && body.labScenarioId
      ? body.labScenarioId
      : null;
  const officeLifeDay = body.officeLifeDay === undefined || body.officeLifeDay === null || body.officeLifeDay === ""
    ? null
    : Number(body.officeLifeDay);

  if (officeLifeDay !== null) {
    const saved = await getPrisma().officeLifeContent.findUnique({
      where: { programId_levelId: { programId: cohort.programId, levelId: cohort.levelId } },
      select: { content: true },
    });
    const plan = parseOfficeLifeContent(saved?.content) ?? defaultOfficeLifeContent(cohort.program.name, cohort.level.name);
    if (!plan.workdays.some((workday) => workday.day === officeLifeDay))
      return "That Work-Life week is not configured for this cohort's track and level.";
  }
  if (officeLifeDay !== null && (!Number.isInteger(officeLifeDay) || officeLifeDay < 1 || officeLifeDay > 4))
    return "Choose a valid Work-Life week.";
  if (labScenarioId && officeLifeDay !== null)
    return "A task can target either Practice Lab or Work-Life, not both.";
  if (officeLifeDay !== null && kind === "GROUP")
    return "Work-Life sessions can only be linked to individual tasks.";
  if (labScenarioId && kind === "GROUP")
    return "Practice Lab exercises can only be linked to individual tasks.";
  if (labScenarioId) {
    const scenario = await getPrisma().labScenario.findUnique({
      where: { id: labScenarioId },
      select: { programId: true },
    });
    if (!scenario || scenario.programId !== cohort.programId)
      return "Choose a Practice Lab exercise from this cohort's track.";
  }
  const labPassMark = labScenarioId
    ? parseLabPassMark(body.labPassMark ?? DEFAULT_LAB_PASS_MARK)
    : DEFAULT_LAB_PASS_MARK;
  if (labPassMark === null)
    return "Set the pass mark as a whole number from 1 to 100.";

  const opensAt = scheduleToDate(cohort.startDate, opens);
  const dueDate = scheduleToDate(cohort.startDate, due);
  if (dueDate <= opensAt) return "The due time must be after the opening time.";

  return {
    cohort,
    data: {
      title,
      description: description || null,
      kind,
      cohortId,
      opensWeek: opens.week,
      opensDay: opens.day,
      opensTime: opens.time,
      dueWeek: due.week,
      dueDay: due.day,
      dueTime: due.time,
      opensAt,
      dueDate,
      labScenarioId,
      labPassMark,
      officeLifeDay,
    } as const,
  };
}

/** Tasks are filed under a "Week N" module of the cohort's track. */
async function weekModuleId(programId: string, week: number) {
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

/** Creates a task from the admin form's fields. */
export async function createTask(body: Record<string, unknown>): Promise<Result> {
  const parsed = await parseTask(body);
  if (typeof parsed === "string")
    return { error: parsed, status: 400 };

  const task = await getPrisma().internshipTask.create({
    data: {
      ...parsed.data,
      moduleId: await weekModuleId(
        parsed.cohort.programId,
        parsed.data.opensWeek,
      ),
    },
  });
  await recomputeCohortProgress(parsed.cohort.id);
  // Interns who already finished the linked workday have done this task.
  if (task.officeLifeDay !== null) await submitOfficeLifeTasks({ taskId: task.id });
  return { taskId: task.id };
}

/** Changes a task; its cohort and kind are fixed once interns have submitted. */
export async function updateTask(id: string, body: Record<string, unknown>): Promise<Result> {
  const prisma = getPrisma();
  const existing = await prisma.internshipTask.findUnique({
    where: { id },
    select: {
      cohortId: true,
      kind: true,
      _count: { select: { submissions: { where: { user: REAL_USER } } } },
    },
  });
  if (!existing)
    return { error: "Task not found.", status: 404 };

  const parsed = await parseTask(body);
  if (typeof parsed === "string")
    return { error: parsed, status: 400 };

  // Submissions are tied to the cohort's interns and to how the task is
  // submitted, so neither can change once work has come in.
  if (existing._count.submissions > 0) {
    if (parsed.data.cohortId !== existing.cohortId)
      return { error: "Interns have already submitted this task, so its cohort can't be changed.", status: 409 };
    if (parsed.data.kind !== existing.kind)
      return { error: "Interns have already submitted this task, so it can't be switched between individual and group.", status: 409 };
  }
  // Admins' preview interns' work doesn't hold a task in place: it goes.
  if (parsed.data.cohortId !== existing.cohortId || parsed.data.kind !== existing.kind) {
    await prisma.taskSubmission.deleteMany({ where: { taskId: id, user: { isPreview: true } } });
  }

  await prisma.internshipTask.update({
    where: { id },
    data: {
      ...parsed.data,
      moduleId: await weekModuleId(
        parsed.cohort.programId,
        parsed.data.opensWeek,
      ),
    },
  });
  if (parsed.data.cohortId !== existing.cohortId) {
    await recomputeCohortProgress(existing.cohortId);
    await recomputeCohortProgress(parsed.data.cohortId);
  }
  if (parsed.data.officeLifeDay !== null) await submitOfficeLifeTasks({ taskId: id });
  return { taskId: id };
}
