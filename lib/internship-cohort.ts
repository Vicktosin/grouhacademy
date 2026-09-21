export type CohortDb = {
  internshipCohort: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string; startDate?: Date; endDate?: Date } | null>
  }
  internshipApplication: {
    update(args: Record<string, unknown>): Promise<unknown>
  }
}

export async function assignApplicationCohort(
  db: CohortDb,
  application: { id: string; programId: string; cohortId: string | null },
) {
  const now = new Date()
  const currentCohort = application.cohortId
    ? await db.internshipCohort.findFirst({ where: { id: application.cohortId } })
    : null

  if (currentCohort?.startDate && currentCohort.startDate > now) return currentCohort.id

  const cohort = await db.internshipCohort.findFirst({
    where: {
      programId: application.programId,
      startDate: { gt: now },
    },
    orderBy: { startDate: 'asc' },
  })

  if (!cohort || cohort.id === application.cohortId) return application.cohortId

  await db.internshipApplication.update({
    where: { id: application.id },
    data: { cohortId: cohort.id },
  })

  return cohort.id
}
