import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { deleteLearnerAccount, deletionSummary, listLearnerAccounts } from "../lib/account-deletion";
import { AccountConflictError, ensurePrismaUserWithRoles } from "../lib/supabase/auth";

// Deleting a learner for good, and signing in again after an old sign-in was
// deleted, on a real Postgres in memory (PGlite). Never touches the live or
// development database.
//
//   npx tsx --test tests/account-deletion.db.test.ts

const PORT = 55_000 + (process.pid % 1000);
let pg: PGlite;
let socket: PGLiteSocketServer;
let db: PrismaClient;
let admin: string;
let programId: string;
let levelId: string;
let cohortId: string;

async function login(id: string, email: string, { confirmed = true, seen = new Date() } = {}) {
  await pg.query("insert into auth.users values ($1, $2, $3, $4)", [id, email, confirmed ? new Date() : null, seen]);
}

async function person(role = "INTERN", { signIn = true } = {}) {
  const id = randomUUID();
  const email = `${id}@example.com`;
  await db.user.create({
    data: { id, email, name: "Ada", roles: { create: { role: { connect: { name: role as never } } } } },
  });
  if (signIn) await login(id, email);
  return { id, email };
}

async function application(studentId: string, paid = false) {
  return db.internshipApplication.create({
    data: {
      studentId,
      programId,
      levelId,
      cohortId,
      payment: { create: { reference: randomUUID(), amount: 2200, ...(paid ? { status: "PAID", paidAt: new Date() } : {}) } },
      attempts: { create: { outcomeEmail: "x", answers: { create: { section: "a", questionId: "1", answer: "b" } } } },
    },
  });
}

async function newTask(title: string) {
  const moduleId = (await db.internshipModule.create({ data: { programId, title: "M" } })).id;
  const at = { opensWeek: 1, opensDay: 1, opensTime: "09:00", dueWeek: 1, dueDay: 5, dueTime: "18:00", opensAt: new Date(), dueDate: new Date() };
  return db.internshipTask.create({ data: { cohortId, moduleId, title, ...at } });
}

const gone: string[] = [];
const remove = (who: { id: string; email: string }, deleteLogin = async (id: string) => void gone.push(id)) =>
  deleteLearnerAccount(who.id, { confirmEmail: who.email, adminId: admin }, db, deleteLogin, async () => {});

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
  await pg.exec(`create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, last_sign_in_at timestamptz);
    create table auth.sessions (id uuid, user_id uuid, updated_at timestamptz);`);
  socket = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await socket.start();
  db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`, max: 1 }),
  });
  globalThis.__grouhPrismaClient = db;
  for (const name of ["ADMIN", "INTERN", "STUDENT", "MENTOR"] as const) await db.role.create({ data: { name } });
  admin = (await person("ADMIN")).id;
  levelId = (await db.internshipLevel.create({ data: { name: "Beginner", rank: 1 } })).id;
  programId = (await db.internshipProgram.create({ data: { name: "Track", slug: "track", duration: "4 weeks", price: 0, acceptanceFee: 990, description: "", features: [], requirements: [], certificateEligibility: "" } })).id;
  cohortId = (
    await db.internshipCohort.create({
      data: { name: "C", slug: "c", programId, levelId, startDate: new Date("2026-11-02"), endDate: new Date("2026-11-30") },
    })
  ).id;
});

after(async () => {
  await db?.$disconnect();
  await socket?.stop();
  await pg?.close();
});

test("an unpaid learner goes completely, sign-in included", async () => {
  const who = await person();
  const app = await application(who.id);
  const friend = await person();
  await remove(who);
  assert.ok(gone.includes(who.id));
  assert.equal(await db.user.count({ where: { id: who.id } }), 0);
  assert.equal(await db.internshipApplication.count({ where: { id: app.id } }), 0);
  assert.equal(await db.internshipPayment.count({ where: { applicationId: app.id } }), 0);
  assert.equal(await db.assessmentAnswer.count(), 0);
  assert.equal(await db.user.count({ where: { email: { endsWith: "@deleted.invalid" } } }), 0);
  assert.equal(await db.user.count({ where: { id: friend.id } }), 1);
  const log = await db.auditLog.findFirstOrThrow({ where: { resourceId: who.id } });
  assert.equal(log.actorId, admin);
  assert.ok(!JSON.stringify(log).includes(who.email));
});

test("a paid learner's money stays, without their name, and they can start again", async () => {
  const who = await person();
  const app = await application(who.id, true);
  assert.equal((await deletionSummary(who.id, db)).paidAmount, 2200);
  await remove(who);
  const kept = await db.internshipApplication.findUniqueOrThrow({ where: { id: app.id }, include: { student: true, payment: true, attempts: true } });
  assert.equal(kept.payment?.amount, 2200);
  assert.equal(kept.payment?.status, "PAID");
  assert.equal(kept.status, "REMOVED");
  assert.equal(kept.cohortId, null);
  assert.equal(kept.attempts.length, 0);
  assert.match(kept.student.email, /@deleted\.invalid$/);
  assert.equal(await db.user.count({ where: { email: who.email } }), 0);
  await assert.rejects(deletionSummary(kept.studentId, db), /already be deleted/);

  await pg.query("delete from auth.users where id = $1", [who.id]);
  const fresh = randomUUID();
  await login(fresh, who.email);
  const again = await ensurePrismaUserWithRoles({ id: fresh, email: who.email });
  assert.equal(again.id, fresh);
  assert.equal(await db.internshipApplication.count({ where: { studentId: fresh } }), 0);
});

test("group work, meetings and the group itself stay with the teammates", async () => {
  const [who, mate] = [await person(), await person()];
  const group = await db.internshipGroup.create({
    data: {
      programId,
      cohortId,
      number: 1,
      leaderId: who.id,
      members: { create: [{ programId, userId: who.id }, { programId, userId: mate.id }] },
      meetings: { create: { createdById: who.id, scheduledAt: new Date() } },
    },
  });
  const task = await newTask("T");
  const work = await db.taskSubmission.create({
    data: {
      taskId: task.id,
      userId: who.id,
      groupId: group.id,
      content: "Ours",
      participants: { create: [{ userId: who.id }, { userId: mate.id }] },
    },
  });
  const solo = await newTask("S");
  const own = await db.taskSubmission.create({ data: { taskId: solo.id, userId: who.id, content: "Mine" } });
  await remove(who);
  const left = await db.internshipGroup.findUniqueOrThrow({ where: { id: group.id }, include: { members: true, meetings: true } });
  assert.equal(left.leaderId, mate.id);
  assert.deepEqual(left.members.map((m) => m.userId), [mate.id]);
  assert.equal(left.meetings[0]?.createdById, mate.id);
  assert.equal((await db.taskSubmission.findUniqueOrThrow({ where: { id: work.id } })).userId, mate.id);
  assert.equal(await db.taskSubmission.count({ where: { id: own.id } }), 0);
});

test("nothing is deleted when the sign-in can't be", async () => {
  const who = await person();
  await application(who.id, true);
  await assert.rejects(remove(who, async () => { throw new Error("down"); }), /down/);
  assert.equal(await db.user.count({ where: { id: who.id } }), 1);
  assert.equal(await db.internshipApplication.count({ where: { studentId: who.id } }), 1);
});

test("the wrong email, staff and certificate holders are refused", async () => {
  const who = await person();
  await assert.rejects(remove({ ...who, email: "other@example.com" }), /doesn't match/);
  const mentor = await person("MENTOR");
  await assert.rejects(remove(mentor), /staff account/);
  await db.internshipCertificate.create({ data: { userId: who.id, programId, title: "T", certificateNumber: randomUUID() } });
  await assert.rejects(remove(who), /certificate/);
  assert.equal(await db.user.count({ where: { id: { in: [who.id, mentor.id] } } }), 2);
});

test("signing in again after the old sign-in was deleted gives the account back", async () => {
  const who = await person("INTERN", { signIn: false });
  const app = await application(who.id, true);
  const fresh = randomUUID();
  await login(fresh, who.email.toUpperCase());
  const user = await ensurePrismaUserWithRoles({ id: fresh, email: who.email });
  assert.deepEqual(user, { id: fresh, roles: ["INTERN"] });
  assert.equal((await db.internshipApplication.findUniqueOrThrow({ where: { id: app.id } })).studentId, fresh);
  assert.equal(await db.user.count({ where: { id: who.id } }), 0);
});

test("an account is never handed to the wrong sign-in", async () => {
  const cases: [string, () => Promise<{ id: string; email: string }>, boolean][] = [
    ["staff", () => person("MENTOR", { signIn: false }), true],
    ["email not verified", () => person("INTERN", { signIn: false }), false],
    ["old sign-in still there", () => person(), true],
  ];
  for (const [name, make, confirmed] of cases) {
    const who = await make();
    const fresh = randomUUID();
    await login(fresh, who.email, { confirmed });
    await assert.rejects(ensurePrismaUserWithRoles({ id: fresh, email: who.email }), AccountConflictError, name);
    assert.equal(await db.user.count({ where: { id: who.id } }), 1, name);
  }
  const suspended = await person("INTERN", { signIn: false });
  await db.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
  const fresh = randomUUID();
  await login(fresh, suspended.email);
  await assert.rejects(ensurePrismaUserWithRoles({ id: fresh, email: suspended.email }), AccountConflictError);
});

test("a deleted person's open browser doesn't bring an account back", async () => {
  const id = randomUUID();
  await assert.rejects(ensurePrismaUserWithRoles({ id, email: "ghost@example.com" }), AccountConflictError);
  assert.equal(await db.user.count({ where: { id } }), 0);
});

test("the Accounts page lists learners only, by sign-in and activity", async () => {
  const missing = await person("INTERN", { signIn: false });
  const old = await person("STUDENT", { signIn: false });
  await login(old.id, old.email, { seen: new Date("2026-01-01") });
  const paidOld = await person("INTERN", { signIn: false });
  await login(paidOld.id, paidOld.email, { seen: new Date("2026-01-01") });
  await application(paidOld.id, true);
  const list = async (filter: "all" | "missing" | "dormant", q = "") => (await listLearnerAccounts(filter, q, db)).map((a) => a.id);
  assert.ok((await list("missing")).includes(missing.id));
  assert.ok(!(await list("missing")).includes(old.id));
  assert.ok((await list("dormant")).includes(old.id));
  assert.ok(!(await list("dormant")).includes(paidOld.id));
  assert.ok(!(await list("dormant")).includes(missing.id));
  const all = await list("all");
  assert.ok(!all.includes(admin));
  assert.equal((await listLearnerAccounts("all", "deleted-", db)).length, 0);
  assert.deepEqual(await list("all", old.email), [old.id]);
  assert.deepEqual(await list("all", "100%"), []);
});
