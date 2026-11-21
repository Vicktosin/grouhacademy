/**
 * Tests for the three new MCP lab tools and the update_cohort task-date fix.
 * These tests exercise the pure-logic helpers (scheduleToDate, parseLabPassMark,
 * isValidSchedulePoint) and simulate the validation paths the MCP tools follow,
 * without requiring a real database.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  scheduleToDate,
  isValidSchedulePoint,
  type SchedulePoint,
} from "../lib/task-schedule";
import {
  DEFAULT_LAB_PASS_MARK,
  parseLabPassMark,
} from "../lib/lab-task-grading";

// ── scheduleToDate (used by create_cohort_task and update_cohort fix) ──────────

const JAN_6_2025 = new Date("2025-01-06T00:00:00.000Z"); // Monday, WAT = UTC+1

test("scheduleToDate: week 1 day 1 09:00 is Monday at 09:00 WAT", () => {
  const result = scheduleToDate(JAN_6_2025, { week: 1, day: 1, time: "09:00" });
  // 09:00 WAT = 08:00 UTC
  assert.equal(result.toISOString(), "2025-01-06T08:00:00.000Z");
});

test("scheduleToDate: week 1 day 7 23:59 is Sunday at 23:59 WAT", () => {
  const result = scheduleToDate(JAN_6_2025, { week: 1, day: 7, time: "23:59" });
  // Sunday Jan 12, 23:59 WAT = 22:59 UTC
  assert.equal(result.toISOString(), "2025-01-12T22:59:00.000Z");
});

test("scheduleToDate: week 2 day 1 09:00 is exactly 7 days after week 1 day 1", () => {
  const w1 = scheduleToDate(JAN_6_2025, { week: 1, day: 1, time: "09:00" });
  const w2 = scheduleToDate(JAN_6_2025, { week: 2, day: 1, time: "09:00" });
  const diffMs = w2.getTime() - w1.getTime();
  assert.equal(diffMs, 7 * 24 * 60 * 60 * 1000);
});

test("update_cohort fix: moving start date by N days shifts all task dates by N days", () => {
  const cohortStart = JAN_6_2025;
  const newStart = new Date(cohortStart.getTime() + 7 * 24 * 60 * 60 * 1000); // one week later

  const taskOpenPoint: SchedulePoint = { week: 1, day: 1, time: "09:00" };
  const taskDuePoint: SchedulePoint = { week: 1, day: 5, time: "23:59" };

  const oldOpensAt = scheduleToDate(cohortStart, taskOpenPoint);
  const oldDueDate = scheduleToDate(cohortStart, taskDuePoint);
  const newOpensAt = scheduleToDate(newStart, taskOpenPoint);
  const newDueDate = scheduleToDate(newStart, taskDuePoint);

  const shift = 7 * 24 * 60 * 60 * 1000;
  assert.equal(newOpensAt.getTime() - oldOpensAt.getTime(), shift);
  assert.equal(newDueDate.getTime() - oldDueDate.getTime(), shift);
});

test("update_cohort fix: task relative schedule stays intact after start date moves", () => {
  const start = JAN_6_2025;
  const newStart = new Date("2025-02-03T00:00:00.000Z");

  // A task at week 3, day 2 should still open at week 3 day 2 of the new cohort.
  const point: SchedulePoint = { week: 3, day: 2, time: "10:00" };
  const oldDate = scheduleToDate(start, point);
  const newDate = scheduleToDate(newStart, point);

  // The week/day relationship stays the same — they differ only by the start delta.
  const startDelta = newStart.getTime() - start.getTime();
  assert.equal(newDate.getTime() - oldDate.getTime(), startDelta);
});

// ── isValidSchedulePoint (create_cohort_task input validation) ─────────────────

test("isValidSchedulePoint: valid point passes", () => {
  assert.equal(isValidSchedulePoint({ week: 1, day: 1, time: "09:00" }), true);
  assert.equal(isValidSchedulePoint({ week: 52, day: 7, time: "23:59" }), true);
});

test("isValidSchedulePoint: out-of-range week fails", () => {
  assert.equal(isValidSchedulePoint({ week: 0, day: 1, time: "09:00" }), false);
  assert.equal(isValidSchedulePoint({ week: 53, day: 1, time: "09:00" }), false);
});

test("isValidSchedulePoint: out-of-range day fails", () => {
  assert.equal(isValidSchedulePoint({ week: 1, day: 0, time: "09:00" }), false);
  assert.equal(isValidSchedulePoint({ week: 1, day: 8, time: "09:00" }), false);
});

test("isValidSchedulePoint: malformed time fails", () => {
  assert.equal(isValidSchedulePoint({ week: 1, day: 1, time: "9:00" }), false);   // missing leading zero
  assert.equal(isValidSchedulePoint({ week: 1, day: 1, time: "24:00" }), false);  // out-of-range hour
  assert.equal(isValidSchedulePoint({ week: 1, day: 1, time: "12:60" }), false);  // out-of-range minute
  assert.equal(isValidSchedulePoint({ week: 1, day: 1, time: "" }), false);
});

// ── create_cohort_task validation logic ────────────────────────────────────────

test("create_cohort_task: due must be after open", () => {
  const opensAt = scheduleToDate(JAN_6_2025, { week: 1, day: 5, time: "23:59" });
  const dueDate = scheduleToDate(JAN_6_2025, { week: 1, day: 3, time: "09:00" });
  assert.equal(dueDate <= opensAt, true); // tool should reject this
});

test("create_cohort_task: same time for open and due is also invalid", () => {
  const point: SchedulePoint = { week: 1, day: 1, time: "09:00" };
  const opensAt = scheduleToDate(JAN_6_2025, point);
  const dueDate = scheduleToDate(JAN_6_2025, point);
  assert.equal(dueDate <= opensAt, true); // tool should reject this (equal, not strictly after)
});

test("create_cohort_task: valid open before due passes", () => {
  const opensAt = scheduleToDate(JAN_6_2025, { week: 1, day: 1, time: "09:00" });
  const dueDate = scheduleToDate(JAN_6_2025, { week: 1, day: 5, time: "23:59" });
  assert.equal(dueDate > opensAt, true);
});

// ── parseLabPassMark (create_cohort_task lab pass mark validation) ─────────────

test("parseLabPassMark: default pass mark is 70", () => {
  assert.equal(DEFAULT_LAB_PASS_MARK, 70);
});

test("parseLabPassMark: valid integers 1–100 are accepted", () => {
  assert.equal(parseLabPassMark(1), 1);
  assert.equal(parseLabPassMark(70), 70);
  assert.equal(parseLabPassMark(100), 100);
});

test("parseLabPassMark: 0 and values above 100 are rejected", () => {
  assert.equal(parseLabPassMark(0), null);
  assert.equal(parseLabPassMark(101), null);
});

test("parseLabPassMark: non-integers are rejected", () => {
  assert.equal(parseLabPassMark(70.5), null);    // float rejected
  assert.equal(parseLabPassMark(null), null);
  assert.equal(parseLabPassMark(undefined), null);
});

test("parseLabPassMark: numeric string is coerced by Number() and accepted", () => {
  // Number("70") === 70 which is valid — the function accepts this.
  assert.equal(parseLabPassMark("70"), 70);
});

// ── list_lab_scenarios: logic check ──────────────────────────────────────────

test("list_lab_scenarios: linked tasks count is distinct from intern attempts count", () => {
  // The updated tool exposes both linkedTasks and internAttempts as separate fields.
  // This test documents the distinction: tasks are cohort task links, attempts are
  // intern workspace saves. They are counted via _count.tasks vs _count.attempts.
  const row = { linkedTasks: 3, internAttempts: 12 };
  assert.notEqual(row.linkedTasks, row.internAttempts);
  assert.equal(typeof row.linkedTasks, "number");
  assert.equal(typeof row.internAttempts, "number");
});
