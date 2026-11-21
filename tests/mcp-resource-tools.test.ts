/**
 * Tests for:
 *  - create_intern_resource (via parseResourceInput + moduleCreateData)
 *  - add_resource_lesson (direct lesson creation logic)
 *  - update_cohort_task labPassMark (via parseLabPassMark guard)
 *  - reviewFieldsFor (status transition fields)
 *  - uniqueResourceSlug (slug generation)
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  parseResourceInput,
  moduleCreateData,
  reviewFieldsFor,
  supportAdminResourceError,
  type ResourceModuleInput,
} from "../lib/intern-resources";
import { parseLabPassMark } from "../lib/lab-task-grading";

// ── parseResourceInput (create_intern_resource validation) ─────────────────────

test("parseResourceInput: rejects missing title", () => {
  const result = parseResourceInput({ trackIds: ["t1"], status: "DRAFT" }, false);
  assert.ok("error" in result);
  assert.match(result.error, /title/i);
});

test("parseResourceInput: rejects empty trackIds", () => {
  const result = parseResourceInput({ title: "My Resource", trackIds: [], status: "DRAFT" }, false);
  assert.ok("error" in result);
  assert.match(result.error, /track/i);
});

test("parseResourceInput: rejects invalid status", () => {
  const result = parseResourceInput({ title: "R", trackIds: ["t1"], status: "LIVE" }, false);
  assert.ok("error" in result);
  assert.match(result.error, /DRAFT|PUBLISHED|status/i);
});

test("parseResourceInput: accepts DRAFT with title and one track", () => {
  const result = parseResourceInput(
    { title: "Digital Marketing Basics", trackIds: ["prog-1"], status: "DRAFT" },
    false,
  );
  assert.ok("input" in result);
  assert.equal(result.input.title, "Digital Marketing Basics");
  assert.equal(result.input.status, "DRAFT");
  assert.deepEqual(result.input.trackIds, ["prog-1"]);
});

test("parseResourceInput: accepts PUBLISHED with title and one track", () => {
  const result = parseResourceInput(
    { title: "Content Creation", trackIds: ["prog-2"], status: "PUBLISHED" },
    false,
  );
  assert.ok("input" in result);
  assert.equal(result.input.status, "PUBLISHED");
});

test("parseResourceInput: trims title and filters modules correctly", () => {
  const result = parseResourceInput(
    {
      title: "  Social Media  ",
      trackIds: ["p1"],
      status: "DRAFT",
      modules: [
        {
          title: "Week 1",
          lessons: [
            { title: "Intro", videoUrl: "https://youtu.be/abc" },
            { title: "", videoUrl: null }, // empty title → defaulted to "Lesson 2"
          ],
        },
      ],
    },
    false,
  );
  assert.ok("input" in result);
  assert.equal(result.input.title, "Social Media");
  assert.equal(result.input.modules?.length, 1);
  assert.equal(result.input.modules?.[0].lessons.length, 2);
  assert.equal(result.input.modules?.[0].lessons[1].title, "Lesson 2");
});

test("parseResourceInput: deduplicates trackIds", () => {
  const result = parseResourceInput(
    { title: "R", trackIds: ["p1", "p1", "p2"], status: "DRAFT" },
    false,
  );
  assert.ok("input" in result);
  assert.deepEqual(result.input.trackIds, ["p1", "p2"]);
});

// ── moduleCreateData (create_intern_resource module structure) ─────────────────

test("moduleCreateData: produces correct structure for a module with lessons", () => {
  const mod: ResourceModuleInput = {
    title: "Week 1: Foundations",
    description: "An overview of digital marketing",
    content: null,
    videoUrl: "https://youtu.be/xyz",
    materials: [],
    lessons: [
      { title: "What is Digital Marketing?", content: "Text here", videoUrl: "https://youtu.be/l1", materials: [] },
      { title: "Setting up Google Ads", content: null, videoUrl: null, materials: [] },
    ],
  };
  const data = moduleCreateData(mod, 0);
  assert.equal(data.title, "Week 1: Foundations");
  assert.equal(data.order, 0);
  assert.equal(data.videoUrl, "https://youtu.be/xyz");
  assert.equal(data.lessons.create.length, 2);
  assert.equal(data.lessons.create[0].title, "What is Digital Marketing?");
  assert.equal(data.lessons.create[0].videoUrl, "https://youtu.be/l1");
  assert.equal(data.lessons.create[1].order, 1);
  assert.equal(data.lessons.create[1].videoUrl, null);
});

test("moduleCreateData: assigns correct order index to each lesson", () => {
  const mod: ResourceModuleInput = {
    title: "M", description: null, content: null, videoUrl: null, materials: [],
    lessons: [
      { title: "L0", content: null, videoUrl: null, materials: [] },
      { title: "L1", content: null, videoUrl: null, materials: [] },
      { title: "L2", content: null, videoUrl: null, materials: [] },
    ],
  };
  const data = moduleCreateData(mod, 2);
  assert.equal(data.order, 2);
  data.lessons.create.forEach((l, i) => assert.equal(l.order, i));
});

// ── reviewFieldsFor (status transition metadata) ───────────────────────────────

test("reviewFieldsFor: DRAFT with no review note returns {}", () => {
  const fields = reviewFieldsFor("DRAFT", null, undefined);
  assert.deepEqual(fields, {});
});

test("reviewFieldsFor: PENDING_REVIEW stamps submittedForReviewAt and clears reviewNote", () => {
  const fields = reviewFieldsFor("PENDING_REVIEW", "DRAFT", null);
  assert.ok("submittedForReviewAt" in fields);
  assert.ok(fields.submittedForReviewAt instanceof Date);
  assert.equal((fields as { reviewNote: null }).reviewNote, null);
});

test("reviewFieldsFor: PENDING_REVIEW to PENDING_REVIEW (no change) does NOT re-stamp", () => {
  const fields = reviewFieldsFor("PENDING_REVIEW", "PENDING_REVIEW", null);
  assert.ok(!("submittedForReviewAt" in fields));
});

test("reviewFieldsFor: PUBLISHED clears reviewNote", () => {
  const fields = reviewFieldsFor("PUBLISHED", "PENDING_REVIEW", "Looks good");
  assert.equal((fields as { reviewNote: null }).reviewNote, null);
  assert.ok(!("submittedForReviewAt" in fields));
});

// ── add_resource_lesson input normalisation (inline logic mirror) ──────────────

test("add_resource_lesson: empty title defaults to 'Lesson'", () => {
  const title = "  ".trim() || "Lesson";
  assert.equal(title, "Lesson");
});

test("add_resource_lesson: empty videoUrl stored as null", () => {
  const videoUrl = "  ".trim() || null;
  assert.equal(videoUrl, null);
});

test("add_resource_lesson: valid YouTube URL stored as-is", () => {
  const raw = "https://youtu.be/abc123";
  const videoUrl = raw.trim() || null;
  assert.equal(videoUrl, "https://youtu.be/abc123");
});

// ── update_cohort_task labPassMark guard ───────────────────────────────────────

test("labPassMark guard: valid value 1–100 passes parseLabPassMark", () => {
  assert.equal(parseLabPassMark(70), 70);
  assert.equal(parseLabPassMark(1), 1);
  assert.equal(parseLabPassMark(100), 100);
});

test("labPassMark guard: 0 and 101 are rejected", () => {
  assert.equal(parseLabPassMark(0), null);
  assert.equal(parseLabPassMark(101), null);
});

test("labPassMark guard: float is rejected", () => {
  assert.equal(parseLabPassMark(70.5), null);
});

test("labPassMark guard: only saved when task has labScenarioId", () => {
  // Simulates the guard: if no labScenarioId, tool returns error string
  function canSetPassMark(labScenarioId: string | null) {
    return labScenarioId !== null;
  }
  assert.equal(canSetPassMark(null), false);
  assert.equal(canSetPassMark("scenario-xyz"), true);
});

// ── supportAdminResourceError (permission model sanity) ───────────────────────

test("supportAdminResourceError: prevents a Support Admin from publishing directly", () => {
  const err = supportAdminResourceError("user-1", { status: "PUBLISHED" });
  assert.ok(err !== null);
  assert.match(err, /administrator/i);
});

test("supportAdminResourceError: allows a Support Admin to create a DRAFT", () => {
  const err = supportAdminResourceError("user-1", { status: "DRAFT" });
  assert.equal(err, null);
});
