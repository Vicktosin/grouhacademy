import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { CURRICULUM, TRACK_DESCRIPTIONS, curriculumKey, plainTitle, taskPart, trackSlug, type CurriculumTask } from "@/lib/curriculum";
import { createMissingAssessments } from "@/lib/entry-assessments";
import { DEFAULT_LAB_PASS_MARK } from "@/lib/lab-task-grading";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "@/lib/office-life/content";
import { getPrisma } from "@/lib/prisma";

// Puts the approved curriculum into the app: the tracks, level fees, entry
// assessments and Task Library. Safe to rerun: what's already there is left
// alone, including templates and fees an admin has changed.

/** The acceptance fee per level, in naira. Beginner is the track's own fee. */
export const LEVEL_FEES: Record<string, number> = {
  Beginner: 990,
  Novice: 2200,
  Intermediate: 5000,
  Advanced: 12000,
  Professional: 25000,
};

export function templateDescription(task: CurriculumTask) {
  return `${task.instructions}\n\nHow to submit: ${task.submit}`;
}

const MIN_ANSWER = 60;
const PLACEHOLDER_QUESTIONS = [
  "What is this week's topic, in your own words?",
  "Give one real example of it.",
  "How would you use it at work?",
];

/** A short written exercise, so a week with no lab of its own still has one. */
export function placeholderLab(week: number, topic: string) {
  const answers = PLACEHOLDER_QUESTIONS.map(
    (question, index) => `  <h2>${index + 1}. ${question}</h2>\n  <p id="answer${index + 1}"></p>`,
  ).join("\n\n");
  return {
    kind: "WEB" as const,
    title: `Week ${week}: ${topic}`.slice(0, 120),
    brief: [
      `Practise this week's topic: ${topic}`,
      "",
      "Answer the three questions in index.html. Type each answer between <p> and </p>.",
      `Write at least ${MIN_ANSWER} letters for each one, using your own words.`,
      "Then run the checks and submit.",
    ].join("\n"),
    starterFiles: { "index.html": `<main>\n${answers}\n</main>\n`, "styles.css": "", "script.js": "" },
    checks: PLACEHOLDER_QUESTIONS.map((_, index) => ({
      label: `Question ${index + 1} is answered`,
      code: `return (document.querySelector("#answer${index + 1}")?.textContent ?? "").trim().length >= ${MIN_ANSWER};`,
    })),
    config: { placeholder: true },
    published: true,
  };
}

export type ImportReport = {
  dryRun: boolean;
  tracksCreated: string[];
  feesAdded: string[];
  templatesCreated: number;
  templatesUpdated: number;
  templatesUnchanged: number;
  templatesArchived: number;
  labsLinked: number;
  placeholderLabs: string[];
  missingOfficeLife: string[];
  assessmentsCreated: string[];
  assessmentsMissing: string[];
};

/**
 * Runs the import. `overwrite` also resets templates already imported to the
 * curriculum's wording (admins' edits are kept without it). `dryRun` only
 * reports.
 */
export async function importCurriculum(
  { dryRun = true, overwrite = false }: { dryRun?: boolean; overwrite?: boolean } = {},
  db: PrismaClient = getPrisma(),
): Promise<ImportReport> {
  const report: ImportReport = {
    dryRun,
    tracksCreated: [],
    feesAdded: [],
    templatesCreated: 0,
    templatesUpdated: 0,
    templatesUnchanged: 0,
    templatesArchived: 0,
    labsLinked: 0,
    placeholderLabs: [],
    missingOfficeLife: [],
    assessmentsCreated: [],
    assessmentsMissing: [],
  };
  const levels = new Map(
    (await db.internshipLevel.findMany({ select: { id: true, name: true } })).map((level) => [level.name, level.id]),
  );
  for (const name of Object.keys(LEVEL_FEES))
    if (!levels.has(name)) throw new Error(`The ${name} level doesn't exist. Create it first.`);

  for (const { track, levels: trackLevels } of CURRICULUM) {
    const slug = trackSlug(track);
    let program = await db.internshipProgram.findFirst({
      where: { OR: [{ slug }, { name: track }] },
      select: { id: true, name: true },
    });
    if (!program) {
      report.tracksCreated.push(track);
      if (!dryRun)
        program = await db.internshipProgram.create({
          data: {
            slug,
            name: track,
            duration: "1 Month",
            price: 0,
            acceptanceFee: LEVEL_FEES.Beginner,
            description: TRACK_DESCRIPTIONS[track],
            features: [],
            requirements: [],
            certificateEligibility: "Yes",
            mentorAvailability: true,
            communityAvailability: true,
            status: "PUBLISHED",
          },
          select: { id: true, name: true },
        });
    }
    const programId = program?.id;

    const fees = new Set(
      programId
        ? (await db.internshipLevelFee.findMany({ where: { programId }, select: { levelId: true } })).map((fee) => fee.levelId)
        : [],
    );
    for (const [level, acceptanceFee] of Object.entries(LEVEL_FEES)) {
      const levelId = levels.get(level)!;
      if (level === "Beginner" || fees.has(levelId)) continue;
      report.feesAdded.push(`${track} ${level}: N${acceptanceFee.toLocaleString("en-NG")}`);
      if (!dryRun && programId) await db.internshipLevelFee.create({ data: { programId, levelId, acceptanceFee } });
    }

    for (const level of trackLevels) {
      const levelId = levels.get(level.name)!;
      const [templates, labs, office] = programId
        ? await Promise.all([
            db.internshipTaskTemplate.findMany({
              where: { programId, levelId },
              select: { id: true, curriculumKey: true, archived: true, kind: true, createdAt: true },
            }),
            db.labScenario.findMany({
              where: { programId, levelId, published: true },
              orderBy: { createdAt: "asc" },
              select: { id: true, title: true, config: true },
            }),
            db.officeLifeContent.findUnique({
              where: { programId_levelId: { programId, levelId } },
              select: { content: true },
            }),
          ])
        : [[], [], null];

      const plan = parseOfficeLifeContent(office?.content) ?? defaultOfficeLifeContent(track, level.name);
      for (const day of [1, 2, 3, 4])
        if (!plan.workdays.some((workday) => workday.day === day))
          report.missingOfficeLife.push(`${track} ${level.name}: Day ${day}`);

      const byKey = new Map(templates.flatMap((item) => (item.curriculumKey ? [[item.curriculumKey, item] as const] : [])));
      // The first import of a track and level replaces what was there before
      // (even if it was cut off and is being rerun). Templates admins add
      // after it are left alone.
      const firstImport = Math.min(...[...byKey.values()].map((item) => item.createdAt.getTime()));
      const old = templates.filter(
        (item) => !item.curriculumKey && !item.archived && item.kind === "INDIVIDUAL" && item.createdAt.getTime() < firstImport,
      );
      report.templatesArchived += old.length;
      const newLabs: Prisma.LabScenarioCreateManyInput[] = [];
      const newTemplates: Prisma.InternshipTaskTemplateCreateManyInput[] = [];

      for (const week of level.weeks) {
        const lab =
          labs.find((item) => weekOf(item.title) === week.week && !isPlaceholder(item.config)) ??
          labs.find((item) => weekOf(item.title) === week.week);
        let labId = lab?.id ?? null;
        if (lab && !isPlaceholder(lab.config)) report.labsLinked += 1;
        else report.placeholderLabs.push(`${track} ${level.name} Week ${week.week}: ${week.topic}`);

        for (const task of week.tasks) {
          const part = taskPart(task);
          const key = curriculumKey(track, level.name, week.week, part);
          const current = byKey.get(key);
          if (current && !overwrite) {
            report.templatesUnchanged += 1;
            continue;
          }
          if (current) report.templatesUpdated += 1;
          else report.templatesCreated += 1;
          if (dryRun || !programId) continue;
          if (part === "lab" && !labId) {
            labId = randomUUID();
            newLabs.push({ id: labId, programId, levelId, ...placeholderLab(week.week, week.topic) });
          }
          const data = {
            title: plainTitle(task),
            description: templateDescription(task),
            labScenarioId: part === "lab" ? labId : null,
            officeLifeDay: part === "office" ? week.officeLifeDay : null,
          };
          if (current) await db.internshipTaskTemplate.update({ where: { id: current.id }, data });
          else
            newTemplates.push({
              ...data,
              curriculumKey: key,
              programId,
              levelId,
              kind: "INDIVIDUAL",
              opensWeek: week.week,
              opensDay: 1,
              opensTime: "09:00",
              dueWeek: week.week,
              dueDay: 7,
              dueTime: "23:59",
              labPassMark: DEFAULT_LAB_PASS_MARK,
            });
        }
      }
      // Together, so a track and level is never left half done.
      if (!dryRun && (newTemplates.length || old.length))
        await db.$transaction([
          db.labScenario.createMany({ data: newLabs }),
          db.internshipTaskTemplate.createMany({ data: newTemplates, skipDuplicates: true }),
          db.internshipTaskTemplate.updateMany({ where: { id: { in: old.map((item) => item.id) } }, data: { archived: true } }),
        ]);
    }
  }

  if (!dryRun) {
    const assessments = await createMissingAssessments(db);
    report.assessmentsCreated = assessments.created;
    report.assessmentsMissing = assessments.stillMissing;
  }
  return report;
}

function weekOf(title: string) {
  return Number(/^Week (\d+)\b/.exec(title)?.[1] ?? 0);
}

function isPlaceholder(config: unknown) {
  return Boolean(config && typeof config === "object" && (config as { placeholder?: unknown }).placeholder === true);
}
