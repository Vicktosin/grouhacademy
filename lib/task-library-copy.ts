import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { scheduleOffset } from "@/lib/learning-mode-rules";

// Fills the Task Library (InternshipTaskTemplate, where self-paced interns'
// tasks come from) by copying one cohort's tasks for its track and level.
// Each task's real open and due dates become week/day/time offsets from the
// cohort's start (the stored week fields of older cohort tasks aren't
// reliable), so self-paced interns get the same order and spacing. Safe to
// repeat: a task whose title is already in the library for that track and
// level is skipped.

export async function copyCohortTasksToLibrary(cohortId: string, db: PrismaClient = getPrisma()) {
  const cohort = await db.internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, name: true, programId: true, levelId: true, startDate: true },
  });
  if (!cohort) return { ok: false as const, error: "Cohort not found." };

  const [tasks, existing] = await Promise.all([
    db.internshipTask.findMany({
      where: { cohortId },
      orderBy: [{ opensAt: "asc" }, { dueDate: "asc" }, { title: "asc" }],
      select: {
        title: true,
        description: true,
        kind: true,
        opensAt: true,
        dueDate: true,
        maxScore: true,
        labScenarioId: true,
        labPassMark: true,
        officeLifeDay: true,
      },
    }),
    db.internshipTaskTemplate.findMany({
      where: { programId: cohort.programId, levelId: cohort.levelId, archived: false },
      select: { title: true },
    }),
  ]);
  if (!tasks.length) return { ok: false as const, error: "This cohort has no tasks to copy." };

  const have = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  let created = 0;
  let skipped = 0;
  for (const task of tasks) {
    const key = task.title.trim().toLowerCase();
    if (have.has(key)) {
      skipped += 1;
      continue;
    }
    have.add(key);
    const opens = scheduleOffset(cohort.startDate, task.opensAt);
    const due = scheduleOffset(cohort.startDate, task.dueDate);
    await db.internshipTaskTemplate.create({
      data: {
        programId: cohort.programId,
        levelId: cohort.levelId,
        title: task.title,
        description: task.description,
        kind: task.kind,
        opensWeek: opens.week,
        opensDay: opens.day,
        opensTime: opens.time,
        dueWeek: due.week,
        dueDay: due.day,
        dueTime: due.time,
        maxScore: task.maxScore,
        labScenarioId: task.labScenarioId,
        labPassMark: task.labPassMark,
        officeLifeDay: task.officeLifeDay,
      },
    });
    created += 1;
  }
  return { ok: true as const, cohort: cohort.name, created, skipped };
}

/** What the admin page shows: cohorts to copy from, and the library by track/level. */
export async function taskLibrarySummary(db: PrismaClient = getPrisma()) {
  const [cohorts, templates] = await Promise.all([
    db.internshipCohort.findMany({
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      select: { id: true, name: true, startDate: true, _count: { select: { tasks: true } } },
      take: 200,
    }),
    db.internshipTaskTemplate.findMany({
      where: { archived: false },
      select: { kind: true, program: { select: { name: true } }, level: { select: { name: true } } },
    }),
  ]);
  const library = new Map<string, { program: string; level: string; templates: number; individual: number }>();
  for (const t of templates) {
    const program = t.program?.name ?? "Shared (all tracks)";
    const key = `${program}:${t.level.name}`;
    const row = library.get(key) ?? { program, level: t.level.name, templates: 0, individual: 0 };
    row.templates += 1;
    if (t.kind === "INDIVIDUAL") row.individual += 1;
    library.set(key, row);
  }
  return {
    cohorts: cohorts.map((c) => ({ id: c.id, name: c.name, tasks: c._count.tasks, startDate: c.startDate.toISOString() })),
    library: [...library.values()].sort((a, b) => a.program.localeCompare(b.program) || a.level.localeCompare(b.level)),
  };
}
