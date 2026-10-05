import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { recomputeCohortProgress } from "@/lib/internship-progress";
import {
  isValidSchedulePoint,
  scheduleToDate,
  taskWindowState,
  type SchedulePoint,
} from "@/lib/task-schedule";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10_000;

function point(body: Record<string, unknown>, prefix: "opens" | "due") {
  return {
    week: Number(body[`${prefix}Week`]),
    day: Number(body[`${prefix}Day`]),
    time: String(body[`${prefix}Time`] ?? ""),
  } satisfies SchedulePoint;
}

/** Validates a task payload against its cohort; returns an error message or the data. */
async function parseTask(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const cohortId = String(body.cohortId ?? "").trim();
  const description = String(body.description ?? "").trim();
  const kind = body.kind === "GROUP" ? "GROUP" : "INDIVIDUAL";
  const opens = point(body, "opens");
  const due = point(body, "due");

  if (!title || title.length > MAX_TITLE_LENGTH)
    return `Give the task a name (up to ${MAX_TITLE_LENGTH} characters).`;
  if (description.length > MAX_DESCRIPTION_LENGTH)
    return "The task brief is too long.";
  if (!cohortId) return "Choose the cohort this task is for.";
  if (!isValidSchedulePoint(opens) || !isValidSchedulePoint(due))
    return "Set a valid week, day (1–7) and time for when the task opens and when it is due.";

  const cohort = await getPrisma().internshipCohort.findUnique({
    where: { id: cohortId },
    select: { id: true, programId: true, startDate: true },
  });
  if (!cohort) return "The selected cohort was not found.";

  const opensAt = scheduleToDate(cohort.startDate, opens);
  const dueDate = scheduleToDate(cohort.startDate, due);
  if (dueDate <= opensAt) return "The due time must be after the opening time.";

  return {
    cohort,
    data: {
      title,
      description: description || null,
      kind,
      cohortId,
      opensWeek: opens.week,
      opensDay: opens.day,
      opensTime: opens.time,
      dueWeek: due.week,
      dueDay: due.day,
      dueTime: due.time,
      opensAt,
      dueDate,
    } as const,
  };
}

/** Tasks are filed under a "Week N" module of the cohort's track. */
async function weekModuleId(programId: string, week: number) {
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

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();
  const [cohorts, tasks] = await Promise.all([
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        program: { select: { id: true, name: true } },
      },
    }),
    prisma.internshipTask.findMany({
      orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
      include: {
        cohort: {
          select: { id: true, name: true, program: { select: { name: true } } },
        },
        submissions: { select: { status: true } },
      },
    }),
  ]);

  const now = new Date();
  return NextResponse.json({
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      programName: cohort.program.name,
      startDate: cohort.startDate.toISOString(),
      endDate: cohort.endDate.toISOString(),
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      kind: task.kind,
      cohortId: task.cohortId,
      cohortName: task.cohort.name,
      programName: task.cohort.program.name,
      opensWeek: task.opensWeek,
      opensDay: task.opensDay,
      opensTime: task.opensTime,
      dueWeek: task.dueWeek,
      dueDay: task.dueDay,
      dueTime: task.dueTime,
      opensAt: task.opensAt.toISOString(),
      dueDate: task.dueDate.toISOString(),
      window: taskWindowState(task.opensAt, task.dueDate, now),
      submissionCount: task.submissions.length,
      acceptedCount: task.submissions.filter((s) => s.status === "ACCEPTED")
        .length,
    })),
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: "Task details are required." },
      { status: 400 },
    );
  const parsed = await parseTask(body as Record<string, unknown>);
  if (typeof parsed === "string")
    return NextResponse.json({ error: parsed }, { status: 400 });

  const task = await getPrisma().internshipTask.create({
    data: {
      ...parsed.data,
      moduleId: await weekModuleId(
        parsed.cohort.programId,
        parsed.data.opensWeek,
      ),
    },
  });
  await recomputeCohortProgress(parsed.cohort.id);
  return NextResponse.json({ success: true, taskId: task.id }, { status: 201 });
}

export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  if (!body || typeof body !== "object" || !id)
    return NextResponse.json(
      { error: "A task id and details are required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const existing = await prisma.internshipTask.findUnique({
    where: { id },
    select: {
      cohortId: true,
      kind: true,
      _count: { select: { submissions: true } },
    },
  });
  if (!existing)
    return NextResponse.json({ error: "Task not found." }, { status: 404 });

  const parsed = await parseTask(body as Record<string, unknown>);
  if (typeof parsed === "string")
    return NextResponse.json({ error: parsed }, { status: 400 });

  // Submissions are tied to the cohort's interns and to how the task is
  // submitted, so neither can change once work has come in.
  if (existing._count.submissions > 0) {
    if (parsed.data.cohortId !== existing.cohortId)
      return NextResponse.json(
        {
          error:
            "Interns have already submitted this task, so its cohort can't be changed.",
        },
        { status: 409 },
      );
    if (parsed.data.kind !== existing.kind)
      return NextResponse.json(
        {
          error:
            "Interns have already submitted this task, so it can't be switched between individual and group.",
        },
        { status: 409 },
      );
  }

  await prisma.internshipTask.update({
    where: { id },
    data: {
      ...parsed.data,
      moduleId: await weekModuleId(
        parsed.cohort.programId,
        parsed.data.opensWeek,
      ),
    },
  });
  if (parsed.data.cohortId !== existing.cohortId) {
    await recomputeCohortProgress(existing.cohortId);
    await recomputeCohortProgress(parsed.data.cohortId);
  }
  return NextResponse.json({ success: true, taskId: id });
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  if (!taskId)
    return NextResponse.json(
      { error: "Task id is required." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const task = await prisma.internshipTask.findUnique({
    where: { id: taskId },
    select: { cohortId: true },
  });
  if (!task)
    return NextResponse.json({ error: "Task not found." }, { status: 404 });

  await prisma.internshipTask.delete({ where: { id: taskId } });
  await recomputeCohortProgress(task.cohortId);
  return NextResponse.json({ success: true });
}
