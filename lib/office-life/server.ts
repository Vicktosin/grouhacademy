import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { gradeStep, type Feedback, type Submission } from "@/lib/office-life/grade";
import {
  castFor,
  workdaysFor,
  workdayWindow,
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
export type DayState = { clockedInAt?: string; steps: Record<string, StepResult> };

const LIMITS = { subject: 200, body: 4000, turn: 2000, field: 2000, summary: 3000, link: 500 };
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** The intern's track, cohort start and first name, from their newest application. */
async function internContext(userId: string) {
  const prisma = getPrisma();
  const [application, user] = await Promise.all([
    prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
      select: { programId: true, program: { select: { name: true } }, cohort: { select: { name: true, startDate: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, profile: { select: { firstName: true } } },
    }),
  ]);
  if (!application) return null;
  const you = user?.profile?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || "there";
  return {
    programId: application.programId,
    track: application.program.name,
    cohort: application.cohort,
    you,
  };
}

type Context = NonNullable<Awaited<ReturnType<typeof internContext>>>;

function windowFor(context: Context, day: number) {
  return context.cohort ? workdayWindow(context.cohort.startDate, day) : null;
}

/** Open now (or always, for an admin's preview), and whether it's past due. */
function availability(context: Context, day: number, preview: boolean, now = new Date()) {
  const window = windowFor(context, day);
  return {
    window,
    open: preview || Boolean(window && now >= window.opensAt),
  };
}

const parseState = (value: unknown): DayState => {
  const state = (value && typeof value === "object" ? value : {}) as Partial<DayState>;
  return { clockedInAt: state.clockedInAt, steps: state.steps ?? {} };
};

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
  const cast = castFor(context.track);
  const rows = await getPrisma().officeLifeDay.findMany({
    where: { userId, programId: context.programId },
    select: { day: true, score: true, completedAt: true, state: true },
  });
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days = workdaysFor(context.track, context.you).map((workday) => {
    const row = byDay.get(workday.day);
    const { window, open } = availability(context, workday.day, preview);
    const state = parseState(row?.state);
    const done = workday.steps.filter((step) => state.steps[step.id]).length;
    return {
      day: workday.day,
      title: workday.title,
      summary: workday.summary,
      opensAt: window?.opensAt.toISOString() ?? null,
      dueAt: window?.dueAt.toISOString() ?? null,
      open,
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
    you: context.you,
    company: cast.company.name,
    department: cast.department,
    client: cast.clientCompany,
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
  const workday = workdaysFor(context.track, context.you).find((item) => item.day === day);
  if (!workday) return { error: "That workday doesn't exist.", status: 404 } as const;
  const { window, open } = availability(context, day, preview);
  if (!open)
    return {
      error: window
        ? `This workday opens on ${window.opensAt.toUTCString()}.`
        : "Office Life opens once you're placed in a cohort.",
      status: 403,
    } as const;
  const row = await getPrisma().officeLifeDay.findUnique({
    where: { userId_programId_day: { userId, programId: context.programId, day } },
    select: { state: true, score: true, completedAt: true },
  });
  const state = parseState(row?.state);
  const cast = castFor(context.track);
  return {
    day: workday.day,
    title: workday.title,
    summary: workday.summary,
    you: context.you,
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
  const workday = workdaysFor(context.track, context.you).find((item) => item.day === day);
  if (!workday) return { error: "That workday doesn't exist.", status: 404 } as const;
  if (!availability(context, day, preview).open) return { error: "This workday isn't open yet.", status: 403 } as const;

  const prisma = getPrisma();
  const key = { userId_programId_day: { userId, programId: context.programId, day } };
  const row = await prisma.officeLifeDay.findUnique({ where: key, select: { state: true } });
  const state = parseState(row?.state);
  const now = new Date().toISOString();

  if (input.action === "clock-in") {
    if (!state.clockedInAt) state.clockedInAt = now;
  } else {
    if (!state.clockedInAt) return { error: "Clock in first.", status: 400 } as const;
    const next = workday.steps.find((step) => !state.steps[step.id]);
    if (!next || next.id !== input.stepId) return { error: "Finish the steps in order.", status: 409 } as const;
    const step = next;
    const result = await doStep(context, step, input);
    if ("error" in result) return result;
    state.steps[step.id] = { at: now, ...result };
  }

  const graded = workday.steps.filter((step) => step.kind !== "inbox");
  const finished = workday.steps.every((step) => state.steps[step.id]);
  const scores = graded.map((step) => state.steps[step.id]?.feedback?.score).filter((score): score is number => typeof score === "number");
  const score = finished && scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;

  await prisma.officeLifeDay.upsert({
    where: key,
    create: {
      userId,
      programId: context.programId,
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
  return officeLifeDay(userId, day, preview);
}

async function doStep(
  context: Context,
  step: Step,
  input: Exclude<OfficeLifeAction, { action: "clock-in" }>,
): Promise<{ submission?: Submission; feedback?: Feedback } | { error: string; status: number }> {
  const cast = castFor(context.track);
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
