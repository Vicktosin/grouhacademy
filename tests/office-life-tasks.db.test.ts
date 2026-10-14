import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { config, parse } from "dotenv";

// Office Life tasks against a real database: finishing a workday through
// Office Life itself (lib/office-life/server) submits and accepts its linked
// tasks. Uses the DEVELOPMENT project (.env.dev-db) and never the live one;
// everything it creates is deleted afterwards.
//
//   OFFICE_LIFE_DB_TEST=1 npx tsx --test tests/office-life-tasks.db.test.ts

const enabled = process.env.OFFICE_LIFE_DB_TEST === "1";
if (enabled) {
  config({ path: process.env.DB_TEST_ENV ?? ".env.dev-db", quiet: true });
  const live = parse(readFileSync(".env"));
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL === live.DATABASE_URL)
    throw new Error("Refusing to run: this would use the live database. Point it at the development project.");
}
const skip = enabled ? false : "set OFFICE_LIFE_DB_TEST=1 to run against the development database";

const run = randomUUID().slice(0, 8);
const ids = {
  intern: randomUUID(),
  mentor: randomUUID(),
  cohortA: "",
  cohortB: "",
  module: "",
  programId: "",
  levelId: "",
  tasks: {} as Record<string, string>,
};

async function load() {
  // Many small queries per transaction over the internet to the development
  // project: give transactions more than the 5s default (production runs
  // next to the database).
  const { PrismaClient } = await import("../generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  globalThis.__grouhPrismaClient = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });
  const { getPrisma } = await import("../lib/prisma");
  const server = await import("../lib/office-life/server");
  const tasks = await import("../lib/office-life/tasks");
  const taskList = await import("../lib/office-life/task-list");
  const content = await import("../lib/office-life/content");
  const schedule = await import("../lib/task-schedule");
  const grading = await import("../lib/submission-grading");
  const progress = await import("../lib/internship-progress");
  const internTasks = await import("../lib/intern-tasks");
  return { prisma: getPrisma(), server, tasks, taskList, content, schedule, grading, progress, internTasks };
}
let m: Awaited<ReturnType<typeof load>>;

before(async () => {
  if (!enabled) return;
  m = await load();
  const { prisma } = m;
  const program = await prisma.internshipProgram.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  const level = await prisma.internshipLevel.findFirstOrThrow({ orderBy: { rank: "asc" }, select: { id: true, name: true } });
  ids.programId = program.id;
  ids.levelId = level.id;

  // A cohort start that puts workday 1 open right now.
  const saved = await prisma.officeLifeContent.findUnique({ where: { programId_levelId: { programId: program.id, levelId: level.id } } });
  const plan = m.content.parseOfficeLifeContent(saved?.content) ?? m.content.defaultOfficeLifeContent(program.name, level.name);
  const first = plan.workdays.find((workday) => workday.day === 1)!;
  const now = new Date();
  let startDate: Date | null = null;
  for (let back = 0; back < 60 && !startDate; back++) {
    const start = new Date(now.getTime() - back * 86_400_000);
    const opens = m.schedule.scheduleToDate(start, { week: first.opensWeek, day: first.opensDay, time: first.opensTime });
    const due = m.schedule.scheduleToDate(start, { week: first.dueWeek, day: first.dueDay, time: first.dueTime });
    if (opens <= now && now < due) startDate = start;
  }
  assert.ok(startDate, "no cohort start opens workday 1 now");

  await prisma.user.createMany({
    data: [
      { id: ids.intern, email: `ol-test-intern-${run}@developer.local`, name: "OL Test Intern" },
      { id: ids.mentor, email: `ol-test-mentor-${run}@developer.local`, name: "OL Test Mentor" },
    ],
  });
  const cohort = (suffix: string) =>
    prisma.internshipCohort.create({
      data: {
        programId: program.id,
        levelId: level.id,
        name: `OL test cohort ${suffix} ${run}`,
        slug: `ol-test-${suffix}-${run}`,
        startDate: startDate!,
        endDate: new Date(startDate!.getTime() + 28 * 86_400_000),
      },
      select: { id: true },
    });
  ids.cohortA = (await cohort("a")).id;
  ids.cohortB = (await cohort("b")).id;
  const application = await prisma.internshipApplication.create({
    data: { studentId: ids.intern, programId: program.id, levelId: level.id, cohortId: ids.cohortA },
    select: { id: true },
  });
  await prisma.internshipPayment.create({ data: { applicationId: application.id, reference: `ol-test-${run}`, amount: 0, status: "PAID" } });
  await prisma.assessmentAttempt.create({ data: { applicationId: application.id, status: "PASSED", outcomeEmail: `ol-test-intern-${run}@developer.local` } });
  ids.module = (await prisma.internshipModule.create({ data: { programId: program.id, title: `OL test module ${run}` }, select: { id: true } })).id;
});

async function addTask(key: string, data: { cohortId?: string; officeLifeDay?: number | null; week?: number }) {
  const now = Date.now();
  const task = await m.prisma.internshipTask.create({
    data: {
      title: `OL test ${key} ${run}`,
      moduleId: ids.module,
      cohortId: data.cohortId ?? ids.cohortA,
      officeLifeDay: data.officeLifeDay === undefined ? 1 : data.officeLifeDay,
      opensWeek: data.week ?? 1,
      opensDay: 1,
      opensTime: "00:00",
      dueWeek: data.week ?? 1,
      dueDay: 7,
      dueTime: "23:59",
      opensAt: new Date(now - 86_400_000),
      dueDate: new Date(now + 7 * 86_400_000),
    },
    select: { id: true },
  });
  ids.tasks[key] = task.id;
  return task.id;
}

const submissionsFor = (taskId: string) => m.prisma.taskSubmission.findMany({ where: { taskId } });

type DayView = Exclude<Awaited<ReturnType<typeof import("../lib/office-life/server").officeLifeDay>>, { error: string }>;

async function doStep(step: DayView["steps"][number]) {
  const base = { stepId: step.id };
  const action =
    step.kind === "inbox"
      ? { action: "read", ...base }
      : step.kind === "meeting"
        ? { action: "meeting", ...base, turns: step.lines.filter((line) => "you" in line).map(() => "I'll share a clear plan by Friday, flag risks early and confirm owners.") }
        : step.kind === "email"
          ? { action: "email", ...base, to: step.to, cc: step.cc, subject: "Update on the project", body: "Hi team, here is today's update: the draft is done, the review is booked for Thursday and I'll send the final version on Friday. Thanks!" }
          : step.kind === "report"
            ? { action: "report", ...base, fields: step.fields.map(() => "Finished the draft; next I review it with the team and send it to the client.") }
            : { action: "work", ...base, summary: "Built the requested piece, checked it against the brief and noted what to improve next.", link: "https://example.com/work" };
  const result = await m.server.officeLifeAct(ids.intern, 1, false, action as never);
  assert.ok(!("error" in result), `step ${step.id}: ${"error" in result ? result.error : ""}`);
}

test("finishing a linked workday creates exactly one accepted submission per linked task, and nothing before that", { skip }, async () => {
  await addTask("linked-1", {});
  await addTask("linked-2", {});
  await addTask("other-cohort", { cohortId: ids.cohortB });
  await addTask("other-workday", { officeLifeDay: 2, week: 2 });
  await addTask("normal", { officeLifeDay: null, week: 2 });

  const clockIn = await m.server.officeLifeAct(ids.intern, 1, false, { action: "clock-in" });
  assert.ok(!("error" in clockIn), "clock in");
  const day = await m.server.officeLifeDay(ids.intern, 1, false);
  assert.ok(!("error" in day));
  const steps = day.steps;
  assert.ok(steps.length > 1);
  for (const step of steps.slice(0, -1)) await doStep(step);

  // Partly done: no submission yet.
  assert.equal((await submissionsFor(ids.tasks["linked-1"])).length, 0);
  const partial = await m.prisma.officeLifeDay.findFirstOrThrow({ where: { userId: ids.intern, day: 1 } });
  assert.equal(partial.completedAt, null);

  await doStep(steps.at(-1)!);
  const finished = await m.prisma.officeLifeDay.findFirstOrThrow({ where: { userId: ids.intern, day: 1 } });
  assert.ok(finished.completedAt);

  for (const key of ["linked-1", "linked-2"]) {
    const rows = await submissionsFor(ids.tasks[key]);
    assert.equal(rows.length, 1, key);
    const [submission] = rows;
    assert.equal(submission.status, "ACCEPTED");
    assert.equal(submission.userId, ids.intern);
    assert.equal(submission.reviewedById, null);
    // Completion-based: no task score, whatever the Office Life score.
    assert.equal(submission.score, null);
    assert.match(submission.content ?? "", /Office Life workday 1/);
    assert.match(submission.content ?? "", new RegExp(`Office Life score for the day: ${finished.score ?? "not scored"}`));
    assert.ok((submission.content ?? "").length <= 10_000);
    const events = await m.prisma.taskSubmissionEvent.findMany({
      where: { submissionId: submission.id },
      orderBy: { createdAt: "asc" },
      select: { kind: true, status: true, score: true, actorRole: true },
    });
    assert.deepEqual(events.map((event) => event.kind), ["SUBMITTED", "AUTO_GRADED"]);
    assert.equal(events[1].status, "ACCEPTED");
    assert.equal(events[1].score, null);
    assert.equal(events[1].actorRole, "SYSTEM");
  }
  for (const key of ["other-cohort", "other-workday", "normal"])
    assert.equal((await submissionsFor(ids.tasks[key])).length, 0, key);

  const notices = await m.prisma.notification.count({ where: { userId: ids.intern, title: "Task submitted and accepted" } });
  assert.equal(notices, 2);
});

test("the task achievements fire, and the score-based ones don't", { skip }, async () => {
  const unlocks = await m.prisma.achievementUnlock.findMany({ where: { userId: ids.intern }, select: { definition: { select: { id: true, trigger: true } } } });
  const triggers = new Set(unlocks.map((unlock) => unlock.definition.trigger));
  const active = async (id: string) => Boolean(await m.prisma.achievementDefinition.findFirst({ where: { id, isActive: true } }));
  // "First Mission Shipped" (a first task handed in) and "Week Warrior" (every week 1 task accepted).
  if (await active("seed-achievement-first-submission")) assert.ok(unlocks.some((unlock) => unlock.definition.id === "seed-achievement-first-submission"));
  if (await active("seed-achievement-week-complete")) assert.ok(unlocks.some((unlock) => unlock.definition.id === "seed-achievement-week-complete"));
  assert.ok(!triggers.has("PERFECT_SCORE"));
  assert.ok(!triggers.has("SCORE_THRESHOLD"));
});

test("running the finish event again creates no duplicate", { skip }, async () => {
  // Office Life re-saves a finished day on any later action; and two runs at once.
  await m.server.officeLifeAct(ids.intern, 1, false, { action: "clock-in" });
  const [a, b] = await Promise.all([m.tasks.submitOfficeLifeTasks({ userId: ids.intern }), m.tasks.submitOfficeLifeTasks({ userId: ids.intern })]);
  assert.equal(a + b, 0);
  for (const key of ["linked-1", "linked-2"]) assert.equal((await submissionsFor(ids.tasks[key])).length, 1);
});

test("the accepted Office Life tasks count toward the certificate like any accepted task", { skip }, async () => {
  const progress = await m.progress.computeInternProgress(ids.intern, ids.cohortA);
  // linked-1 and linked-2 passed, of the cohort's 4 tasks.
  assert.equal(progress.totalTasks, 4);
  assert.equal(progress.completedTasks, 2);
});

test("the task list shows the workday's status and no submission box", { skip }, async () => {
  const context = await m.internTasks.getInternTaskContext(ids.intern);
  const tasks = await m.taskList.getInternTasksWithOfficeLife(ids.intern, context!, false);
  const done = tasks.find((task) => task.id === ids.tasks["linked-1"])!;
  assert.equal(done.status, "Passed");
  assert.equal(done.canSubmit, false);
  assert.equal(done.score, null);
  assert.equal(done.officeLife?.statusLabel, "Completed and submitted");
  const later = tasks.find((task) => task.id === ids.tasks["other-workday"])!;
  assert.equal(later.canSubmit, false);
  assert.equal(later.officeLife?.statusLabel, "Not started");
  assert.ok(later.officeLife?.opensLabel && later.officeLife.dueLabel);
  const normal = tasks.find((task) => task.id === ids.tasks["normal"])!;
  assert.equal(normal.officeLife, null);
});

test("a mentor can change the automatic decision, and it stays changed", { skip }, async () => {
  const [submission] = await submissionsFor(ids.tasks["linked-1"]);
  const result = await m.grading.gradeSubmission(submission.id, { role: "MENTOR", userId: ids.mentor }, { decision: "REJECTED", feedback: "Please redo the report.", rawScore: undefined });
  assert.ok(result.ok, result.ok ? "" : result.error);
  await m.tasks.submitOfficeLifeTasks({ userId: ids.intern });
  const [after] = await submissionsFor(ids.tasks["linked-1"]);
  assert.equal(after.status, "REJECTED");
  assert.equal(after.reviewedById, ids.mentor);
  assert.equal((await m.progress.computeInternProgress(ids.intern, ids.cohortA)).completedTasks, 1);
  // Admins can change it back.
  const admin = await m.grading.gradeSubmission(submission.id, { role: "ADMIN", userId: ids.mentor }, { decision: "ACCEPTED", feedback: "", rawScore: undefined });
  assert.ok(admin.ok);
});

test("backfill: a task linked after the workday was finished gets its submission", { skip }, async () => {
  const taskId = await addTask("linked-later", { week: 3 });
  assert.equal(await m.tasks.submitOfficeLifeTasks({ taskId }, { dryRun: true }), 1);
  assert.equal((await submissionsFor(taskId)).length, 0);
  assert.equal(await m.tasks.submitOfficeLifeTasks({ taskId }), 1);
  assert.equal(await m.tasks.submitOfficeLifeTasks({ taskId }), 0);
  const [submission] = await submissionsFor(taskId);
  assert.equal(submission.status, "ACCEPTED");
  assert.equal(submission.score, null);
});

after(async () => {
  if (!enabled || !m) return;
  const { prisma } = m;
  const taskIds = Object.values(ids.tasks);
  await prisma.internshipTask.deleteMany({ where: { id: { in: taskIds } } });
  if (ids.module) await prisma.internshipModule.deleteMany({ where: { id: ids.module } });
  const applications = await prisma.internshipApplication.findMany({ where: { studentId: ids.intern }, select: { id: true } });
  const applicationIds = applications.map((application) => application.id);
  await prisma.internshipPayment.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.assessmentAttempt.deleteMany({ where: { applicationId: { in: applicationIds } } });
  await prisma.internshipApplication.deleteMany({ where: { id: { in: applicationIds } } });
  await prisma.internshipProgress.deleteMany({ where: { userId: ids.intern } });
  await prisma.achievementUnlock.deleteMany({ where: { userId: ids.intern } });
  await prisma.officeLifeDay.deleteMany({ where: { userId: ids.intern } });
  await prisma.notification.deleteMany({ where: { userId: ids.intern } });
  await prisma.internshipCohort.deleteMany({ where: { id: { in: [ids.cohortA, ids.cohortB].filter(Boolean) } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.intern, ids.mentor] } } });
  const left = await prisma.internshipTask.count({ where: { id: { in: taskIds } } }) + (await prisma.user.count({ where: { id: { in: [ids.intern, ids.mentor] } } }));
  assert.equal(left, 0, "test data left behind");
  await prisma.$disconnect();
});
