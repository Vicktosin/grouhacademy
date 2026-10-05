import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { cohortTimeline, scheduleToDate } from "@/lib/task-schedule";

const DEFAULT_PASS_MARK = 70;

/** A whole-number percentage from 1 to 100, or null if invalid. */
function parsePassMark(value: unknown) {
  if (value === undefined || value === null || value === "")
    return DEFAULT_PASS_MARK;
  const mark = Number(value);
  return Number.isInteger(mark) && mark >= 1 && mark <= 100 ? mark : null;
}

function calculateStatus(startDate: Date, endDate: Date) {
  const now = new Date();
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "COMPLETED";
  return "ACTIVE";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthName(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "cohort"
  );
}

export async function GET() {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const prisma = getPrisma();
  const [programs, cohorts] = await Promise.all([
    prisma.internshipProgram.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "asc" },
      include: {
        program: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    }),
  ]);

  return NextResponse.json({
    programs,
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      slug: cohort.slug,
      description: cohort.description,
      programId: cohort.programId,
      programName: cohort.program.name,
      trackName: cohort.program.name,
      startDate: cohort.startDate.toISOString(),
      endDate: cohort.endDate.toISOString(),
      status: calculateStatus(cohort.startDate, cohort.endDate),
      startDateLabel: formatDate(cohort.startDate),
      endDateLabel: formatDate(cohort.endDate),
      monthLabel: monthName(cohort.startDate),
      certificatePassMark: cohort.certificatePassMark,
      taskCount: cohort._count.tasks,
      timeline: cohortTimeline(cohort.startDate, cohort.endDate),
    })),
  });
}

export async function POST(request: Request) {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Cohort data is required." },
      { status: 400 },
    );
  }

  const name = String(body.name ?? "").trim();
  const programId = String(body.programId ?? "").trim();
  const description = String(body.description ?? "").trim();
  const certificatePassMark = parsePassMark(body.certificatePassMark);

  if (certificatePassMark === null) {
    return NextResponse.json(
      {
        error:
          "The certificate pass mark must be a whole number from 1 to 100.",
      },
      { status: 400 },
    );
  }

  if (!name || !programId) {
    return NextResponse.json(
      { error: "Cohort name and track are required." },
      { status: 400 },
    );
  }

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "Use valid cohort start and end dates." },
      { status: 400 },
    );
  }

  if (startDate >= endDate) {
    return NextResponse.json(
      { error: "Cohort end date must be after the start date." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const program = await prisma.internshipProgram.findUnique({
    where: { id: programId },
  });
  if (!program) {
    return NextResponse.json(
      { error: "Selected internship track was not found." },
      { status: 400 },
    );
  }

  const cohort = await prisma.internshipCohort.create({
    data: {
      programId,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      description: description || null,
      startDate,
      endDate,
      certificatePassMark,
      status: calculateStatus(startDate, endDate),
    },
  });

  return NextResponse.json({
    success: true,
    cohort: { id: cohort.id, name: cohort.name },
  });
}

export async function PUT(request: Request) {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Cohort update payload is required." },
      { status: 400 },
    );
  }

  const id = String(body.id ?? "").trim();
  const name = String(body.name ?? "").trim();
  const programId = String(body.programId ?? "").trim();
  const description = String(body.description ?? "").trim();
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  const certificatePassMark = parsePassMark(body.certificatePassMark);

  if (certificatePassMark === null) {
    return NextResponse.json(
      {
        error:
          "The certificate pass mark must be a whole number from 1 to 100.",
      },
      { status: 400 },
    );
  }

  if (
    !id ||
    !name ||
    !programId ||
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return NextResponse.json(
      { error: "Invalid cohort update data." },
      { status: 400 },
    );
  }

  if (startDate >= endDate) {
    return NextResponse.json(
      { error: "Cohort end date must be after the start date." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const cohort = await prisma.internshipCohort.findUnique({
    where: { id },
    include: { _count: { select: { applications: true, groups: true } } },
  });
  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
  }

  // Interns and groups in a cohort belong to its track, so moving the cohort
  // to another track would leave them attached to the wrong programme.
  if (
    programId !== cohort.programId &&
    (cohort._count.applications > 0 || cohort._count.groups > 0)
  ) {
    return NextResponse.json(
      {
        error:
          "This cohort already has interns or groups, so its track can't be changed. Create a new cohort for the other track instead.",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.internshipCohort.update({
    where: { id },
    data: {
      name,
      programId,
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

  return NextResponse.json({
    success: true,
    cohort: { id: updated.id, name: updated.name },
  });
}

export async function DELETE(request: Request) {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();

  if (!id) {
    return NextResponse.json(
      { error: "A cohort id is required." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const cohort = await prisma.internshipCohort.findUnique({ where: { id } });
  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found." }, { status: 404 });
  }

  // Deleting a cohort deletes its tasks, so keep interns' submitted work safe.
  const submissions = await prisma.taskSubmission.count({
    where: { task: { cohortId: id } },
  });
  if (submissions > 0) {
    return NextResponse.json(
      {
        error:
          "Interns have already submitted tasks in this cohort, so it can't be deleted.",
      },
      { status: 409 },
    );
  }

  await prisma.internshipCohort.delete({ where: { id } });

  return NextResponse.json({ success: true, deletedId: id });
}
