import { getPrisma } from "@/lib/prisma";
import { scheduleToDate } from "@/lib/task-schedule";

export type PoolInfo = {
  id: string;
  cohortIds: string[];
  levelId: string;
  startDate: Date;
};

async function fetchPool(poolId: string): Promise<PoolInfo | null> {
  const pool = await getPrisma().internshipGroupPool.findUnique({
    where: { id: poolId },
    select: {
      id: true,
      levelId: true,
      startDate: true,
      cohorts: { select: { id: true } },
    },
  });
  if (!pool) return null;
  return {
    id: pool.id,
    levelId: pool.levelId,
    startDate: pool.startDate,
    cohortIds: pool.cohorts.map((c) => c.id),
  };
}

/**
 * Returns the pool a cohort belongs to, or null.
 * Also null when the cohort's program is excluded from pools.
 */
export async function getPoolForCohort(cohortId: string): Promise<PoolInfo | null> {
  const cohort = await getPrisma().internshipCohort.findUnique({
    where: { id: cohortId },
    select: {
      poolId: true,
      program: { select: { excludeFromSelfPacedAndPools: true } },
    },
  });
  if (!cohort?.poolId || cohort.program.excludeFromSelfPacedAndPools) return null;
  return fetchPool(cohort.poolId);
}

/**
 * Finds or creates the pool for a cohort's level+startDate, then links all
 * eligible cohorts at that level+startDate to the pool. Returns the pool, or
 * null if the cohort is excluded, already started, or fewer than 2 eligible
 * cohorts exist.
 *
 * Safe to call multiple times: idempotent.
 * Never pools a cohort whose startDate has already passed: running/completed
 * cohorts keep their existing groups exactly as they are.
 */
export async function ensureCohortPool(cohortId: string): Promise<PoolInfo | null> {
  const prisma = getPrisma();
  const cohort = await prisma.internshipCohort.findUnique({
    where: { id: cohortId },
    select: {
      levelId: true,
      startDate: true,
      poolId: true,
      program: { select: { excludeFromSelfPacedAndPools: true } },
    },
  });
  if (!cohort || cohort.program.excludeFromSelfPacedAndPools) return null;

  // Don't retroactively pool cohorts that have already started.
  if (new Date() >= cohort.startDate) return null;

  if (cohort.poolId) return fetchPool(cohort.poolId);

  // Only future cohorts are eligible pool members (startDate matches and is
  // in the future; we already checked cohort.startDate > now above).
  const eligible = await prisma.internshipCohort.findMany({
    where: {
      levelId: cohort.levelId,
      startDate: { equals: cohort.startDate, gt: new Date() },
      program: { excludeFromSelfPacedAndPools: false },
    },
    select: { id: true },
  });
  if (eligible.length < 2) return null;

  const pool = await prisma.internshipGroupPool.upsert({
    where: {
      levelId_startDate: { levelId: cohort.levelId, startDate: cohort.startDate },
    },
    create: { levelId: cohort.levelId, startDate: cohort.startDate },
    update: {},
    select: { id: true },
  });

  await prisma.internshipCohort.updateMany({
    where: { id: { in: eligible.map((c) => c.id) } },
    data: { poolId: pool.id },
  });

  return fetchPool(pool.id);
}

/**
 * Finds the first eligible cohort in the pool to use as the "owner" for
 * creating Week-N modules. Pool tasks need a module that belongs to a program;
 * we pick an arbitrary one from the pool.
 */
async function poolPrimaryProgramId(poolId: string): Promise<string | null> {
  const cohort = await getPrisma().internshipCohort.findFirst({
    where: { poolId },
    select: { programId: true },
    orderBy: { createdAt: "asc" },
  });
  return cohort?.programId ?? null;
}

async function weekModuleId(programId: string, week: number): Promise<string> {
  const prisma = getPrisma();
  const title = `Week ${week}`;
  const existing = await prisma.internshipModule.findFirst({
    where: { programId, title },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.internshipModule.create({
    data: { programId, title, order: week },
    select: { id: true },
  });
  return created.id;
}

/**
 * Idempotently creates pool GROUP tasks from isShared=true templates.
 * Exactly one task row is created per template per pool — shared by all
 * tracks in the pool, never duplicated per cohort.
 *
 * Returns the number of new tasks created.
 */
export async function materialisePoolGroupTasks(pool: PoolInfo): Promise<number> {
  const prisma = getPrisma();

  const primaryProgramId = await poolPrimaryProgramId(pool.id);
  if (!primaryProgramId) return 0;

  const [templates, existing] = await Promise.all([
    prisma.internshipTaskTemplate.findMany({
      where: { levelId: pool.levelId, kind: "GROUP", isShared: true, archived: false },
      orderBy: [{ opensWeek: "asc" }, { opensDay: "asc" }],
    }),
    prisma.internshipTask.findMany({
      where: { poolId: pool.id },
      select: { templateId: true },
    }),
  ]);

  const existingTemplateIds = new Set(
    existing.map((t) => t.templateId).filter((id): id is string => id !== null),
  );
  const toCreate = templates.filter((t) => !existingTemplateIds.has(t.id));
  if (toCreate.length === 0) return 0;

  for (const template of toCreate) {
    const moduleId = await weekModuleId(primaryProgramId, template.opensWeek);
    const opensAt = scheduleToDate(pool.startDate, {
      week: template.opensWeek,
      day: template.opensDay,
      time: template.opensTime,
    });
    const dueDate = scheduleToDate(pool.startDate, {
      week: template.dueWeek,
      day: template.dueDay,
      time: template.dueTime,
    });
    await prisma.internshipTask.create({
      data: {
        title: template.title,
        description: template.description,
        kind: "GROUP",
        moduleId,
        cohortId: null,
        applicationId: null,
        poolId: pool.id,
        templateId: template.id,
        opensWeek: template.opensWeek,
        opensDay: template.opensDay,
        opensTime: template.opensTime,
        dueWeek: template.dueWeek,
        dueDay: template.dueDay,
        dueTime: template.dueTime,
        opensAt,
        dueDate,
        maxScore: template.maxScore,
        labScenarioId: template.labScenarioId,
        labPassMark: template.labPassMark,
        officeLifeDay: template.officeLifeDay,
      },
    });
  }
  return toCreate.length;
}
