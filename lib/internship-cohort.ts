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

/**
 * The cohort an application belongs in, saving it if it changes.
 *
 * Someone already placed keeps their cohort as long as it belongs to their
 * track and level, however far it has run: interns must never be moved out
 * of the cohort their tasks and group are in because a newer cohort was
 * created. (On 10 October 2026 the admin Interns page, which calls this for
 * everyone, moved 73 interns into new cohorts that had no tasks.)
 *
 * `joining` is only for the moment an application is paid: then a cohort
 * that has already started gives way to the next one, so a new intern
 * starts at the beginning of a cohort, joining a running one only when no
 * other is coming.
 */
export async function assignApplicationCohort(
  db: CohortDb,
  application: {
    id: string;
    programId: string;
    levelId: string;
    cohortId: string | null;
  },
  { joining = false }: { joining?: boolean } = {},
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

  if (currentCohort && (!joining || (currentCohort.startDate && currentCohort.startDate > now)))
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
