import assert from "node:assert/strict";
import test from "node:test";
import curriculum from "../data/curriculum.json";
import { ENTRY_ASSESSMENTS } from "../data/entry-assessments";
import type { PrismaClient } from "../generated/prisma/client";
import { alertMissingAssessment, assessmentOptions, createMissingAssessments, missingAssessments } from "../lib/entry-assessments";

const LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Professional"];

test("every track and level above the existing Beginner ones has four clean questions", () => {
  for (const { track } of curriculum.tracks) {
    const isNew = track === "Virtual Assistant" || track === "Cybersecurity";
    for (const level of isNew ? LEVELS : LEVELS.slice(1)) {
      const questions = ENTRY_ASSESSMENTS[track]?.[level];
      assert.equal(questions?.length, 4, `${track} ${level}`);
      questions.forEach((question, index) => {
        assert.equal(new Set(question.slice(1)).size, 4, question[0]);
        const options = assessmentOptions(question, index);
        assert.equal(options.length, 4);
        assert.deepEqual(options.filter((option) => option.isCorrect).map((option) => option.optionText), [question[1]]);
      });
    }
  }
});

test("the right answer isn't always in the same place", () => {
  const places = new Set<number>();
  for (const levels of Object.values(ENTRY_ASSESSMENTS))
    for (const questions of Object.values(levels))
      questions.forEach((question, index) => places.add(assessmentOptions(question, index).findIndex((option) => option.isCorrect)));
  assert.equal(places.size, 4);
});

function fakeDb() {
  const assessments: { programId: string; levelId: string }[] = [{ programId: "cyber", levelId: "Beginner" }];
  const notifications: { title: string; message: string }[] = [];
  const db = {
    internshipProgram: {
      findMany: async () => [
        { id: "cyber", name: "Cybersecurity", excludeFromSelfPacedAndPools: false },
        { id: "special", name: "Special Class", excludeFromSelfPacedAndPools: true },
      ],
    },
    internshipLevel: { findMany: async () => LEVELS.map((name) => ({ id: name, name })) },
    internshipAssessment: {
      findMany: async () => assessments,
      create: async ({ data }: { data: { programId: string; levelId: string } }) => assessments.push(data),
    },
    notification: {
      findFirst: async ({ where }: { where: { message: string } }) => notifications.find((n) => n.message === where.message) ?? null,
      createMany: async ({ data }: { data: { title: string; message: string }[] }) => notifications.push(...data),
    },
    user: { findMany: async () => [{ id: "admin" }] },
  };
  return { db: db as unknown as PrismaClient, notifications };
}

test("missing tracks and levels are listed, created once, and Special Class needs only its entry level", async () => {
  const { db } = fakeDb();
  const gaps = await missingAssessments(db);
  assert.deepEqual(gaps.map((gap) => `${gap.track} ${gap.level}`), [
    "Cybersecurity Novice",
    "Cybersecurity Intermediate",
    "Cybersecurity Advanced",
    "Cybersecurity Professional",
    "Special Class Beginner",
  ]);
  const first = await createMissingAssessments(db);
  assert.equal(first.created.length, 4);
  assert.deepEqual(first.stillMissing, ["Special Class: Beginner"]);
  assert.equal((await createMissingAssessments(db)).created.length, 0);
});

test("admins are told about a missing assessment once", async () => {
  const { db, notifications } = fakeDb();
  await alertMissingAssessment("Cybersecurity", "Novice", db);
  await alertMissingAssessment("Cybersecurity", "Novice", db);
  assert.equal(notifications.length, 1);
});
