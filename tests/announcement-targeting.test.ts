import assert from "node:assert/strict";
import test from "node:test";

import {
  isAnnouncementForViewer,
  parseAnnouncementInput,
  pendingPopups,
  type AnnouncementViewer,
  type TargetedAnnouncement,
} from "../lib/announcement-targeting";

const ADMIN = "admin-1";

function announcement(overrides: Partial<TargetedAnnouncement & { createdAt: Date }> = {}): TargetedAnnouncement & { createdAt: Date; title: string } {
  return {
    id: "a1",
    scope: "GLOBAL",
    authorId: ADMIN,
    programId: null,
    cohortIds: [],
    audience: "INTERNSHIP",
    showAsPopup: false,
    createdAt: new Date("2026-11-10T10:00:00Z"),
    title: "Hello",
    ...overrides,
  };
}

const inCohortA: AnnouncementViewer = { programIds: ["track-dm"], cohortIds: ["cohort-a"], activeMentorIds: [] };
const inCohortB: AnnouncementViewer = { programIds: ["track-dm"], cohortIds: ["cohort-b"], activeMentorIds: [] };
const otherTrack: AnnouncementViewer = { programIds: ["track-web"], cohortIds: ["cohort-c"], activeMentorIds: [] };
const student: AnnouncementViewer = { programIds: [], cohortIds: [], activeMentorIds: [] };

test("a cohort-targeted announcement reaches only interns in that cohort", () => {
  const a = announcement({ cohortIds: ["cohort-a"] });
  assert.equal(isAnnouncementForViewer(a, inCohortA, "internship"), true);
  assert.equal(isAnnouncementForViewer(a, inCohortB, "internship"), false, "same track, other cohort");
  assert.equal(isAnnouncementForViewer(a, otherTrack, "internship"), false);
  assert.equal(isAnnouncementForViewer(a, student, "courses"), false);
  assert.equal(isAnnouncementForViewer(a, student, null), false);
});

test("an announcement for several cohorts reaches each of them and no others", () => {
  const a = announcement({ cohortIds: ["cohort-a", "cohort-c"] });
  assert.equal(isAnnouncementForViewer(a, inCohortA, "internship"), true);
  assert.equal(isAnnouncementForViewer(a, otherTrack, "internship"), true);
  assert.equal(isAnnouncementForViewer(a, inCohortB, "internship"), false);
});

test("an intern who moved up keeps seeing announcements for any of their cohorts", () => {
  const both: AnnouncementViewer = { programIds: ["track-dm"], cohortIds: ["cohort-a", "cohort-b"], activeMentorIds: [] };
  assert.equal(isAnnouncementForViewer(announcement({ cohortIds: ["cohort-b"] }), both, "internship"), true);
});

test("a track announcement reaches only that track (it used to reach everyone)", () => {
  const a = announcement({ programId: "track-dm" });
  assert.equal(isAnnouncementForViewer(a, inCohortA, "internship"), true);
  assert.equal(isAnnouncementForViewer(a, inCohortB, "internship"), true);
  assert.equal(isAnnouncementForViewer(a, otherTrack, "internship"), false);
});

test("untargeted announcements still reach every intern; audience still splits the workspaces", () => {
  const all = announcement();
  assert.equal(isAnnouncementForViewer(all, inCohortA, "internship"), true);
  assert.equal(isAnnouncementForViewer(all, otherTrack, "internship"), true);
  assert.equal(isAnnouncementForViewer(all, student, "courses"), false, "internship-only");
  assert.equal(isAnnouncementForViewer(announcement({ audience: null }), student, "courses"), true, "both sides");
  assert.equal(isAnnouncementForViewer(announcement({ audience: "COURSES" }), inCohortA, "internship"), false);
});

test("mentor announcements reach only that mentor's interns", () => {
  const a = announcement({ scope: "MENTOR_MENTEES", authorId: "mentor-9" });
  assert.equal(isAnnouncementForViewer(a, inCohortA, "internship"), false);
  assert.equal(isAnnouncementForViewer(a, { ...inCohortA, activeMentorIds: ["mentor-9"] }, "internship"), true);
});

test("a pop-up is pending for a targeted intern until they press Got it, then never again", () => {
  const popup = announcement({ id: "p1", showAsPopup: true, cohortIds: ["cohort-a"] });
  const list = [popup];
  assert.deepEqual(pendingPopups(list, inCohortA, []).map((a) => a.id), ["p1"]);
  // Opening the app again without dismissing: still shown.
  assert.deepEqual(pendingPopups(list, inCohortA, []).map((a) => a.id), ["p1"]);
  // After "Got it" (a dismissal is recorded), it's gone for good.
  assert.deepEqual(pendingPopups(list, inCohortA, ["p1"]), []);
  assert.deepEqual(pendingPopups(list, inCohortA, new Set(["p1"])), []);
});

test("pop-ups go only to their targets, skip non-pop-ups, and come oldest first", () => {
  const older = announcement({ id: "old", showAsPopup: true, createdAt: new Date("2026-11-01T00:00:00Z") });
  const newer = announcement({ id: "new", showAsPopup: true, createdAt: new Date("2026-11-09T00:00:00Z") });
  const notPopup = announcement({ id: "plain" });
  const otherCohort = announcement({ id: "b-only", showAsPopup: true, cohortIds: ["cohort-b"] });
  assert.deepEqual(
    pendingPopups([newer, notPopup, otherCohort, older], inCohortA, []).map((a) => a.id),
    ["old", "new"],
  );
  // One intern's dismissal doesn't affect another intern.
  assert.deepEqual(pendingPopups([newer], inCohortB, []).map((a) => a.id), ["new"]);
});

test("announcement input: validates cohorts, pop-up and lengths", () => {
  const ok = parseAnnouncementInput(
    { title: " Graduation ", message: "Saturday 10am", cohortIds: ["c1", "c1", " c2 "], showAsPopup: true, audience: "INTERNSHIP" },
    { partial: false },
  );
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.title, "Graduation");
    assert.deepEqual(ok.value.cohortIds, ["c1", "c2"]);
    assert.equal(ok.value.showAsPopup, true);
  }
  assert.equal(parseAnnouncementInput({ title: "", message: "x" }, { partial: false }).ok, false);
  assert.equal(parseAnnouncementInput({ title: "x".repeat(161), message: "x" }, { partial: false }).ok, false);
  assert.equal(parseAnnouncementInput({ title: "t", message: "m", cohortIds: "c1" }, { partial: false }).ok, false);
  assert.equal(parseAnnouncementInput({ title: "t", message: "m", showAsPopup: "yes" }, { partial: false }).ok, false);
  assert.equal(
    parseAnnouncementInput({ title: "t", message: "m", cohortIds: ["c1"], audience: "COURSES" }, { partial: false }).ok,
    false,
    "cohort targets are for interns",
  );
  const partial = parseAnnouncementInput({ showAsPopup: false }, { partial: true });
  assert.ok(partial.ok);
  if (partial.ok) assert.deepEqual(partial.value, { showAsPopup: false });
});
