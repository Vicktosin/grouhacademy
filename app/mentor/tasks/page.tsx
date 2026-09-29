import { CheckCircle2, ClipboardList, Clock3 } from "lucide-react";
import { RoleName } from "@/generated/prisma/client";
import MentorTasksList from "@/components/MentorTasksList";
import { MentorPage } from "@/components/MentorPage";
import { getMentorInterns, submissionsForInterns } from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";
import { requireRouteAccess } from "@/lib/route-guards";

function formatDue(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MentorTasksPage() {
  const mentorId = await requireRouteAccess({
    requiredRoles: [RoleName.MENTOR],
  });
  const interns = await getMentorInterns(mentorId);
  const programIds = [...new Set(interns.map((intern) => intern.programId))];
  const internsPerProgram = new Map<string, number>();
  for (const intern of interns)
    internsPerProgram.set(
      intern.programId,
      (internsPerProgram.get(intern.programId) ?? 0) + 1,
    );

  const prisma = getPrisma();
  const [tasks, submissions] = await Promise.all([
    prisma.internshipTask.findMany({
      where: { module: { programId: { in: programIds } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        dueDate: true,
        module: {
          select: {
            title: true,
            programId: true,
            program: { select: { name: true } },
          },
        },
      },
    }),
    prisma.taskSubmission.groupBy({
      by: ["taskId", "status"],
      where: submissionsForInterns(interns),
      _count: { _all: true },
    }),
  ]);

  const countsByTask = new Map<
    string,
    { submitted: number; awaitingReview: number; accepted: number }
  >();
  for (const row of submissions) {
    const counts = countsByTask.get(row.taskId) ?? {
      submitted: 0,
      awaitingReview: 0,
      accepted: 0,
    };
    if (row.status !== "DRAFT") counts.submitted += row._count._all;
    if (row.status === "SUBMITTED" || row.status === "UNDER_REVIEW")
      counts.awaitingReview += row._count._all;
    if (row.status === "ACCEPTED") counts.accepted += row._count._all;
    countsByTask.set(row.taskId, counts);
  }

  const now = new Date();
  const rows = tasks.map((task) => {
    const counts = countsByTask.get(task.id) ?? {
      submitted: 0,
      awaitingReview: 0,
      accepted: 0,
    };
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.kind === "GROUP" ? ("Group" as const) : ("Individual" as const),
      programName: task.module.program.name,
      moduleTitle: task.module.title,
      dueLabel: task.dueDate ? formatDue(task.dueDate) : null,
      status:
        task.dueDate && task.dueDate < now
          ? ("Closed" as const)
          : ("Active" as const),
      assignedInterns: internsPerProgram.get(task.module.programId) ?? 0,
      ...counts,
    };
  });

  const activeTasks = rows.filter((row) => row.status === "Active").length;
  const awaitingReview = rows.reduce((sum, row) => sum + row.awaitingReview, 0);
  const expected = rows.reduce((sum, row) => sum + row.assignedInterns, 0);
  const accepted = rows.reduce((sum, row) => sum + row.accepted, 0);
  const completionRate = expected ? Math.round((accepted / expected) * 100) : 0;

  return (
    <MentorPage
      title="Tasks"
      description="Tasks in your interns' tracks, with how many of your interns have submitted and what's waiting for your review."
    >
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f8fbff] p-4">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            <strong className="mt-3 block text-xl text-[#1C1D52]">
              {activeTasks}
            </strong>
            <span className="text-xs text-slate-500">Active tasks</span>
          </div>
          <div className="rounded-xl bg-[#f8fbff] p-4">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <strong className="mt-3 block text-xl text-[#1C1D52]">
              {awaitingReview}
            </strong>
            <span className="text-xs text-slate-500">Awaiting review</span>
          </div>
          <div className="rounded-xl bg-[#f8fbff] p-4">
            <CheckCircle2 className="h-5 w-5 text-[#5FBB46]" />
            <strong className="mt-3 block text-xl text-[#1C1D52]">
              {completionRate}%
            </strong>
            <span className="text-xs text-slate-500">
              Completion rate (accepted work)
            </span>
          </div>
        </div>
        <MentorTasksList tasks={rows} />
      </section>
    </MentorPage>
  );
}
