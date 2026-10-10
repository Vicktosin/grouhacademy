import assert from "node:assert/strict";
import test from "node:test";

import { addressingProblems } from "../lib/work-life/grade";
import { castFor, workdayWindow, workdaysFor, WORKDAYS, type Step } from "../lib/work-life/story";

const TRACKS = [
  "Digital Marketing",
  "Social Media Marketing",
  "AI for Content Creation",
  "AI Automation",
  "Front-End Development",
  "Back-End Engineering",
  "WordPress Development",
  "Special Class",
];

test("workday N opens on the Nth weekend (Saturday 00:00 Lagos) and is due by Sunday's end", () => {
  // A cohort starting Wednesday 8 October 2026 (Lagos).
  const start = new Date("2026-10-08T08:00:00+01:00");
  const first = workdayWindow(start, 1);
  assert.equal(first.opensAt.toISOString(), "2026-10-09T23:00:00.000Z"); // Sat 10 Oct, 00:00 Lagos
  assert.equal(first.dueAt.toISOString(), "2026-10-11T23:00:00.000Z"); // Mon 12 Oct, 00:00 Lagos
  assert.equal(workdayWindow(start, 3).opensAt.toISOString(), "2026-10-23T23:00:00.000Z"); // Sat 24 Oct
});

test("a cohort starting on a Saturday opens its first workday that day", () => {
  const start = new Date("2026-10-17T09:00:00+01:00");
  assert.equal(workdayWindow(start, 1).opensAt.toISOString(), "2026-10-16T23:00:00.000Z");
});

test("a cohort starting late on a Friday night (Lagos) still waits for Saturday", () => {
  // 23:30 Friday in Lagos is 22:30 UTC.
  const start = new Date("2026-10-16T22:30:00Z");
  assert.equal(workdayWindow(start, 1).opensAt.toISOString(), "2026-10-16T23:00:00.000Z");
});

for (const track of TRACKS) {
  test(`${track}: four complete workdays with the story's key steps`, () => {
    const days = workdaysFor(track, "Ada");
    assert.equal(days.length, WORKDAYS);
    const steps = days.flatMap((day) => day.steps);
    const ids = new Set(steps.map((step) => step.id));
    assert.equal(ids.size, steps.length, "step ids are unique");
    // Client discovery, the team disagreement, and the follow-up copying the CEO and manager.
    const followUp = steps.find((step) => step.id === "d2-followup") as Extract<Step, { kind: "email" }>;
    assert.deepEqual(followUp.to, ["client"]);
    assert.deepEqual([...followUp.cc].sort(), ["ceo", "manager"]);
    for (const step of steps) {
      if (step.kind === "meeting") {
        assert.ok(step.lines.some((line) => "you" in line), `${step.id} gives the intern a turn`);
        for (const line of step.lines)
          if (!("you" in line)) assert.ok(step.participants.includes(line.speaker), `${step.id}: ${line.speaker} is in the meeting`);
      }
      if (step.kind !== "inbox") assert.ok(step.rubric.length > 20, `${step.id} has a rubric`);
    }
    for (const day of days) assert.equal(day.steps.at(-1)?.kind, "report", `workday ${day.day} ends with a report`);
    const cast = castFor(track);
    assert.ok(cast.client.email.includes("@") && cast.manager.email.endsWith("@brightwave.ng"));
  });
}

test("email addressing: missing Cc and To are caught", () => {
  const step = workdaysFor("Digital Marketing", "Ada")
    .flatMap((day) => day.steps)
    .find((item) => item.id === "d2-followup") as Extract<Step, { kind: "email" }>;
  assert.deepEqual(addressingProblems(step, ["client"], ["manager", "ceo"]), []);
  assert.equal(addressingProblems(step, ["client"], ["manager"]).length, 1);
  // Sent to the manager instead of the client: the client is missing.
  assert.equal(addressingProblems(step, ["manager"], ["ceo"]).length, 1);
  assert.equal(addressingProblems(step, ["manager"], []).length, 2);
});
