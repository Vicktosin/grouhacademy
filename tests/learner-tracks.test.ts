import assert from "node:assert/strict";
import test from "node:test";

import { requestedPathForTrack } from "../lib/learner-tracks";

test("an internship login returns to the internship page asked for", () => {
  assert.equal(requestedPathForTrack("internship", "/internship/dashboard"), "/internship/dashboard");
  assert.equal(requestedPathForTrack("internship", "/internship/dashboard/tasks?week=2"), "/internship/dashboard/tasks?week=2");
  assert.equal(requestedPathForTrack("internship", "/internship/onboarding"), "/internship/onboarding");
});

test("a courses login only returns to courses pages", () => {
  assert.equal(requestedPathForTrack("courses", "/student/courses"), "/student/courses");
  assert.equal(requestedPathForTrack("courses", "/internship/dashboard"), null);
});

test("unsafe or missing destinations fall back to the side's home", () => {
  assert.equal(requestedPathForTrack("internship", "//evil.example"), null);
  assert.equal(requestedPathForTrack("internship", "https://evil.example/x"), null);
  assert.equal(requestedPathForTrack("internship", null), null);
});
