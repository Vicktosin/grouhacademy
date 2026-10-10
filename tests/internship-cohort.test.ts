import assert from "node:assert/strict";
import test from "node:test";

import { assignApplicationCohort, type CohortDb } from "../lib/internship-cohort";

const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

type Cohort = { id: string; programId: string; levelId: string; startDate: Date; endDate: Date };

/** An in-memory stand-in for the two Prisma models the function uses. */
function fakeDb(cohorts: Cohort[]) {
  const saved: string[] = [];
  const matches = (cohort: Cohort, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      const field = cohort[key as keyof Cohort];
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const filter = value as { gt?: Date; lte?: Date };
        if (filter.gt && !(field > filter.gt)) return false;
        if (filter.lte && !(field <= filter.lte)) return false;
        return true;
      }
      return field === value;
    });
  const db: CohortDb = {
    internshipCohort: {
      async findFirst(args) {
        const { where, orderBy } = args as {
          where: Record<string, unknown>;
          orderBy?: { startDate: "asc" | "desc" };
        };
        const found = cohorts.filter((cohort) => matches(cohort, where));
        if (orderBy)
          found.sort((a, b) =>
            orderBy.startDate === "asc"
              ? a.startDate.getTime() - b.startDate.getTime()
              : b.startDate.getTime() - a.startDate.getTime(),
          );
        return found[0] ?? null;
      },
    },
    internshipApplication: {
      async update(args) {
        saved.push((args as { data: { cohortId: string } }).data.cohortId);
        return null;
      },
    },
  };
  return { db, saved };
}

const running: Cohort = { id: "october", programId: "dm", levelId: "entry", startDate: at(-2), endDate: at(20) };
const next: Cohort = { id: "cohort-22", programId: "dm", levelId: "entry", startDate: at(9), endDate: at(36) };
const application = (cohortId: string | null) => ({ id: "app", programId: "dm", levelId: "entry", cohortId });

test("an intern in a running cohort stays when a newer cohort is created", async () => {
  const { db, saved } = fakeDb([running, next]);
  assert.equal(await assignApplicationCohort(db, application("october")), "october");
  assert.deepEqual(saved, []);
});

test("an intern whose cohort has ended stays in it (finishing isn't moving)", async () => {
  const ended = { ...running, startDate: at(-40), endDate: at(-5) };
  const { db, saved } = fakeDb([ended, next]);
  assert.equal(await assignApplicationCohort(db, application("october")), "october");
  assert.deepEqual(saved, []);
});

test("an intern without a cohort is placed in the next one", async () => {
  const { db, saved } = fakeDb([running, next]);
  assert.equal(await assignApplicationCohort(db, application(null)), "cohort-22");
  assert.deepEqual(saved, ["cohort-22"]);
});

test("a cohort from another track or level is replaced", async () => {
  const other = { ...running, id: "wordpress", programId: "wp" };
  const { db } = fakeDb([other, running, next]);
  assert.equal(await assignApplicationCohort(db, application("wordpress")), "cohort-22");
});

test("someone paying now joins the next cohort rather than one already running", async () => {
  const { db, saved } = fakeDb([running, next]);
  assert.equal(await assignApplicationCohort(db, application("october"), { joining: true }), "cohort-22");
  assert.deepEqual(saved, ["cohort-22"]);
});

test("someone paying now joins the running cohort late when no other is coming", async () => {
  const { db } = fakeDb([running]);
  assert.equal(await assignApplicationCohort(db, application(null), { joining: true }), "october");
});

test("someone paying now keeps a cohort that hasn't started yet", async () => {
  const { db, saved } = fakeDb([running, next]);
  assert.equal(await assignApplicationCohort(db, application("cohort-22"), { joining: true }), "cohort-22");
  assert.deepEqual(saved, []);
});
