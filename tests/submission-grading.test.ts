import test from "node:test";
import assert from "node:assert/strict";

import { canGrade } from "../lib/submission-history";
import { creditedInterns, parseGrade } from "../lib/submission-grading";

const mentor = { role: "MENTOR" as const, userId: "mentor-1" };
const otherMentor = { role: "MENTOR" as const, userId: "mentor-2" };
const admin = { role: "ADMIN" as const, userId: "admin-1" };

test("anyone grading can grade work that's waiting", () => {
  for (const who of [mentor, otherMentor, admin])
    for (const status of ["SUBMITTED", "UNDER_REVIEW"] as const)
      assert.equal(canGrade(who, { status, reviewedById: null }), true);
});

test("mentors change only grades they gave; admins any grade", () => {
  for (const status of ["ACCEPTED", "REJECTED"] as const) {
    assert.equal(canGrade(mentor, { status, reviewedById: "mentor-1" }), true);
    assert.equal(canGrade(otherMentor, { status, reviewedById: "mentor-1" }), false);
    // Automatic or unrecorded grades: admins only.
    assert.equal(canGrade(mentor, { status, reviewedById: null }), false);
    assert.equal(canGrade(admin, { status, reviewedById: "mentor-1" }), true);
    assert.equal(canGrade(admin, { status, reviewedById: null }), true);
  }
});

test("drafts can't be graded", () => {
  assert.equal(canGrade(admin, { status: "DRAFT", reviewedById: null }), false);
});

test("grades: a decision, and feedback when asking for changes", () => {
  assert.deepEqual(parseGrade({ decision: "ACCEPTED", score: 8 }), { decision: "ACCEPTED", feedback: "", rawScore: 8 });
  assert.ok("error" in parseGrade({ decision: "MAYBE" }));
  assert.ok("error" in parseGrade({ decision: "REJECTED", feedback: "   " }));
  assert.deepEqual(parseGrade({ decision: "REJECTED", feedback: " Add tests " }), {
    decision: "REJECTED",
    feedback: "Add tests",
    rawScore: undefined,
  });
  assert.ok("error" in parseGrade({ decision: "ACCEPTED", feedback: "x".repeat(5001) }));
  assert.ok("error" in parseGrade(null));
});

test("group work counts for its participants; individual work for its author", () => {
  assert.deepEqual(creditedInterns({ userId: "a", groupId: null, participants: [] }), ["a"]);
  assert.deepEqual(creditedInterns({ userId: "a", groupId: "g", participants: [{ userId: "a" }, { userId: "b" }] }), ["a", "b"]);
});
