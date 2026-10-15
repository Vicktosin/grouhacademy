import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { cohortTimeline } from "@/lib/task-schedule";
import { listLevels, resolveLevelId } from "@/lib/internship-levels";
import { REAL_USER } from "@/lib/real-user";
import { calculateStatus, parsePassMark, slugify, updateCohort } from "@/lib/cohort-admin";

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

export async function GET() {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const prisma = getPrisma();
  const [programs, levels, cohorts] = await Promise.all([
    prisma.internshipProgram.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listLevels(),
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "asc" },
      include: {
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
    }),
  ]);

  return NextResponse.json({
    programs,
    levels,
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      slug: cohort.slug,
      description: cohort.description,
      programId: cohort.programId,
      programName: cohort.program.name,
      trackName: cohort.program.name,
      levelId: cohort.levelId,
      levelName: cohort.level.name,
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

  const levelId = await resolveLevelId(body.levelId);
  if (!levelId) {
    return NextResponse.json(
      { error: "Selected internship level was not found." },
      { status: 400 },
    );
  }

  const cohort = await prisma.internshipCohort.create({
    data: {
      programId,
      levelId,
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

  const result = await updateCohort(body);
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, cohort: result.cohort });
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
  // (Admins' preview interns' work doesn't count: it goes with the cohort.)
  const submissions = await prisma.taskSubmission.count({
    where: { task: { cohortId: id }, user: REAL_USER },
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
