import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { CURRICULUM } from "../lib/curriculum";
import { importCurriculum, LEVEL_FEES } from "../lib/curriculum-import";
import { generateCohortTasks, generateSelfPacedTasks, openWeekFor } from "../lib/task-generation";

// The curriculum import and task generation on a real Postgres, in memory
// (PGlite). Never touches the live or development database.
//
//   npx tsx --test tests/task-generation.db.test.ts

const PORT = 54_000 + (process.pid % 1000);
const LEVELS = Object.keys(LEVEL_FEES);
let pg: PGlite;
let socket: PGLiteSocketServer;
let db: PrismaClient;

async function person() {
  return db.user.create({ data: { id: randomUUID(), email: `${randomUUID()}@example.com` } });
}

async function place(track: string, level: string) {
  const program = await db.internshipProgram.findFirstOrThrow({ where: { name: track } });
  const row = await db.internshipLevel.findFirstOrThrow({ where: { name: level } });
  return { programId: program.id, levelId: row.id };
}

async function cohort(track: string, level: string, start: string, end: string) {
  return db.internshipCohort.create({
    data: {
      ...(await place(track, level)),
      name: `${track} ${level} ${start}`,
      slug: randomUUID(),
      startDate: new Date(start),
      endDate: new Date(end),
    },
  });
}

async function selfPaced(track: string, level: string, userId: string) {
  const start = new Date("2026-12-02T10:00:00Z");
  const application = await db.internshipApplication.create({
    data: { studentId: userId, ...(await place(track, level)), selfPacedStartDate: start, learningMode: "SELF_PACED" },
  });
  return { ...application, selfPacedStartDate: start };
}

before(async () => {
  pg = await PGlite.create();
  const schema = execFileSync(
    process.execPath,
    [require.resolve("prisma/build/index.js"), "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
    {
      encoding: "utf8",
      maxBuffer: 1e8,
      stdio: ["ignore", "pipe", "ignore"],
      // Never connected to: the command only needs a URL to be set.
      env: { ...process.env, DIRECT_URL: "postgresql://x:x@127.0.0.1:1/none", DATABASE_URL: "postgresql://x:x@127.0.0.1:1/none" },
    },
  );
  await pg.exec(schema.slice(schema.search(/^(--|CREATE)/m)));
  socket = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await socket.start();
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`, max: 1 }),
  });
  globalThis.__grouhPrismaClient = db;
  for (const [index, name] of LEVELS.entries()) await db.internshipLevel.create({ data: { name, rank: index + 1 } });
  // A track that already exists, with an old template, a real lab and an admin-set fee.
  const program = await db.internshipProgram.create({
    data: {
      slug: "ai-automation", name: "AI Automation", duration: "1 Month", price: 0, acceptanceFee: 990,
      description: "x", features: [], requirements: [], certificateEligibility: "Yes", status: "PUBLISHED",
    },
  });
  const beginner = await db.internshipLevel.findFirstOrThrow({ where: { name: "Beginner" } });
  const novice = await db.internshipLevel.findFirstOrThrow({ where: { name: "Novice" } });
  const at = { programId: program.id, levelId: beginner.id };
  await db.internshipLevelFee.create({ data: { programId: program.id, levelId: novice.id, acceptanceFee: 2500 } });
  await db.internshipTaskTemplate.create({
    data: { ...at, title: "Old task", opensWeek: 1, opensDay: 1, opensTime: "09:00", dueWeek: 1, dueDay: 7, dueTime: "23:59" },
  });
  await db.labScenario.create({
    data: { ...at, kind: "AUTOMATION", title: "Week 1: Your first automation", brief: "x", starterFiles: {}, published: true },
  });
}, { timeout: 120_000 });

after(async () => {
  await db?.$disconnect();
  await socket?.stop();
  await pg?.close();
});

test("a dry run changes nothing", async () => {
  const report = await importCurriculum({ dryRun: true }, db);
  assert.equal(report.templatesCreated, 335); // 514 without the 179 labs that don't exist
  assert.equal(report.tracksCreated.length, 8);
  assert.equal(await db.internshipTaskTemplate.count(), 1);
});

test("the import loads every track, level and week once", async () => {
  const report = await importCurriculum({ dryRun: false }, db);
  assert.equal(report.templatesCreated, 335); // 514 without the 179 labs that don't exist
  assert.equal(report.templatesArchived, 1);
  assert.equal(report.labsLinked, 1);
  assert.equal(report.missingLabs.length, 179);
  assert.equal(await db.labScenario.count(), 1);
  assert.deepEqual(report.missingOfficeLife, []);
  assert.equal(await db.internshipProgram.count({ where: { status: "PUBLISHED" } }), CURRICULUM.length);
  // An admin's fee is kept; the rest are added.
  const { programId, levelId } = await place("AI Automation", "Novice");
  assert.equal((await db.internshipLevelFee.findFirstOrThrow({ where: { programId, levelId } })).acceptanceFee, 2500);
  const cyber = await place("Cybersecurity", "Professional");
  assert.equal((await db.internshipLevelFee.findFirstOrThrow({ where: cyber })).acceptanceFee, 25000);
  // Every week has its Office Life day, no empty lab, and says how to submit.
  const tasks = await db.internshipTaskTemplate.findMany({ where: { ...cyber, archived: false } });
  for (const week of [1, 2, 3, 4]) {
    const own = tasks.filter((task) => task.opensWeek === week);
    assert.equal(own.filter((task) => task.officeLifeDay === week).length, 1);
  }
  assert.ok(tasks.every((task) => task.description?.includes("How to submit: ")));
  assert.ok(tasks.every((task) => !task.title.startsWith("Practice Lab")));
});

test("a lab made later joins its week when the import is rerun", async () => {
  const at = await place("Virtual Assistant", "Novice");
  const lab = await db.labScenario.create({
    data: { ...at, kind: "CONTENT", title: "Week 1: Client task board", brief: "x", starterFiles: {}, published: true },
  });
  const report = await importCurriculum({ dryRun: false }, db);
  assert.equal(report.templatesCreated, 1);
  assert.equal((await db.internshipTaskTemplate.findFirstOrThrow({ where: { ...at, labScenarioId: { not: null } } })).labScenarioId, lab.id);
});

test("running it again adds nothing and keeps admins' edits and new templates", async () => {
  const at = await place("Cybersecurity", "Beginner");
  const edited = await db.internshipTaskTemplate.findFirstOrThrow({ where: { ...at, officeLifeDay: null } });
  await db.internshipTaskTemplate.update({ where: { id: edited.id }, data: { title: "Edited by an admin" } });
  const added = await db.internshipTaskTemplate.create({
    data: { ...at, title: "Added by an admin", opensWeek: 9, opensDay: 1, opensTime: "09:00", dueWeek: 9, dueDay: 7, dueTime: "23:59" },
  });
  const before = await Promise.all([db.internshipTaskTemplate.count(), db.labScenario.count(), db.internshipAssessment.count()]);
  const report = await importCurriculum({ dryRun: false }, db);
  assert.equal(report.templatesCreated + report.templatesArchived + report.tracksCreated.length + report.feesAdded.length, 0);
  assert.deepEqual(await Promise.all([db.internshipTaskTemplate.count(), db.labScenario.count(), db.internshipAssessment.count()]), before);
  assert.equal((await db.internshipTaskTemplate.findUniqueOrThrow({ where: { id: edited.id } })).title, "Edited by an admin");
  assert.equal((await db.internshipTaskTemplate.findUniqueOrThrow({ where: { id: added.id } })).archived, false);
  await db.internshipTaskTemplate.delete({ where: { id: added.id } });
});

test("a cohort gets its track and level's tasks, Monday to Sunday, once", async () => {
  const monday = await cohort("Digital Marketing", "Novice", "2027-01-04T00:00:00+01:00", "2027-02-04T00:00:00+01:00");
  const first = await generateCohortTasks(monday.id, {}, db);
  assert.ok(first.ok && first.created > 0);
  const again = await generateCohortTasks(monday.id, {}, db);
  assert.ok(again.ok && again.created === 0);
  // Two at the same moment don't double up either.
  const busy = await cohort("Digital Marketing", "Novice", "2027-03-01T00:00:00+01:00", "2027-04-01T00:00:00+01:00");
  await Promise.all([generateCohortTasks(busy.id, {}, db), generateCohortTasks(busy.id, {}, db)]);
  assert.equal(await db.internshipTask.count({ where: { cohortId: busy.id } }), first.created);

  const tasks = await db.internshipTask.findMany({ where: { cohortId: monday.id, opensWeek: 2 } });
  for (const task of tasks) {
    assert.equal(task.opensAt.toISOString(), "2027-01-11T08:00:00.000Z"); // Mon 09:00 WAT
    assert.equal(task.dueDate.toISOString(), "2027-01-17T22:59:00.000Z"); // Sun 23:59 WAT
  }
});

test("a cohort that starts mid-week opens week 1 that day, then follows Mondays", async () => {
  const thursday = await cohort("Cybersecurity", "Beginner", "2027-01-07T00:00:00+01:00", "2027-02-20T00:00:00+01:00");
  await generateCohortTasks(thursday.id, {}, db);
  const at = async (week: number) =>
    (await db.internshipTask.findFirstOrThrow({ where: { cohortId: thursday.id, opensWeek: week } }));
  assert.equal((await at(1)).opensAt.toISOString(), "2027-01-07T08:00:00.000Z");
  assert.equal((await at(1)).dueDate.toISOString(), "2027-01-17T22:59:00.000Z");
  assert.equal((await at(2)).opensAt.toISOString(), "2027-01-18T08:00:00.000Z");
});

test("a live cohort only gets the weeks it is missing, and used tasks can't be replaced", async () => {
  const live = await cohort("AI Automation", "Advanced", "2027-01-04T00:00:00+01:00", "2027-02-04T00:00:00+01:00");
  const { programId } = await place("AI Automation", "Advanced");
  const unit = await db.internshipModule.create({ data: { programId, title: "Old", order: 1 } });
  const old = (week: number) => ({
    moduleId: unit.id, cohortId: live.id, title: `Own week ${week}`, opensWeek: week, opensDay: 1, opensTime: "09:00",
    dueWeek: week, dueDay: 7, dueTime: "23:59", opensAt: live.startDate, dueDate: live.endDate,
  });
  const own = await db.internshipTask.create({ data: old(1) });
  await db.internshipTask.create({ data: old(2) });
  const result = await generateCohortTasks(live.id, {}, db);
  assert.ok(result.ok);
  assert.deepEqual(result.weeks, [3, 4]);
  assert.equal(await db.internshipTask.count({ where: { cohortId: live.id, opensWeek: 1 } }), 1);

  const intern = await person();
  await db.taskSubmission.create({ data: { taskId: own.id, userId: intern.id, content: "done", status: "SUBMITTED" } });
  const refused = await generateCohortTasks(live.id, { replaceUnused: true }, db);
  assert.equal(refused.ok, false);

  const unused = await cohort("AI Automation", "Advanced", "2027-05-03T00:00:00+01:00", "2027-06-03T00:00:00+01:00");
  await db.internshipTask.create({ data: { ...old(1), cohortId: unused.id } });
  const replaced = await generateCohortTasks(unused.id, { replaceUnused: true }, db);
  assert.ok(replaced.ok && replaced.removed === 1);
  assert.deepEqual(replaced.ok && replaced.weeks, [1, 2, 3, 4]);
});

test("self-paced: made once, each week unlocks when the one before is finished", async () => {
  const intern = await person();
  const application = await selfPaced("Virtual Assistant", "Novice", intern.id);
  const made = await generateSelfPacedTasks(application, db);
  assert.ok(made > 0);
  assert.equal(await generateSelfPacedTasks(application, db), 0);
  assert.equal(await openWeekFor(application.id, intern.id, db), 1);

  const week1 = await db.internshipTask.findMany({ where: { applicationId: application.id, opensWeek: 1 } });
  const submit = (taskId: string, status: "SUBMITTED" | "ACCEPTED" | "REJECTED") =>
    db.taskSubmission.create({ data: { taskId, userId: intern.id, content: "work", status } });
  const lab = week1.find((task) => task.labScenarioId)!;
  const office = week1.find((task) => task.officeLifeDay)!;
  for (const task of week1) if (task !== lab && task !== office) await submit(task.id, "SUBMITTED");
  await submit(office.id, "ACCEPTED");
  const failed = await submit(lab.id, "REJECTED");
  assert.equal(await openWeekFor(application.id, intern.id, db), 1, "a lab must be passed");
  await db.taskSubmission.update({ where: { id: failed.id }, data: { status: "ACCEPTED" } });
  assert.equal(await openWeekFor(application.id, intern.id, db), 2);
});

test("moving up a level brings the new level's tasks and keeps the old ones", async () => {
  const intern = await person();
  const first = await selfPaced("Cybersecurity", "Novice", intern.id);
  await generateSelfPacedTasks(first, db);
  const next = await selfPaced("Cybersecurity", "Intermediate", intern.id);
  await generateSelfPacedTasks(next, db);
  const titles = async (id: string) => (await db.internshipTask.findMany({ where: { applicationId: id } })).map((task) => task.title);
  assert.ok((await titles(next.id)).includes("Incident report"));
  assert.ok(!(await titles(first.id)).includes("Incident report"));
  assert.equal(await openWeekFor(next.id, intern.id, db), 1);
});

test("editing a template changes tasks made later, not ones already made", async () => {
  const [one, two] = [await person(), await person()];
  const before = await selfPaced("Front-End Development", "Advanced", one.id);
  await generateSelfPacedTasks(before, db);
  const task = await db.internshipTask.findFirstOrThrow({ where: { applicationId: before.id, opensWeek: 1, labScenarioId: null, officeLifeDay: null } });
  await db.internshipTaskTemplate.update({ where: { id: task.templateId! }, data: { title: "New wording" } });
  const later = await selfPaced("Front-End Development", "Advanced", two.id);
  await generateSelfPacedTasks(later, db);
  assert.equal((await db.internshipTask.findUniqueOrThrow({ where: { id: task.id } })).title, task.title);
  assert.equal(await db.internshipTask.count({ where: { applicationId: later.id, title: "New wording" } }), 1);
});
