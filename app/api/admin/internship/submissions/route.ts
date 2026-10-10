import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { listCohortOptions } from "@/lib/admin-cohort-options";
import { SUBMISSION_LABELS } from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";
import { REAL_USER } from "@/lib/real-user";

const PAGE_SIZE = 20;
const PENDING = ["SUBMITTED", "UNDER_REVIEW"] as const;
const REVIEWED = ["ACCEPTED", "REJECTED"] as const;

const name = (user: { name: string | null; email: string } | null) => (user ? user.name?.trim() || user.email : null);

/**
 * Task submissions for admins, a page at a time. Query: cohortId, taskId,
 * kind (GROUP | INDIVIDUAL), status (pending | reviewed | all), q (intern,
 * group or task), page.
 */
export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const params = new URL(request.url).searchParams;
  const cohortId = params.get("cohortId") || null;
  const taskId = params.get("taskId") || null;
  const kind = params.get("kind") === "GROUP" ? "GROUP" : "INDIVIDUAL";
  const status = params.get("status") === "reviewed" ? "reviewed" : params.get("status") === "all" ? "all" : "pending";
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));

  const prisma = getPrisma();
  const scope: Prisma.TaskSubmissionWhereInput = {
    status: { not: "DRAFT" },
    // Admins' preview interns' work never enters the queue.
    user: REAL_USER,
    groupId: kind === "GROUP" ? { not: null } : null,
    ...(taskId ? { taskId } : cohortId ? { task: { cohortId } } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { participants: { some: { user: { name: { contains: q, mode: "insensitive" } } } } },
            { task: { title: { contains: q, mode: "insensitive" } } },
            ...(/^\d+$/.test(q) ? [{ group: { number: Number(q) } }] : []),
          ],
        }
      : {}),
  };
  const where: Prisma.TaskSubmissionWhereInput = {
    ...scope,
    ...(status === "pending" ? { status: { in: [...PENDING] } } : status === "reviewed" ? { status: { in: [...REVIEWED] } } : {}),
  };

  const [rows, total, pending, reviewed, tasks, cohorts] = await Promise.all([
    prisma.taskSubmission.findMany({
      where,
      // Oldest waiting first; graded work newest first.
      orderBy: { submittedAt: status === "pending" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        content: true,
        fileUrl: true,
        status: true,
        score: true,
        feedback: true,
        submittedAt: true,
        reviewedBy: { select: { name: true, email: true } },
        reviewedById: true,
        user: { select: { name: true, email: true } },
        group: { select: { number: true } },
        participants: { select: { user: { select: { name: true, email: true } } } },
        task: {
          select: {
            title: true,
            maxScore: true,
            labScenarioId: true,
            module: { select: { title: true } },
            cohort: { select: { name: true, program: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.taskSubmission.count({ where }),
    prisma.taskSubmission.count({ where: { ...scope, status: { in: [...PENDING] } } }),
    prisma.taskSubmission.count({ where: { ...scope, status: { in: [...REVIEWED] } } }),
    // The chosen cohort's tasks, for the task filter.
    cohortId
      ? prisma.internshipTask.findMany({
          where: { cohortId },
          orderBy: { dueDate: "asc" },
          select: { id: true, title: true, kind: true },
        })
      : Promise.resolve([]),
    listCohortOptions(),
  ]);

  return NextResponse.json({
    cohorts,
    tasks,
    counts: { pending, reviewed, all: pending + reviewed },
    total,
    page,
    pageSize: PAGE_SIZE,
    submissions: rows.map((row) => {
      const author = name(row.user) ?? "Intern";
      const graded = row.status === "ACCEPTED" || row.status === "REJECTED";
      return {
        id: row.id,
        kind,
        internName: row.group ? `Group ${row.group.number}` : author,
        submittedBy: author,
        participants: row.participants.map((p) => name(p.user) ?? "Intern"),
        taskTitle: row.task.title,
        moduleTitle: row.task.module.title,
        cohortName: row.task.cohort?.name ?? null,
        trackName: row.task.cohort?.program.name ?? null,
        content: row.content,
        // Only link to web URLs; never render javascript: or data: links.
        fileUrl: row.fileUrl && /^https?:\/\//i.test(row.fileUrl) ? row.fileUrl : null,
        submittedLabel: row.submittedAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
        submittedAt: row.submittedAt.toISOString(),
        status: row.status,
        statusLabel: SUBMISSION_LABELS[row.status].label,
        statusTone: SUBMISSION_LABELS[row.status].tone,
        score: row.score,
        maxScore: row.task.maxScore,
        feedback: row.feedback,
        gradedBy: row.reviewedById
          ? row.reviewedById === adminId
            ? "you"
            : name(row.reviewedBy)
          : graded && row.task.labScenarioId
            ? "the Practice Lab"
            : null,
        // Admins can change any grade.
        canChangeGrade: true,
      };
    }),
  });
}
