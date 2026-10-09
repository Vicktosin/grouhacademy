import { getPrisma } from "@/lib/prisma";

/**
 * Every cohort with its track and dates, newest first: what admin list
 * pages need for their track and cohort filter (components/admin/
 * CohortTrackFilter).
 */
export async function listCohortOptions() {
  const cohorts = await getPrisma().internshipCohort.findMany({
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, startDate: true, endDate: true, program: { select: { name: true } } },
  });
  return cohorts.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    programName: cohort.program.name,
    startDate: cohort.startDate.toISOString(),
    endDate: cohort.endDate.toISOString(),
  }));
}
