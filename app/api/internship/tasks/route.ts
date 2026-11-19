import { NextResponse } from "next/server";
import { NotificationType } from "@/generated/prisma/client";
import { getCurrentUserId, isPreviewSession } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";
import { getInternTaskContext } from "@/lib/intern-tasks";
import { getInternTasksWithOfficeLife } from "@/lib/office-life/task-list";
import { earlierSelfPacedWork, getSelfPacedTasks, isSelfPacedNow } from "@/lib/self-paced-tasks";
import { audienceWhere } from "@/lib/learner-audience";
import type {
  InternshipAlert,
  InternshipTaskListResponse,
} from "@/lib/internship-data";

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / (1000 * 60));
  if (minutes < 60)
    return `${Math.max(1, minutes)} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function notificationTone(type: NotificationType): InternshipAlert["tone"] {
  switch (type) {
    case NotificationType.ERROR:
      return "red";
    case NotificationType.WARNING:
      return "orange";
    case NotificationType.SUCCESS:
      return "green";
    default:
      return "slate";
  }
}

export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!(await hasInternshipWorkspaceAccess(userId))) {
    return NextResponse.json(
      {
        error:
          "Pass the entrance assessment and pay the acceptance fee to access internship tasks.",
      },
      { status: 403 },
    );
  }

  const context = await getInternTaskContext(userId);
  if (!context) {
    const empty: InternshipTaskListResponse = {
      hasProgram: false,
      hasCohort: false,
      tasks: [],
      stats: {
        pending: 0,
        submitted: 0,
        overdue: 0,
        activeIndividual: 0,
        activeGroup: 0,
      },
      alerts: [],
    };
    return NextResponse.json(empty);
  }

  const selfPacedStart = context.selfPacedStartDate;
  const tasks = selfPacedStart && isSelfPacedNow(context)
    ? await getSelfPacedTasks(userId, { ...context, selfPacedStartDate: selfPacedStart })
    : [
        ...(await getInternTasksWithOfficeLife(userId, context, await isPreviewSession())),
        // Joined a cohort after starting self-paced: their earlier work stays visible.
        ...(selfPacedStart ? await earlierSelfPacedWork(userId, { ...context, selfPacedStartDate: selfPacedStart }) : []),
      ];
  const stats = {
    // Office Life tasks are still to do while their workday is open.
    pending: tasks.filter((task) => task.canSubmit || (task.officeLife && !task.submittedAt && task.window === "OPEN")).length,
    submitted: tasks.filter((task) =>
      ["Submitted", "Under review", "Passed"].includes(task.status),
    ).length,
    overdue: tasks.filter((task) => task.status === "Missed").length,
    activeIndividual: tasks.filter(
      (task) => task.window === "OPEN" && task.kind === "INDIVIDUAL",
    ).length,
    activeGroup: tasks.filter(
      (task) => task.window === "OPEN" && task.kind === "GROUP",
    ).length,
  };

  const notifications = await getPrisma().notification.findMany({
    where: { userId, ...audienceWhere("internship") },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const response: InternshipTaskListResponse = {
    hasProgram: true,
    hasCohort: Boolean(context.cohortId),
    tasks,
    stats,
    alerts: notifications.map((notification) => ({
      id: notification.id,
      text: notification.message,
      tone: notificationTone(notification.type),
      postedLabel: timeAgo(notification.createdAt),
    })),
  };

  return NextResponse.json(response);
}
