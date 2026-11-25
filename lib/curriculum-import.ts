import { randomUUID } from "node:crypto";
import { LAB_EXERCISES } from "@/data/lab-exercises";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { CURRICULUM, TRACK_DESCRIPTIONS, curriculumKey, plainTitle, taskPart, trackSlug, type CurriculumTask } from "@/lib/curriculum";
import { createMissingAssessments } from "@/lib/entry-assessments";
import { labRows } from "@/lib/lab-exercises";
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

export function templateDescription(task: CurriculumTask, outcome: string) {
  return `${task.instructions}\n\nBy the end of this week, you can ${outcome}.\n\nHow to submit: ${task.submit}`;
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
  labsCreated: string[];
  /** Weeks with no exercise yet: they have no Practice Lab task until one is made and the import is rerun. */
  missingLabs: string[];
  missingOfficeLife: string[];
  /** Tracks and levels with a saved Office Life plan (removed by resetOfficeLife). */
  savedOfficeLife: string[];
  assessmentsCreated: string[];
  assessmentsMissing: string[];
};

/**
 * Runs the import. `overwrite` also resets templates already imported to the
 * curriculum's wording (admins' edits are kept without it). `resetOfficeLife`
 * removes saved Office Life plans, so the built-in ones for each track and
 * level are used; workdays already started keep their own. `dryRun` only
 * reports.
 */
export async function importCurriculum(
  { dryRun = true, overwrite = false, resetOfficeLife = false }: { dryRun?: boolean; overwrite?: boolean; resetOfficeLife?: boolean } = {},
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
    labsCreated: [],
    missingLabs: [],
    missingOfficeLife: [],
    savedOfficeLife: [],
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
              select: { id: true, title: true },
            }),
            db.officeLifeContent.findUnique({
              where: { programId_levelId: { programId, levelId } },
              select: { content: true },
            }),
          ])
        : [[], [], null];

      if (office) {
        report.savedOfficeLife.push(`${track} ${level.name}`);
        if (resetOfficeLife && !dryRun && programId) await db.officeLifeContent.deleteMany({ where: { programId, levelId } });
      }
      const plan = parseOfficeLifeContent(resetOfficeLife ? null : office?.content) ?? defaultOfficeLifeContent(track, level.name);
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
        // The week's exercise: one that's there already, or a new one of ours.
        let lab: { id: string } | undefined = labs.find((item) => weekOf(item.title) === week.week);
        const exercise = LAB_EXERCISES.find((item) => item.track === track && item.level === level.name && item.week === week.week);
        if (lab) report.labsLinked += 1;
        else if (exercise) {
          report.labsCreated.push(`${track} ${level.name} Week ${week.week}: ${exercise.title}`);
          lab = { id: randomUUID() };
          if (programId) newLabs.push({ ...labRows(exercise), id: lab.id, programId, levelId });
        } else report.missingLabs.push(`${track} ${level.name} Week ${week.week}: ${week.topic}`);

        for (const task of week.tasks) {
          const part = taskPart(task);
          // Never a Practice Lab task with nothing real to do.
          if (part === "lab" && !lab) continue;
          const key = curriculumKey(track, level.name, week.week, part);
          const current = byKey.get(key);
          if (current && !overwrite) {
            report.templatesUnchanged += 1;
            continue;
          }
          if (current) report.templatesUpdated += 1;
          else report.templatesCreated += 1;
          if (dryRun || !programId) continue;
          const data = {
            title: plainTitle(task),
            description: templateDescription(task, week.outcome),
            labScenarioId: part === "lab" ? lab!.id : null,
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
      if (!dryRun && (newLabs.length || newTemplates.length || old.length))
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
