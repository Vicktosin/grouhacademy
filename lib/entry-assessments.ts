import { ENTRY_ASSESSMENTS, type EntryQuestion } from "@/data/entry-assessments";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Every published track and level needs an entry assessment with questions.
// This finds the ones that don't, creates them, and tells admins when an
// intern meets a missing one.

export const ENTRY_ASSESSMENT = {
  title: "Entrance Exam",
  description:
    "Select the correct answer for each multiple-choice question. There are no open-ended questions in this entrance exam.",
  passingScore: 70,
} as const;

/** The four options, with the right answer's place varied but always the same. */
export function assessmentOptions([, correct, ...wrong]: EntryQuestion, questionIndex: number) {
  const options = wrong.map((optionText) => ({ optionText, isCorrect: false }));
  options.splice((questionIndex * 3 + correct.length) % 4, 0, { optionText: correct, isCorrect: true });
  return options.map((option, order) => ({ ...option, order }));
}

export type AssessmentGap = { programId: string; track: string; levelId: string; level: string };

/**
 * Published tracks and levels with no assessment that has questions. A track
 * taught only in its own cohorts (Special Class) has just the entry level.
 */
export async function missingAssessments(db: PrismaClient = getPrisma()): Promise<AssessmentGap[]> {
  const [programs, levels, assessments] = await Promise.all([
    db.internshipProgram.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, excludeFromSelfPacedAndPools: true },
    }),
    db.internshipLevel.findMany({ orderBy: { rank: "asc" }, select: { id: true, name: true } }),
    db.internshipAssessment.findMany({
      where: { questions: { some: {} } },
      select: { programId: true, levelId: true },
    }),
  ]);
  const have = new Set(assessments.map((item) => `${item.programId}:${item.levelId}`));
  return programs.flatMap((program) =>
    (program.excludeFromSelfPacedAndPools ? levels.slice(0, 1) : levels)
      .filter((level) => !have.has(`${program.id}:${level.id}`))
      .map((level) => ({ programId: program.id, track: program.name, levelId: level.id, level: level.name })),
  );
}

/** Creates the missing assessments we have questions for. Safe to rerun. */
export async function createMissingAssessments(db: PrismaClient = getPrisma()) {
  const created: string[] = [];
  const stillMissing: string[] = [];
  for (const gap of await missingAssessments(db)) {
    const questions = ENTRY_ASSESSMENTS[gap.track]?.[gap.level];
    const label = `${gap.track}: ${gap.level}`;
    if (!questions) {
      stillMissing.push(label);
      continue;
    }
    await db.internshipAssessment.create({
      data: {
        programId: gap.programId,
        levelId: gap.levelId,
        ...ENTRY_ASSESSMENT,
        questions: {
          create: questions.map((question, order) => ({
            prompt: question[0],
            order,
            options: { create: assessmentOptions(question, order) },
          })),
        },
      },
    });
    created.push(label);
  }
  return { created, stillMissing };
}

const ALERT_TITLE = "Entry assessment missing";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tells admins once a day per track and level. Never fails the request. */
export async function alertMissingAssessment(track: string, level: string, db: PrismaClient = getPrisma()) {
  try {
    const message = `Someone tried to take the ${track} ${level} assessment, but there isn't one. Add it under Assessments.`;
    const recent = await db.notification.findFirst({
      where: { title: ALERT_TITLE, message, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      select: { id: true },
    });
    if (recent) return;
    const admins = await db.user.findMany({
      where: { roles: { some: { role: { name: "ADMIN" } } } },
      select: { id: true },
    });
    await db.notification.createMany({
      data: admins.map((admin) => ({ userId: admin.id, title: ALERT_TITLE, message, type: "WARNING" as const })),
    });
  } catch (error) {
    console.error("Unable to alert admins about a missing assessment:", error);
  }
}
