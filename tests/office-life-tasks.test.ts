import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OfficeLifeTaskStatus from "../components/office-life/OfficeLifeTaskStatus";
import type { InternshipTaskItem } from "../lib/internship-data";
import {
  isOfficeLifeAutoDecision,
  officeLifeAcceptedFeedback,
  officeLifeSubmissionText,
  officeLifeTaskInfo,
  planOfficeLifeSubmissions,
} from "../lib/office-life/tasks";
import { canGrade } from "../lib/submission-history";
import { MAX_SUBMISSION_LENGTH } from "../lib/task-submission";

const finished = { userId: "intern-1", programId: "track", levelId: "level", day: 2 };
const linked = (id: string, extra: Partial<Parameters<typeof planOfficeLifeSubmissions>[0]["tasks"][number]> = {}) => ({
  id,
  cohortId: "cohort-a",
  kind: "INDIVIDUAL" as const,
  officeLifeDay: 2,
  programId: "track",
  levelId: "level",
  ...extra,
});
const enrolments = [{ userId: "intern-1", cohortId: "cohort-a" }];

test("finishing a linked workday plans exactly one submission per linked task", () => {
  const plan = planOfficeLifeSubmissions({
    days: [finished],
    tasks: [linked("task-1"), linked("task-2"), linked("task-3", { officeLifeDay: 3 })],
    enrolments,
    existing: [],
  });
  assert.deepEqual(plan.map((item) => item.task.id), ["task-1", "task-2"]);
});

test("running again creates nothing more: a task already submitted is skipped", () => {
  const plan = planOfficeLifeSubmissions({
    // The same finished workday seen twice (the finish event run twice).
    days: [finished, finished],
    tasks: [linked("task-1")],
    enrolments,
    existing: [],
  });
  assert.equal(plan.length, 1);
  const again = planOfficeLifeSubmissions({
    days: [finished],
    tasks: [linked("task-1")],
    enrolments,
    existing: [{ taskId: "task-1", userId: "intern-1" }],
  });
  assert.equal(again.length, 0);
});

test("a workday that isn't finished submits nothing", () => {
  // Only finished workdays (completedAt set) are passed in; an unfinished one isn't.
  assert.equal(planOfficeLifeSubmissions({ days: [], tasks: [linked("task-1")], enrolments, existing: [] }).length, 0);
});

test("tasks in other cohorts, tracks, levels, or group tasks are not affected", () => {
  const plan = planOfficeLifeSubmissions({
    days: [finished],
    tasks: [
      linked("other-cohort", { cohortId: "cohort-b" }),
      linked("other-track", { programId: "track-2" }),
      linked("other-level", { levelId: "level-2" }),
      linked("group", { kind: "GROUP" }),
      linked("not-linked", { officeLifeDay: null }),
    ],
    enrolments,
    existing: [],
  });
  assert.equal(plan.length, 0);
});

const state = {
  workday: {
    day: 2,
    title: "Client launch day",
    summary: "",
    opensWeek: 2,
    opensDay: 6,
    opensTime: "00:00",
    dueWeek: 2,
    dueDay: 7,
    dueTime: "23:59",
    steps: [
      { id: "s1", kind: "inbox" as const, title: "Morning email", from: "manager" as const, subject: "", body: "" },
      { id: "s2", kind: "report" as const, title: "Status report", task: "", fields: [], rubric: "" },
    ],
  },
  steps: {
    s1: { at: "2026-10-17T09:00:00Z" },
    s2: {
      at: "2026-10-17T10:00:00Z",
      feedback: { score: 82, strengths: ["Clear next steps"], improvements: ["Name the blocker"], reply: "", from: "manager" as const, source: "rules" as const },
    },
  },
};

test("the submission text gives the workday, finish time, day score and each step for the mentor", () => {
  const text = officeLifeSubmissionText({ day: 2, title: "Client launch day", completedAt: new Date("2026-10-17T10:00:00Z"), score: 82, state });
  assert.match(text, /Office Life workday 2: Client launch day/);
  assert.match(text, /Finished: .*Oct 17.*\(WAT\)/);
  assert.match(text, /Office Life score for the day: 82\/100/);
  assert.match(text, /1\. Morning email: read/);
  assert.match(text, /2\. Status report: 82\/100/);
  assert.match(text, /Did well: Clear next steps/);
  assert.match(text, /To improve: Name the blocker/);
});

test("the submission text always fits the 10,000 character limit", () => {
  const steps = Array.from({ length: 200 }, (_, i) => ({ id: `s${i}`, kind: "report" as const, title: `Step ${i} ${"x".repeat(100)}`, task: "", fields: [], rubric: "" }));
  const results = Object.fromEntries(
    steps.map((step) => [step.id, { at: "", feedback: { score: 50, strengths: ["y".repeat(500)], improvements: ["z".repeat(500)], reply: "", from: "manager" as const, source: "ai" as const } }]),
  );
  const text = officeLifeSubmissionText({ day: 1, title: "Long day", completedAt: new Date(), score: 50, state: { workday: { ...state.workday, steps }, steps: results } });
  assert.ok(text.length <= MAX_SUBMISSION_LENGTH);
});

test("the Office Life score is information only: the decision mentions the workday, not a grade", () => {
  const feedback = officeLifeAcceptedFeedback(2);
  assert.match(feedback, /Accepted automatically/);
  assert.match(feedback, /workday 2/);
  assert.doesNotMatch(feedback, /\d+\/100/);
});

test("a mentor can change an automatic Office Life decision; other automatic grades stay admin-only", () => {
  const mentor = { role: "MENTOR" as const, userId: "mentor-1" };
  const auto = { reviewedById: null, task: { officeLifeDay: 2 } };
  assert.equal(isOfficeLifeAutoDecision(auto), true);
  assert.equal(canGrade(mentor, { status: "ACCEPTED", reviewedById: null, officeLifeAuto: true }), true);
  // Once a mentor changes it, it's theirs, like any other grade.
  assert.equal(isOfficeLifeAutoDecision({ reviewedById: "mentor-1", task: { officeLifeDay: 2 } }), false);
  assert.equal(canGrade({ role: "MENTOR", userId: "mentor-2" }, { status: "REJECTED", reviewedById: "mentor-1", officeLifeAuto: false }), false);
  // Practice Lab and other automatic grades are unchanged: admins only.
  assert.equal(isOfficeLifeAutoDecision({ reviewedById: null, task: { officeLifeDay: null } }), false);
  assert.equal(canGrade(mentor, { status: "ACCEPTED", reviewedById: null }), false);
});

const workday = { day: 2, title: "Client launch day", opensAt: "2026-10-17T00:00:00Z", dueAt: "2026-10-18T23:00:00Z", stepsDone: 0, stepsTotal: 5, completedAt: null };
const during = new Date("2026-10-17T12:00:00Z");

test("the task shows the workday's status: not started, in progress, completed and submitted", () => {
  assert.equal(officeLifeTaskInfo(2, workday, false, during).statusLabel, "Not started");
  assert.equal(officeLifeTaskInfo(2, { ...workday, stepsDone: 3 }, false, during).statusLabel, "In progress (3 of 5 steps done)");
  const done = officeLifeTaskInfo(2, { ...workday, stepsDone: 5, completedAt: "2026-10-17T15:00:00Z" }, true, during);
  assert.equal(done.statusLabel, "Completed and submitted");
  assert.equal(done.state, "COMPLETED");
});

test("the task shows the workday's opening and due times, and whether it's open", () => {
  const info = officeLifeTaskInfo(2, workday, false, during);
  assert.equal(info.window, "OPEN");
  assert.match(info.opensLabel ?? "", /Oct 17/);
  assert.match(info.dueLabel ?? "", /Oct 19/);
  assert.equal(officeLifeTaskInfo(2, workday, false, new Date("2026-10-16T00:00:00Z")).window, "UPCOMING");
  assert.equal(officeLifeTaskInfo(2, workday, false, new Date("2026-10-20T00:00:00Z")).window, "OPEN"); // stays open after it is due
  // Not placed in a cohort yet: no times.
  assert.equal(officeLifeTaskInfo(2, { ...workday, opensAt: null, dueAt: null }, false, during).window, null);
});

function card(info: ReturnType<typeof officeLifeTaskInfo>, status: InternshipTaskItem["status"] = "Not submitted") {
  const task = { officeLife: info, status } as InternshipTaskItem;
  return renderToStaticMarkup(createElement(OfficeLifeTaskStatus, { task }));
}

test("the task card has a button to the workday and no text box", () => {
  const html = card(officeLifeTaskInfo(2, { ...workday, stepsDone: 2 }, false, during));
  assert.match(html, /href="\/internship\/dashboard\/office-life\?day=2"/);
  assert.match(html, /Open the workday in Office Life/);
  assert.match(html, /In progress \(2 of 5 steps done\)/);
  assert.match(html, /Workday opens: .*\(WAT\)/);
  assert.match(html, /Workday due: .*\(WAT\)/);
  assert.doesNotMatch(html, /<textarea|<form|<input/);
});

test("the task card says when the workday isn't open yet, stays open after it is due, or is done and accepted", () => {
  assert.match(card(officeLifeTaskInfo(2, workday, false, new Date("2026-10-16T00:00:00Z"))), /hasn(&#x27;|')t opened yet/);
  assert.match(card(officeLifeTaskInfo(2, workday, false, new Date("2026-10-20T00:00:00Z"))), /Open the workday in Office Life/);
  const done = officeLifeTaskInfo(2, { ...workday, stepsDone: 5, completedAt: "2026-10-17T15:00:00Z" }, true, during);
  const html = card(done, "Passed");
  assert.match(html, /Completed and submitted/);
  assert.match(html, /submitted and accepted automatically/);
});
