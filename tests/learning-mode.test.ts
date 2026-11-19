import assert from "node:assert/strict";
import test from "node:test";

import {
  automaticModeOnPayment,
  canSwitchToCohort,
  choiceOptions,
  cohortSystemEnabledFor,
  daysUntil,
  effectiveLearningMode,
  learningStatusLabel,
  scheduleOffset,
} from "../lib/learning-mode-rules";

const now = new Date("2026-11-19T10:00:00Z");
const next = { id: "c1", name: "Digital Marketing November Cohort – Level 1", startDate: new Date("2026-11-21T23:00:00Z") };

test("interns can choose when a cohort is coming up", () => {
  const options = choiceOptions({ policy: "CHOOSE", programExcluded: false, nextCohort: next, now });
  assert.equal(options.selfPaced.available, true);
  assert.equal(options.cohort.available, true);
  assert.equal(options.cohort.daysLeft, 3);
  assert.equal(options.cohort.waitlist, false);
  assert.equal(options.note, null);
});

test("only the valid option shows, with one plain sentence why", () => {
  const noCohort = choiceOptions({ policy: "CHOOSE", programExcluded: false, nextCohort: null, now });
  assert.deepEqual([noCohort.selfPaced.available, noCohort.cohort.available], [true, false]);
  assert.match(noCohort.note!, /no new cohort/);

  const excluded = choiceOptions({ policy: "CHOOSE", programExcluded: true, nextCohort: null, now });
  assert.deepEqual([excluded.selfPaced.available, excluded.cohort.available], [false, true]);
  assert.equal(excluded.cohort.waitlist, true, "no cohort yet: the waiting list");
  assert.match(excluded.note!, /only taught in cohorts/);

  const cohortOnly = choiceOptions({ policy: "COHORT_ONLY", programExcluded: false, nextCohort: next, now });
  assert.deepEqual([cohortOnly.selfPaced.available, cohortOnly.cohort.available], [false, true]);

  const selfOnly = choiceOptions({ policy: "SELF_PACED_ONLY", programExcluded: false, nextCohort: next, now });
  assert.deepEqual([selfOnly.selfPaced.available, selfOnly.cohort.available], [true, false]);

  // An always-cohort track stays cohort even when the platform is self-paced only.
  const excludedSelfOnly = choiceOptions({ policy: "SELF_PACED_ONLY", programExcluded: true, nextCohort: next, now });
  assert.deepEqual([excludedSelfOnly.selfPaced.available, excludedSelfOnly.cohort.available], [false, true]);
});

test("paying decides on its own only when one way is allowed", () => {
  assert.equal(automaticModeOnPayment("CHOOSE", false), null);
  assert.equal(automaticModeOnPayment("COHORT_ONLY", false), "COHORT");
  assert.equal(automaticModeOnPayment("SELF_PACED_ONLY", false), "SELF_PACED");
  assert.equal(automaticModeOnPayment("SELF_PACED_ONLY", true), "COHORT");
  assert.equal(cohortSystemEnabledFor("SELF_PACED_ONLY"), false);
  assert.equal(cohortSystemEnabledFor("CHOOSE"), true);
});

test("existing interns keep what they are; a cohort wins", () => {
  const base = { learningMode: null, cohortId: null, selfPacedStartDate: null };
  assert.equal(effectiveLearningMode(base), null);
  assert.equal(effectiveLearningMode({ ...base, cohortId: "c" }), "COHORT");
  assert.equal(effectiveLearningMode({ ...base, selfPacedStartDate: now }), "SELF_PACED");
  // Switched from self-paced: has a cohort now.
  assert.equal(effectiveLearningMode({ learningMode: "SELF_PACED", cohortId: "c", selfPacedStartDate: now }), "COHORT");
  assert.equal(learningStatusLabel({ ...base, learningMode: "COHORT" }), "Waiting");
  assert.equal(learningStatusLabel({ ...base, cohortId: "c" }), "Cohort");
  assert.equal(learningStatusLabel({ ...base, learningMode: "SELF_PACED" }), "Self-paced");
  assert.equal(learningStatusLabel(base), "Choosing");
});

test("a self-paced intern can join the next cohort once per level", () => {
  const selfPaced = { learningMode: "SELF_PACED" as const, cohortId: null, selfPacedStartDate: now, switchedToCohortAt: null };
  const options = { policy: "CHOOSE" as const, programExcluded: false, nextCohort: next };
  assert.equal(canSwitchToCohort(selfPaced, options), true);
  assert.equal(canSwitchToCohort({ ...selfPaced, switchedToCohortAt: now }, options), false, "only once");
  assert.equal(canSwitchToCohort(selfPaced, { ...options, nextCohort: null }), false, "needs a cohort");
  assert.equal(canSwitchToCohort(selfPaced, { ...options, policy: "SELF_PACED_ONLY" }), false);
  assert.equal(canSwitchToCohort({ ...selfPaced, learningMode: "COHORT", cohortId: "c" }, options), false);
});

test("days left counts whole days up", () => {
  assert.equal(daysUntil(new Date(now.getTime() + 60_000), now), 1);
  assert.equal(daysUntil(new Date(now.getTime() - 60_000), now), 0);
});

test("cohort task dates become week/day/time from the cohort start (WAT)", () => {
  // Cohort starts at 00:00 WAT (23:00 UTC the day before), as the October cohorts did.
  const start = new Date("2026-11-04T23:00:00Z");
  // Opens the evening before the start: week 1 day 1.
  assert.deepEqual(scheduleOffset(start, new Date("2026-11-04T22:00:00Z")), { week: 1, day: 1, time: "00:00" });
  // A week later, 23:00 WAT on day 7 of week 1.
  assert.deepEqual(scheduleOffset(start, new Date("2026-11-11T22:00:00Z")), { week: 1, day: 7, time: "23:00" });
  // Week 3 day 1, 09:30 WAT.
  assert.deepEqual(scheduleOffset(start, new Date("2026-11-19T08:30:00Z")), { week: 3, day: 1, time: "09:30" });
});
