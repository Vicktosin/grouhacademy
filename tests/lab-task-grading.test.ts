import test from "node:test";
import assert from "node:assert/strict";

import {
  gradeLabTask,
  parseLabPassMark,
  scoreCodeChecks,
} from "../lib/lab-task-grading";

test("passes at or above the pass mark and fails below it", () => {
  const pass = gradeLabTask({ percent: 70, passMark: 70, maxScore: 100, missed: [], missedLabel: "goals" });
  assert.equal(pass.status, "ACCEPTED");
  assert.equal(pass.score, 70);

  const fail = gradeLabTask({ percent: 69, passMark: 70, maxScore: 100, missed: ["Cost per sale"], missedLabel: "goals" });
  assert.equal(fail.status, "REJECTED");
  assert.match(fail.feedback, /pass mark is 70%/);
  assert.match(fail.feedback, /Goals not met:\n• Cost per sale/);
});

test("scales the score to the task's maximum", () => {
  assert.equal(gradeLabTask({ percent: 80, passMark: 50, maxScore: 20, missed: [], missedLabel: "checks" }).score, 16);
});

test("only the exercise's own checks count, and missing ones fail", () => {
  const checks = ["Has a heading", "Button works", "Form validates"];
  // A forged extra pass and a missing result don't help.
  const { percent, missed } = scoreCodeChecks(checks, [
    { label: "Has a heading", passed: true },
    { label: "Something made up", passed: true },
    { label: "Button works", passed: false },
  ]);
  assert.equal(percent, 33);
  assert.deepEqual(missed, ["Button works", "Form validates"]);
  // An exercise with no checks can't be passed from check results.
  assert.equal(scoreCodeChecks([], [{ label: "x", passed: true }]).percent, 0);
});

test("accepts only whole-number pass marks from 1 to 100", () => {
  assert.equal(parseLabPassMark(70), 70);
  assert.equal(parseLabPassMark("85"), 85);
  for (const bad of [0, 101, 70.5, "abc", null]) assert.equal(parseLabPassMark(bad), null);
});
