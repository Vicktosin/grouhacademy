import { getPrisma } from "@/lib/prisma";
import { scheduleToDate } from "@/lib/task-schedule";
import { resolveLevelId } from "@/lib/internship-levels";
import { REAL_USER } from "@/lib/real-user";

// Changing a cohort, for the admin cohorts page (app/api/admin/internship/
// cohorts) and admin scripts alike, so every change is validated the same way.

const DEFAULT_PASS_MARK = 70;

/** A whole-number percentage from 1 to 100, or null if invalid. */
export function parsePassMark(value: unknown) {
  if (value === undefined || value === null || value === "")
    return DEFAULT_PASS_MARK;
  const mark = Number(value);
  return Number.isInteger(mark) && mark >= 1 && mark <= 100 ? mark : null;
}

export function calculateStatus(startDate: Date, endDate: Date) {
  const now = new Date();
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "COMPLETED";
  return "ACTIVE";
}

export function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "cohort"
  );
}

/** Updates a cohort; moving its start date moves its tasks' windows with it. */
export async function updateCohort(body: Record<string, unknown>): Promise<{ error: string; status: number } | { cohort: { id: string; name: string } }> {
  const id = String(body.id ?? "").trim();
  const name = String(body.name ?? "").trim();
  const programId = String(body.programId ?? "").trim();
  const description = String(body.description ?? "").trim();
  const startDate = new Date(body.startDate as string);
  const endDate = new Date(body.endDate as string);
  const certificatePassMark = parsePassMark(body.certificatePassMark);

  if (certificatePassMark === null) {
    return { error: "The certificate pass mark must be a whole number from 1 to 100.", status: 400 };
  }

  if (
    !id ||
    !name ||
    !programId ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return { error: "Invalid cohort update data.", status: 400 };
  }

  if (startDate >= endDate) {
    return { error: "Cohort end date must be after the start date.", status: 400 };
  }

  const prisma = getPrisma();
  const cohort = await prisma.internshipCohort.findUnique({
    where: { id },
    include: {
      _count: {
        select: { applications: { where: { student: REAL_USER } }, groups: true },
      },
    },
  });
  if (!cohort) {
    return { error: "Cohort not found.", status: 404 };
  }

  // Leaving the level out of an update keeps the current one.
  const levelId =
    body.levelId === undefined
      ? cohort.levelId
      : await resolveLevelId(body.levelId);
  if (!levelId) {
    return { error: "Selected internship level was not found.", status: 400 };
  }

  // Interns and groups in a cohort belong to its track and level, so moving
  // the cohort would leave them attached to the wrong programme.
  if (
    (programId !== cohort.programId || levelId !== cohort.levelId) &&
    (cohort._count.applications > 0 || cohort._count.groups > 0)
  ) {
    return { error: "This cohort already has interns or groups, so its track and level can't be changed. Create a new cohort instead.", status: 409 };
  }

  // An admin's preview intern doesn't hold a cohort in place: moved to
  // another track or level, the cohort drops it.
  if (programId !== cohort.programId || levelId !== cohort.levelId) {
    await prisma.internshipApplication.updateMany({
      where: { cohortId: id, student: { isPreview: true } },
      data: { cohortId: null },
    });
  }

  const updated = await prisma.internshipCohort.update({
    where: { id },
    data: {
      name,
      programId,
      levelId,
      description: description || null,
      startDate,
      endDate,
      certificatePassMark,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      status: calculateStatus(startDate, endDate),
    },
  });

  // Task windows are relative to the start date, so moving it moves them.
  if (startDate.getTime() !== cohort.startDate.getTime()) {
    const tasks = await prisma.internshipTask.findMany({
      where: { cohortId: id },
    });
    await prisma.$transaction(
      tasks.map((task) =>
        prisma.internshipTask.update({
          where: { id: task.id },
          data: {
            opensAt: scheduleToDate(startDate, {
              week: task.opensWeek,
              day: task.opensDay,
              time: task.opensTime,
            }),
            dueDate: scheduleToDate(startDate, {
              week: task.dueWeek,
              day: task.dueDay,
              time: task.dueTime,
            }),
          },
        }),
      ),
    );
  }

  return { cohort: { id: updated.id, name: updated.name } };
}
