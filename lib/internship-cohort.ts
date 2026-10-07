export type CohortDb = {
  internshipCohort: {
    findFirst(
      args: Record<string, unknown>,
    ): Promise<{ id: string; startDate?: Date; endDate?: Date } | null>;
  };
  internshipApplication: {
    update(args: Record<string, unknown>): Promise<unknown>;
  };
};

export async function assignApplicationCohort(
  db: CohortDb,
  application: {
    id: string;
    programId: string;
    levelId: string;
    cohortId: string | null;
  },
) {
  const now = new Date();
  // Only keep the current cohort if it still belongs to this programme and
  // level; cohorts run separately for each level of a track.
  const currentCohort = application.cohortId
    ? await db.internshipCohort.findFirst({
        where: {
          id: application.cohortId,
          programId: application.programId,
          levelId: application.levelId,
        },
      })
    : null;

  if (currentCohort?.startDate && currentCohort.startDate > now)
    return currentCohort.id;

  // Prefer the next cohort that hasn't started. If there is none, someone
  // who pays after the start date joins the cohort that is running now
  // (late), rather than being left without a cohort and locked out.
  const cohort =
    (await db.internshipCohort.findFirst({
      where: {
        programId: application.programId,
        levelId: application.levelId,
        startDate: { gt: now },
      },
      orderBy: { startDate: "asc" },
    })) ??
    (currentCohort?.endDate && currentCohort.endDate > now
      ? currentCohort
      : await db.internshipCohort.findFirst({
          where: {
            programId: application.programId,
            levelId: application.levelId,
            startDate: { lte: now },
            endDate: { gt: now },
          },
          orderBy: { startDate: "desc" },
        }));

  if (!cohort || cohort.id === application.cohortId)
    return application.cohortId;

  await db.internshipApplication.update({
    where: { id: application.id },
    data: { cohortId: cohort.id },
  });

  return cohort.id;
}
