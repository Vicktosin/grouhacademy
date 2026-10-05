import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";
import { getInternTaskContext } from "@/lib/intern-tasks";
import {
  MAX_SUBMISSION_LENGTH,
  submissionBlockedReason,
} from "@/lib/task-submission";

/**
 * Submits (or resubmits) a task. Individual tasks: one submission per intern.
 * Group tasks: only the group leader submits, once for the whole group, and
 * lists the members who took part. Every rule, including the submission
 * window, is checked here on the server.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  const body = await request.json().catch(() => null);
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const participantIds: string[] = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((id: unknown) => typeof id === "string")
    : [];

  if (!taskId)
    return NextResponse.json(
      { error: "No task to submit to." },
      { status: 400 },
    );
  if (!content)
    return NextResponse.json(
      { error: "Submission cannot be empty." },
      { status: 400 },
    );
  if (content.length > MAX_SUBMISSION_LENGTH)
    return NextResponse.json(
      {
        error: `Submission is too long (max ${MAX_SUBMISSION_LENGTH.toLocaleString()} characters).`,
      },
      { status: 400 },
    );

  if (!(await hasInternshipWorkspaceAccess(userId)))
    return NextResponse.json(
      { error: "Pay your acceptance fee to submit internship tasks." },
      { status: 403 },
    );

  const prisma = getPrisma();
  try {
    const context = await getInternTaskContext(userId);
    const task = await prisma.internshipTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        kind: true,
        opensAt: true,
        dueDate: true,
        cohortId: true,
      },
    });
    // Interns only see, and may only submit, their own cohort's tasks.
    if (!context?.cohortId || !task || task.cohortId !== context.cohortId)
      return NextResponse.json({ error: "Task not found." }, { status: 404 });

    const { group } = context;
    const groupTask = task.kind === "GROUP";
    const existing = await prisma.taskSubmission.findFirst({
      where: groupTask
        ? { taskId, groupId: group?.id ?? "__none__" }
        : { taskId, userId, groupId: null },
      select: { id: true, status: true },
    });

    const blocked = submissionBlockedReason({
      task,
      existingStatus: existing?.status,
      group,
      userId,
    });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

    // A resubmission is a fresh attempt: clear the previous review so a stale
    // score or feedback is never shown against the new content.
    const fresh = {
      content,
      status: "SUBMITTED" as const,
      submittedAt: new Date(),
      score: null,
      feedback: null,
      reviewedAt: null,
    };

    if (!groupTask) {
      const submission = existing
        ? await prisma.taskSubmission.update({
            where: { id: existing.id },
            data: fresh,
          })
        : await prisma.taskSubmission.create({
            data: { taskId, userId, ...fresh },
          });
      return NextResponse.json({ id: submission.id, success: true });
    }

    // Group task (submissionBlockedReason guarantees group and leadership).
    const memberIds = new Set(group!.members.map((member) => member.userId));
    const participants = [
      ...new Set([userId, ...participantIds.filter((id) => memberIds.has(id))]),
    ];
    const submission = await prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.taskSubmission.update({
            where: { id: existing.id },
            data: { ...fresh, userId },
          })
        : await tx.taskSubmission.create({
            data: { taskId, userId, groupId: group!.id, ...fresh },
          });
      await tx.taskSubmissionParticipant.deleteMany({
        where: { submissionId: saved.id },
      });
      await tx.taskSubmissionParticipant.createMany({
        data: participants.map((id) => ({
          submissionId: saved.id,
          userId: id,
        })),
      });
      return saved;
    });
    return NextResponse.json({ id: submission.id, success: true });
  } catch (error) {
    console.error("Failed to submit task:", error);
    return NextResponse.json(
      { error: "Unable to submit your work. Please try again." },
      { status: 500 },
    );
  }
}
