import { getPrisma } from "@/lib/prisma";

export type PoolInfo = { id: string; cohortIds: string[] };

async function fetchPool(poolId: string): Promise<PoolInfo | null> {
  const pool = await getPrisma().internshipGroupPool.findUnique({
    where: { id: poolId },
    select: { id: true, cohorts: { select: { id: true } } },
  });
  if (!pool) return null;
  return { id: pool.id, cohortIds: pool.cohorts.map((c) => c.id) };
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
 * null if the cohort is excluded or fewer than 2 eligible cohorts exist.
 *
 * Safe to call multiple times: idempotent.
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
  if (cohort.poolId) return fetchPool(cohort.poolId);

  const eligible = await prisma.internshipCohort.findMany({
    where: {
      levelId: cohort.levelId,
      startDate: cohort.startDate,
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
