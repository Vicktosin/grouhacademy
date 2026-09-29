import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import {
  MAX_SUBMISSION_LENGTH,
  resubmissionBlockedReason,
} from "@/lib/task-submission";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const taskId = typeof body?.taskId === "string" ? body.taskId : null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!taskId) {
    return NextResponse.json(
      { error: "No task to submit to." },
      { status: 400 },
    );
  }
  if (!content) {
    return NextResponse.json(
      { error: "Submission cannot be empty." },
      { status: 400 },
    );
  }
  if (content.length > MAX_SUBMISSION_LENGTH) {
    return NextResponse.json(
      {
        error: `Submission is too long (max ${MAX_SUBMISSION_LENGTH.toLocaleString()} characters).`,
      },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  try {
    const task = await prisma.internshipTask.findUnique({
      where: { id: taskId },
      select: { kind: true, module: { select: { programId: true } } },
    });
    const programId = task?.module.programId;

    // The task must belong to a programme the intern is enrolled in. Unknown
    // tasks and other programmes' tasks get the same response.
    const application = programId
      ? await prisma.internshipApplication.findUnique({
          where: { studentId_programId: { studentId: userId, programId } },
          select: { payment: { select: { status: true } } },
        })
      : null;
    if (!task || !programId || !application) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    if (application.payment?.status !== "PAID") {
      return NextResponse.json(
        { error: "Pay your acceptance fee to submit internship tasks." },
        { status: 403 },
      );
    }

    if (task.kind === "GROUP") {
      const membership = await prisma.internshipGroupMember.findUnique({
        where: { programId_userId: { programId, userId } },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Join your group before submitting a group task." },
          { status: 403 },
        );
      }
    }

    const existing = await prisma.taskSubmission.findUnique({
      where: { taskId_userId: { taskId, userId } },
      select: { status: true },
    });
    const blockedReason = resubmissionBlockedReason(existing?.status);
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 409 });
    }

    // A resubmission is a fresh attempt: clear the previous review so a stale
    // score or feedback is never shown against the new content.
    const submission = await prisma.taskSubmission.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId, content, status: "SUBMITTED" },
      update: {
        content,
        status: "SUBMITTED",
        submittedAt: new Date(),
        score: null,
        feedback: null,
        reviewedAt: null,
      },
    });

    return NextResponse.json({ id: submission.id, success: true });
  } catch (error) {
    console.error("Failed to submit task:", error);
    return NextResponse.json(
      { error: "Unable to submit assignment." },
      { status: 500 },
    );
  }
}
