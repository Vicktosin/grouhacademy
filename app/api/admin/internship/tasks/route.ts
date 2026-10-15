import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { recomputeCohortProgress } from "@/lib/internship-progress";
import { taskWindowState } from "@/lib/task-schedule";
import { REAL_USER } from "@/lib/real-user";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "@/lib/office-life/content";
import { createTask, updateTask } from "@/lib/task-admin";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();
  const [cohorts, tasks, labScenarios, officeLifePlans] = await Promise.all([
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
      },
    }),
    prisma.internshipTask.findMany({
      orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
      include: {
        cohort: {
          select: { id: true, name: true, program: { select: { name: true } } },
        },
        submissions: { where: { user: REAL_USER }, select: { status: true } },
      },
    }),
    prisma.labScenario.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        programId: true,
        published: true,
        level: { select: { name: true } },
      },
    }),
    prisma.officeLifeContent.findMany({ select: { programId: true, levelId: true, content: true } }),
  ]);

  const savedPlans = new Map(officeLifePlans.map((item) => [`${item.programId}:${item.levelId}`, parseOfficeLifeContent(item.content)]));
  const now = new Date();
  return NextResponse.json({
    labScenarios: labScenarios.map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      programId: scenario.programId,
      level: scenario.level.name,
      published: scenario.published,
    })),
    cohorts: cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      programId: cohort.program.id,
      programName: cohort.program.name,
      levelId: cohort.level.id,
      levelName: cohort.level.name,
      officeLifeWeeks: (savedPlans.get(`${cohort.program.id}:${cohort.level.id}`) ?? defaultOfficeLifeContent(cohort.program.name, cohort.level.name)).workdays.map(({ day, title }) => ({ day, title })),
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
      labScenarioId: task.labScenarioId,
      labPassMark: task.labPassMark,
      officeLifeDay: task.officeLifeDay,
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
  const result = await createTask(body as Record<string, unknown>);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, taskId: result.taskId }, { status: 201 });
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

  const result = await updateTask(id, body as Record<string, unknown>);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
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
