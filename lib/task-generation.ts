import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { scheduleOffset } from "@/lib/learning-mode-rules";
import { getPrisma } from "@/lib/prisma";
import { scheduleToDate } from "@/lib/task-schedule";

// Interns' tasks are made from the Task Library (InternshipTaskTemplate):
// one set per cohort, on the cohort's calendar; one set per self-paced
// intern, with each week unlocked by finishing the one before. A week that
// already has tasks is never added to, so nothing is duplicated and a later
// change to the library only affects tasks that haven't been made yet.

const DAY_MS = 24 * 60 * 60 * 1000;
const WAT_MS = 60 * 60 * 1000;

/**
 * When a cohort's week opens and is due (WAT): Monday 09:00 to Sunday 23:59.
 * Everyone starts on the cohort's start date, so week 1 opens then, even
 * mid-week, and runs to the end of the first full week.
 */
export function cohortWeek(cohortStart: Date, week: number) {
  const weekday = new Date(cohortStart.getTime() + WAT_MS).getUTCDay(); // 0 = Sunday
  const toMonday = (8 - weekday) % 7;
  const monday = new Date(cohortStart.getTime() + (toMonday + (week - 1) * 7) * DAY_MS);
  return {
    opensAt: scheduleToDate(week === 1 ? cohortStart : monday, { week: 1, day: 1, time: "09:00" }),
    dueAt: scheduleToDate(monday, { week: 1, day: 7, time: "23:59" }),
  };
}

// ── Self-paced weeks ────────────────────────────────────────────────────────

type PacedTask = {
  opensWeek: number;
  labScenarioId: string | null;
  officeLifeDay: number | null;
  submissions: { status: string }[];
};

/**
 * Whether a self-paced task counts towards finishing its week. Written work
 * counts once submitted, so nobody waits for a marker. Practice Lab and
 * Office Life work must be passed (a lab a mentor is double-checking counts).
 */
export function pacedTaskDone(task: PacedTask) {
  const status = task.submissions[0]?.status;
  if (!status || status === "DRAFT") return false;
  if (task.labScenarioId || task.officeLifeDay !== null) return status === "ACCEPTED" || status === "UNDER_REVIEW";
  return true;
}

/** The last open week: the first with work left (all weeks, once all are done). */
export function pacedOpenWeek(tasks: PacedTask[]) {
  const unfinished = tasks.filter((task) => !pacedTaskDone(task)).map((task) => task.opensWeek);
  return unfinished.length ? Math.min(...unfinished) : Infinity;
}

/** Why a self-paced task is locked, or null when it's open. */
export function pacedLockedReason(week: number, openWeek: number) {
  return week <= openWeek ? null : `Opens when you finish Week ${week - 1}.`;
}

/** The open week of one self-paced application. */
export async function openWeekFor(applicationId: string, userId: string, db: PrismaClient = getPrisma()) {
  const tasks = await db.internshipTask.findMany({
    where: { applicationId },
    select: {
      opensWeek: true,
      labScenarioId: true,
      officeLifeDay: true,
      submissions: { where: { userId, groupId: null }, select: { status: true }, take: 1 },
    },
  });
  return pacedOpenWeek(tasks);
}

// ── Making tasks ────────────────────────────────────────────────────────────

/** Individual tasks in the library for a track and level, by week. */
function libraryTasks(programId: string, levelId: string, db: PrismaClient) {
  return db.internshipTaskTemplate.findMany({
    where: { programId, levelId, kind: "INDIVIDUAL", archived: false },
    orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }, { title: "asc" }],
  });
}

async function weekModuleIds(programId: string, weeks: number[], db: PrismaClient) {
  const ids = new Map<number, string>();
  for (const week of new Set(weeks)) {
    const title = `Week ${week}`;
    const found =
      (await db.internshipModule.findFirst({ where: { programId, title }, select: { id: true } })) ??
      (await db.internshipModule.create({ data: { programId, title, order: week }, select: { id: true } }));
    ids.set(week, found.id);
  }
  return ids;
}

type Template = Awaited<ReturnType<typeof libraryTasks>>[number];

function fromTemplate(template: Template) {
  return {
    title: template.title,
    description: template.description,
    kind: template.kind,
    templateId: template.id,
    maxScore: template.maxScore,
    labScenarioId: template.labScenarioId,
    labPassMark: template.labPassMark,
    officeLifeDay: template.officeLifeDay,
  };
}

export type GenerateResult =
  | { ok: true; cohort: string; created: number; weeks: number[]; skippedWeeks: number[]; removed: number }
  | { ok: false; error: string };

/**
 * Makes a cohort's tasks from the library, for the weeks it has none.
 * `replaceUnused` first removes the tasks a cohort already has, but only
 * when nobody is in it and nothing has been submitted.
 */
export async function generateCohortTasks(
  cohortId: string,
  { replaceUnused = false, dryRun = false }: { replaceUnused?: boolean; dryRun?: boolean } = {},
  db: PrismaClient = getPrisma(),
): Promise<GenerateResult> {
  const cohort = await db.internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, programId: true, levelId: true, startDate: true, endDate: true },
  });
  if (!cohort) return { ok: false, error: "Cohort not found." };
  const templates = await libraryTasks(cohort.programId, cohort.levelId, db);
  if (!templates.length) return { ok: false, error: `The Task Library has no tasks for ${cohort.name}'s track and level.` };

  let existing = await db.internshipTask.findMany({ where: { cohortId }, select: { opensWeek: true } });
  let removed = 0;
  if (replaceUnused && existing.length) {
    const [interns, submissions] = await Promise.all([
      db.internshipApplication.count({ where: { cohortId, status: { not: "REMOVED" } } }),
      db.taskSubmission.count({ where: { task: { cohortId } } }),
    ]);
    if (interns || submissions)
      return { ok: false, error: `${cohort.name} has ${interns} intern(s) and ${submissions} submission(s), so its tasks were left alone.` };
    removed = existing.length;
    if (!dryRun)
      // Checked again as it deletes: work submitted a moment ago is safe.
      removed = (await db.internshipTask.deleteMany({ where: { cohortId, submissions: { none: {} } } })).count;
    existing = [];
  }

  const taken = new Set(existing.map((task) => task.opensWeek));
  const missing = templates.filter((template) => !taken.has(template.opensWeek));
  const weeks = [...new Set(missing.map((template) => template.opensWeek))];
  const result = { ok: true as const, cohort: cohort.name, weeks, skippedWeeks: [...taken].sort((a, b) => a - b), removed };
  if (!missing.length || dryRun) return { ...result, created: missing.length };

  const modules = await weekModuleIds(cohort.programId, weeks, db);
  const rows = missing.map((template): Prisma.InternshipTaskCreateManyInput => {
    const { opensAt, dueAt } = cohortWeek(cohort.startDate, template.opensWeek);
    // Never due after the cohort ends.
    const dueDate = dueAt > cohort.endDate && cohort.endDate > opensAt ? cohort.endDate : dueAt;
    const opens = scheduleOffset(cohort.startDate, opensAt);
    const due = scheduleOffset(cohort.startDate, dueDate);
    return {
      ...fromTemplate(template),
      moduleId: modules.get(template.opensWeek)!,
      cohortId,
      opensAt,
      dueDate,
      opensWeek: template.opensWeek,
      opensDay: opens.day,
      opensTime: opens.time,
      dueWeek: due.week,
      dueDay: due.day,
      dueTime: due.time,
    };
  });
  // One statement; the unique index ignores a second run at the same moment.
  const { count } = await db.internshipTask.createMany({ data: rows, skipDuplicates: true });
  return { ...result, created: count };
}

/** For a cohort nobody has made tasks for yet (on an intern's first visit). */
export async function ensureCohortTasks(cohortId: string, db: PrismaClient = getPrisma()) {
  if ((await db.internshipTask.count({ where: { cohortId } })) > 0) return;
  await generateCohortTasks(cohortId, {}, db);
}

/**
 * Makes a self-paced intern's tasks from the library, for the weeks they
 * have none. Weeks unlock by finishing the one before (pacedOpenWeek), so
 * the stored dates only bound the year: they never open or close a task.
 */
export async function generateSelfPacedTasks(
  application: { id: string; programId: string; levelId: string; selfPacedStartDate: Date },
  db: PrismaClient = getPrisma(),
): Promise<number> {
  const [templates, existing] = await Promise.all([
    libraryTasks(application.programId, application.levelId, db),
    db.internshipTask.findMany({ where: { applicationId: application.id }, select: { opensWeek: true } }),
  ]);
  const taken = new Set(existing.map((task) => task.opensWeek));
  const missing = templates.filter((template) => !taken.has(template.opensWeek));
  if (!missing.length) return 0;

  const modules = await weekModuleIds(application.programId, missing.map((template) => template.opensWeek), db);
  const start = application.selfPacedStartDate;
  const { count } = await db.internshipTask.createMany({
    skipDuplicates: true,
    data: missing.map((template) => ({
      ...fromTemplate(template),
      moduleId: modules.get(template.opensWeek)!,
      cohortId: null,
      applicationId: application.id,
      opensWeek: template.opensWeek,
      opensDay: template.opensDay,
      opensTime: template.opensTime,
      dueWeek: template.dueWeek,
      dueDay: template.dueDay,
      dueTime: template.dueTime,
      opensAt: start,
      dueDate: new Date(start.getTime() + 365 * DAY_MS),
    })),
  });
  return count;
}
