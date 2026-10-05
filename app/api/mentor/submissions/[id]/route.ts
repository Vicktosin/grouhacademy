import { NextResponse } from "next/server";

import { requireMentorApi } from "@/lib/api-guards";
import { recomputeInternProgress } from "@/lib/internship-progress";
import { getPrisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

const MAX_FEEDBACK_LENGTH = 5000;

/**
 * Records a mentor's review of a task submission: accept it (optionally with
 * a score), or send it back with feedback so the intern can resubmit.
 */
export async function POST(request: Request, { params }: Context) {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  const feedback =
    typeof body?.feedback === "string" ? body.feedback.trim() : "";
  const rawScore = body?.score;

  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    return NextResponse.json(
      { error: "Choose to accept the work or request changes." },
      { status: 400 },
    );
  }
  if (decision === "REJECTED" && !feedback) {
    return NextResponse.json(
      { error: "Explain what needs to change so the intern can resubmit." },
      { status: 400 },
    );
  }
  if (feedback.length > MAX_FEEDBACK_LENGTH) {
    return NextResponse.json(
      {
        error: `Feedback is too long (max ${MAX_FEEDBACK_LENGTH} characters).`,
      },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  try {
    const submission = await prisma.taskSubmission.findUnique({
      where: { id },
      select: {
        userId: true,
        groupId: true,
        status: true,
        participants: { select: { userId: true } },
        task: {
          select: { maxScore: true, module: { select: { programId: true } } },
        },
      },
    });
    // Group work is credited to its participants; individual work to its author.
    const creditedIds = submission
      ? submission.groupId
        ? submission.participants.map((p) => p.userId)
        : [submission.userId]
      : [];
    if (
      !submission ||
      !(await prisma.mentorAssignment.count({
        where: {
          mentorId,
          internId: { in: [submission.userId, ...creditedIds] },
          programId: submission.task.module.programId,
          status: "ACTIVE",
        },
      }))
    ) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 },
      );
    }

    let score: number | null = null;
    if (rawScore !== undefined && rawScore !== null && rawScore !== "") {
      score = Number(rawScore);
      if (
        !Number.isInteger(score) ||
        score < 0 ||
        score > submission.task.maxScore
      ) {
        return NextResponse.json(
          {
            error: `Score must be a whole number from 0 to ${submission.task.maxScore}.`,
          },
          { status: 400 },
        );
      }
    }

    // Only work awaiting review can be reviewed. The status filter also
    // protects against the intern resubmitting at the same moment.
    const updated = await prisma.taskSubmission.updateMany({
      where: { id, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      data: {
        status: decision,
        score,
        feedback: feedback || null,
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "This submission has already been reviewed." },
        { status: 409 },
      );
    }

    for (const internId of creditedIds)
      await recomputeInternProgress(internId, submission.task.module.programId);

    return NextResponse.json({
      success: true,
      message:
        decision === "ACCEPTED"
          ? "Submission accepted."
          : "Changes requested. The intern can now resubmit.",
    });
  } catch (error) {
    console.error("Failed to review submission:", error);
    return NextResponse.json(
      { error: "Unable to save your review. Please try again." },
      { status: 500 },
    );
  }
}
