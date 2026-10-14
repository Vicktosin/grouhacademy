import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { gradeStep, type Feedback, type Submission } from "@/lib/office-life/grade";
import { castFromOfficeLifeContent, defaultOfficeLifeContent, parseOfficeLifeContent, personalizeOfficeLifeContent, type OfficeLifeContent } from "@/lib/office-life/content";
import { scheduleToDate } from "@/lib/task-schedule";
import { awardOfficeLifeAchievement, awardOfficeLifeClockIn, awardOfficeLifeStep } from "@/lib/achievements";
import {
  castFor,
  workdaysFor,
  WORKDAYS,
  type Cast,
  type PersonId,
  type Step,
  type Workday,
} from "@/lib/office-life/story";

// Office Life on the server: who the intern is (track, cohort, first name),
// which workdays are open, and doing each step in order. One row per
// workday holds everything (OfficeLifeDay.state), as short text.

type StepResult = { at: string; submission?: Submission; feedback?: Feedback };
export type DayState = { clockedInAt?: string; steps: Record<string, StepResult>; workday?: Workday; cast?: Cast };

const LIMITS = { subject: 200, body: 4000, turn: 2000, field: 2000, summary: 3000, link: 500 };
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** The intern's track, cohort start and first name, from their newest application. */
async function internContext(userId: string) {
  const prisma = getPrisma();
  const [application, user] = await Promise.all([
    prisma.internshipApplication.findFirst({
      where: {
        studentId: userId,
        status: { not: "REMOVED" },
        payment: { is: { status: "PAID" } },
        attempts: { some: { status: "PASSED" } },
      },
      orderBy: [{ level: { rank: "desc" } }, { createdAt: "desc" }],
      select: { programId: true, levelId: true, level: { select: { name: true, rank: true } }, program: { select: { name: true } }, cohort: { select: { name: true, startDate: true, endDate: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: { select: { firstName: true } } },
    }),
  ]);
  if (!application) return null;
  const you = user?.profile?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || "there";
  return {
    userId,
    programId: application.programId,
    levelId: application.levelId,
    level: application.level,
    track: application.program.name,
    cohort: application.cohort,
    you,
  };
}

type Context = NonNullable<Awaited<ReturnType<typeof internContext>>>;

function windowFor(context: Context, workday: Workday) {
  if (!context.cohort) return null;
  return {
    opensAt: scheduleToDate(context.cohort.startDate, { week: workday.opensWeek ?? workday.day, day: workday.opensDay ?? 1, time: workday.opensTime ?? "09:00" }),
    dueAt: scheduleToDate(context.cohort.startDate, { week: workday.dueWeek ?? workday.day, day: workday.dueDay ?? 7, time: workday.dueTime ?? "23:59" }),
  };
}

/** Open now (or always, for an admin's preview), and whether it's past due. */
function availability(context: Context, workday: Workday, preview: boolean, now = new Date()) {
  const window = windowFor(context, workday);
  return {
    window,
    open: preview || Boolean(window && now >= window.opensAt && now < window.dueAt),
  };
}

const parseState = (value: unknown): DayState => {
  const state = (value && typeof value === "object" ? value : {}) as Partial<DayState>;
  return { clockedInAt: state.clockedInAt, steps: state.steps ?? {}, workday: state.workday, cast: state.cast };
};

async function contentFor(programId: string, levelId: string, track: string, levelName: string, intern: string): Promise<OfficeLifeContent> {
  const saved = await getPrisma().officeLifeContent.findUnique({ where: { programId_levelId: { programId, levelId } }, select: { content: true } });
  const content = parseOfficeLifeContent(saved?.content) ?? defaultOfficeLifeContent(track, levelName);
  return personalizeOfficeLifeContent(content, intern);
}

/** The cast, for the apps: names, roles, addresses and voices. */
function people(cast: Cast) {
  return (["ceo", "manager", "supporter", "challenger", "client"] as PersonId[]).map((id) => ({
    id,
    name: cast[id].name,
    role: cast[id].role,
    email: cast[id].email,
    voice: cast[id].voice,
  }));
}

/** Every workday: when it opens, whether it's done, on time, and its score. */
export async function officeLifeOverview(userId: string, preview: boolean) {
  const context = await internContext(userId);
  if (!context) return { enrolled: false as const };
  const content = await contentFor(context.programId, context.levelId, context.track, context.level.name, context.you);
  const rows = await getPrisma().officeLifeDay.findMany({
    where: { userId, programId: context.programId, levelId: context.levelId },
    select: { day: true, score: true, completedAt: true, state: true },
  });
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days = content.workdays.map((defaultWorkday) => {
    const row = byDay.get(defaultWorkday.day);
    const rowState = parseState(row?.state);
    const legacyWorkday = rowState.clockedInAt && !rowState.workday
      ? workdaysFor(context.track, context.you).find((item) => item.day === defaultWorkday.day)
      : null;
    const snapshot = rowState.workday ?? legacyWorkday;
    const workday = { ...defaultWorkday, ...(snapshot ?? {}) };
    const { window, open } = availability(context, workday, preview);
    const state = parseState(row?.state);
    const done = workday.steps.filter((step) => state.steps[step.id]).length;
    return {
      day: workday.day,
      title: workday.title,
      summary: workday.summary,
      opensAt: window?.opensAt.toISOString() ?? null,
      dueAt: window?.dueAt.toISOString() ?? null,
      open,
      upcoming: Boolean(window && new Date() < window.opensAt),
      closed: Boolean(window && new Date() >= window.dueAt && !row?.completedAt),
      stepsDone: done,
      stepsTotal: workday.steps.length,
      score: row?.score ?? null,
      completedAt: row?.completedAt?.toISOString() ?? null,
      late: Boolean(row?.completedAt && window && row.completedAt > window.dueAt),
    };
  });
  const scored = days.filter((day) => day.score !== null);
  return {
    enrolled: true as const,
    hasCohort: Boolean(context.cohort),
    cohort: context.cohort?.name ?? null,
    level: context.level.name,
    you: context.you,
    company: content.company.name,
    department: content.department,
    client: content.clientCompany,
    days,
    readiness: scored.length ? Math.round(scored.reduce((sum, day) => sum + (day.score ?? 0), 0) / scored.length) : null,
  };
}

function view(workday: Workday, state: DayState) {
  let reachedCurrent = false;
  const steps = workday.steps.map((step) => {
    const result = state.steps[step.id];
    const available = !result && !reachedCurrent && Boolean(state.clockedInAt);
    if (!result && !reachedCurrent) reachedCurrent = true;
    return { ...step, done: Boolean(result), available, at: result?.at ?? null, submission: result?.submission ?? null, feedback: result?.feedback ?? null };
  });
  return steps;
}

/** One workday, with every step's content, progress and feedback. */
export async function officeLifeDay(userId: string, day: number, preview: boolean) {
  const context = await internContext(userId);
  if (!context) return { error: "Office Life opens once you're admitted to a track.", status: 403 } as const;
  const content = await contentFor(context.programId, context.levelId, context.track, context.level.name, context.you);
  const row = await getPrisma().officeLifeDay.findUnique({
    where: { userId_programId_levelId_day: { userId, programId: context.programId, levelId: context.levelId, day } },
    select: { state: true, score: true, completedAt: true },
  });
  const state = parseState(row?.state);
  const defaultWorkday = content.workdays.find((item) => item.day === day);
  const legacyWorkday = state.clockedInAt && !state.workday
    ? workdaysFor(context.track, context.you).find((item) => item.day === day)
    : null;
  const snapshot = state.workday ?? legacyWorkday;
  const workday = defaultWorkday ? { ...defaultWorkday, ...(snapshot ?? {}) } : snapshot;
  if (!workday) return { error: "That workday doesn't exist.", status: 404 } as const;
  const { window, open } = availability(context, workday, preview);
  if (!open && !row?.completedAt)
    return {
      error: window
        ? `This workday opens on ${window.opensAt.toUTCString()}.`
        : "Office Life opens once you're placed in a cohort.",
      status: 403,
    } as const;
  const cast = state.cast ?? (state.clockedInAt ? castFor(context.track) : castFromOfficeLifeContent(content));
  return {
    day: workday.day,
    title: workday.title,
    summary: workday.summary,
    you: context.you,
    level: context.level.name,
    company: { ...cast.company },
    department: cast.department,
    people: people(cast),
    dueAt: window?.dueAt.toISOString() ?? null,
    clockedInAt: state.clockedInAt ?? null,
    score: row?.score ?? null,
    completedAt: row?.completedAt?.toISOString() ?? null,
    steps: view(workday, state),
  };
}

export type OfficeLifeAction =
  | { action: "clock-in" }
  | { action: "read"; stepId: string }
  | { action: "email"; stepId: string; to: string[]; cc: string[]; subject: string; body: string }
  | { action: "meeting"; stepId: string; turns: string[] }
  | { action: "report"; stepId: string; fields: string[] }
  | { action: "work"; stepId: string; summary: string; link: string };

const PEOPLE: PersonId[] = ["ceo", "manager", "supporter", "challenger", "client"];
const asPeople = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is PersonId => PEOPLE.includes(id as PersonId)))] : [];

/**
 * Does the next step of a workday. Steps go in order: only the first
 * unfinished one is accepted, and a finished step can't be redone (so
 * each piece of work is marked once).
 */
export async function officeLifeAct(userId: string, day: number, preview: boolean, input: OfficeLifeAction) {
  const context = await internContext(userId);
  if (!context) return { error: "Office Life opens once you're admitted to a track.", status: 403 } as const;
  const content = await contentFor(context.programId, context.levelId, context.track, context.level.name, context.you);

  const prisma = getPrisma();
  const key = { userId_programId_levelId_day: { userId, programId: context.programId, levelId: context.levelId, day } };
  const row = await prisma.officeLifeDay.findUnique({ where: key, select: { state: true } });
  const state = parseState(row?.state);
  const defaultWorkday = content.workdays.find((item) => item.day === day);
  if (!defaultWorkday && !state.workday) return { error: "That workday doesn't exist.", status: 404 } as const;
  const legacyWorkday = state.clockedInAt && !state.workday
    ? workdaysFor(context.track, context.you).find((item) => item.day === day)
    : null;
  const snapshot = state.workday ?? legacyWorkday;
  const workday = defaultWorkday ? { ...defaultWorkday, ...(snapshot ?? {}) } : snapshot;
  if (!workday) return { error: "That workday doesn't exist.", status: 404 } as const;
  if (!availability(context, workday, preview).open) return { error: "This workday is outside its scheduled window.", status: 403 } as const;
  const cast = state.cast ?? (state.clockedInAt ? castFor(context.track) : castFromOfficeLifeContent(content));
  const now = new Date().toISOString();
  // What to celebrate once it's saved: a first clock-in or a graded step.
  let clockedIn = false;
  let doneStep: { id: string; kind: string; title: string; score: number | null } | null = null;

  if (input.action === "clock-in") {
    if (!state.clockedInAt) {
      clockedIn = true;
      state.clockedInAt = now;
      state.workday = defaultWorkday;
      state.cast = castFromOfficeLifeContent(content);
    }
  } else {
    if (!state.clockedInAt) return { error: "Clock in first.", status: 400 } as const;
    const next = workday.steps.find((step) => !state.steps[step.id]);
    if (!next || next.id !== input.stepId) return { error: "Finish the steps in order.", status: 409 } as const;
    const step = next;
    const result = await doStep(context, step, input, cast);
    if ("error" in result) return result;
    state.workday = workday;
    state.cast = cast;
    state.steps[step.id] = { at: now, ...result };
    if (step.kind !== "inbox")
      doneStep = { id: step.id, kind: step.kind, title: step.title, score: state.steps[step.id]?.feedback?.score ?? null };
  }

  const graded = workday.steps.filter((step) => step.kind !== "inbox");
  const finished = workday.steps.every((step) => state.steps[step.id]);
  const scores = graded.map((step) => state.steps[step.id]?.feedback?.score).filter((score): score is number => typeof score === "number");
  const score = finished && scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;

  await prisma.$transaction(async (tx) => {
    await tx.officeLifeDay.upsert({
      where: key,
      create: {
        userId,
        programId: context.programId,
        levelId: context.levelId,
        day,
        state: state as unknown as Prisma.InputJsonValue,
        score,
        completedAt: finished ? new Date() : null,
      },
      update: {
        state: state as unknown as Prisma.InputJsonValue,
        score,
        ...(finished ? { completedAt: new Date() } : {}),
      },
    });
    if (preview) return;
    const event = {
      userId,
      programId: context.programId,
      levelId: context.levelId,
      day,
      track: context.track,
      level: context.level.name,
    };
    if (clockedIn) await awardOfficeLifeClockIn(tx, event);
    if (doneStep)
      await awardOfficeLifeStep(tx, {
        ...event,
        stepId: doneStep.id,
        stepKind: doneStep.kind,
        stepTitle: doneStep.title,
        score: doneStep.score,
      });
    if (finished) await awardOfficeLifeAchievement(tx, { ...event, score });
  });
  return officeLifeDay(userId, day, preview);
}

async function doStep(
  context: Context,
  step: Step,
  input: Exclude<OfficeLifeAction, { action: "clock-in" }>,
  cast: Cast,
): Promise<{ submission?: Submission; feedback?: Feedback } | { error: string; status: number }> {
  if (step.kind === "work" && step.labScenarioId) {
    const attempt = await getPrisma().labAttempt.findUnique({
      where: { userId_scenarioId: { userId: context.userId, scenarioId: step.labScenarioId } },
      select: { status: true },
    });
    if (attempt?.status !== "SUBMITTED")
      return { error: "Complete and submit the linked Practice Lab exercise before sending this activity.", status: 409 };
  }
  if (step.kind === "inbox") {
    if (input.action !== "read") return { error: "Open the email first.", status: 400 };
    return {};
  }
  let submission: Submission;
  if (step.kind === "email" && input.action === "email") {
    const to = asPeople(input.to);
    const cc = asPeople(input.cc).filter((id) => !to.includes(id));
    const subject = clip(input.subject, LIMITS.subject);
    const body = clip(input.body, LIMITS.body);
    if (!to.length) return { error: "Add at least one recipient.", status: 400 };
    if (!body) return { error: "Write the email first.", status: 400 };
    submission = { kind: "email", to, cc, subject, body };
  } else if (step.kind === "meeting" && input.action === "meeting") {
    const prompts = step.lines.filter((line): line is { you: string } => "you" in line).map((line) => line.you);
    const turns = Array.isArray(input.turns) ? input.turns : [];
    submission = { kind: "meeting", turns: prompts.map((prompt, i) => ({ prompt, text: clip(turns[i], LIMITS.turn) })) };
  } else if (step.kind === "report" && input.action === "report") {
    const fields = Array.isArray(input.fields) ? input.fields : [];
    submission = { kind: "report", fields: step.fields.map((label, i) => ({ label, text: clip(fields[i], LIMITS.field) })) };
    if (submission.fields.every((field) => !field.text)) return { error: "Fill in the report first.", status: 400 };
  } else if (step.kind === "work" && input.action === "work") {
    const summary = clip(input.summary, LIMITS.summary);
    if (!summary) return { error: "Describe what you built first.", status: 400 };
    submission = { kind: "work", summary, link: clip(input.link, LIMITS.link) };
  } else {
    return { error: "That isn't this step.", status: 400 };
  }
  const feedback = await gradeStep(cast, step, submission, context.you);
  return { submission, feedback };
}

export { WORKDAYS };
