import { recomputeInternProgress } from "@/lib/internship-progress";
import { getPrisma } from "@/lib/prisma";
import { canGrade } from "@/lib/submission-history";
import { awardTaskAchievements } from "@/lib/achievements";

// Grading a task submission, the same way for mentors and admins: accept it
// (optionally with a score) or send it back with feedback so the intern can
// resubmit. Work waiting for review can be graded by either; a grade
// already given can be changed by an admin, or by the mentor who gave it.
// Every grade is kept in the submission's history.

const MAX_FEEDBACK_LENGTH = 5000;

export type Grader = { role: "ADMIN" | "MENTOR"; userId: string };
type Result = { ok: true; message: string } | { ok: false; error: string; status: number };

/** Validates a grade sent by a mentor or admin. */
export function parseGrade(body: unknown): { decision: "ACCEPTED" | "REJECTED"; feedback: string; rawScore: unknown } | { error: string } {
  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const decision = raw.decision;
  const feedback = typeof raw.feedback === "string" ? raw.feedback.trim() : "";
  if (decision !== "ACCEPTED" && decision !== "REJECTED") return { error: "Choose to accept the work or request changes." };
  if (decision === "REJECTED" && !feedback) return { error: "Explain what needs to change so the intern can resubmit." };
  if (feedback.length > MAX_FEEDBACK_LENGTH) return { error: `Feedback is too long (max ${MAX_FEEDBACK_LENGTH} characters).` };
  return { decision, feedback, rawScore: raw.score };
}

/** The interns a submission counts for: group work's participants, or its author. */
export function creditedInterns(submission: { userId: string; groupId: string | null; participants: Array<{ userId: string }> }) {
  return submission.groupId ? submission.participants.map((p) => p.userId) : [submission.userId];
}

export async function gradeSubmission(
  submissionId: string,
  grader: Grader,
  grade: { decision: "ACCEPTED" | "REJECTED"; feedback: string; rawScore: unknown },
): Promise<Result> {
  const prisma = getPrisma();
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    select: {
      userId: true,
      groupId: true,
      status: true,
      reviewedById: true,
      participants: { select: { userId: true } },
      task: { select: { maxScore: true, module: { select: { programId: true } } } },
    },
  });
  if (!submission) return { ok: false, error: "Submission not found.", status: 404 };
  if (!canGrade(grader, submission))
    return {
      ok: false,
      error:
        submission.status === "ACCEPTED" || submission.status === "REJECTED"
          ? "This was graded by someone else. Only they or an admin can change the grade."
          : "This submission can't be graded right now.",
      status: 409,
    };

  let score: number | null = null;
  if (grade.rawScore !== undefined && grade.rawScore !== null && grade.rawScore !== "") {
    score = Number(grade.rawScore);
    if (!Number.isInteger(score) || score < 0 || score > submission.task.maxScore)
      return { ok: false, error: `Score must be a whole number from 0 to ${submission.task.maxScore}.`, status: 400 };
  }

  const regrade = submission.status === "ACCEPTED" || submission.status === "REJECTED";
  const now = new Date();
  // Only if nothing changed meanwhile (the intern resubmitting, or someone
  // else grading at the same moment).
  const saved = await prisma.$transaction(async (tx) => {
    const updated = await tx.taskSubmission.updateMany({
      where: { id: submissionId, status: submission.status, reviewedById: submission.reviewedById },
      data: { status: grade.decision, score, feedback: grade.feedback || null, reviewedAt: now, reviewedById: grader.userId },
    });
    if (!updated.count) return false;
    await tx.taskSubmissionEvent.create({
      data: {
        submissionId,
        kind: "REVIEWED",
        status: grade.decision,
        score,
        feedback: grade.feedback || null,
        actorId: grader.userId,
        actorRole: grader.role,
      },
      select: { id: true },
    });
    if (grade.decision === "ACCEPTED") {
      for (const internId of creditedInterns(submission)) {
        await awardTaskAchievements(tx, internId, submissionId);
      }
    }
    return true;
  });
  if (!saved)
    return { ok: false, error: "This submission changed while you were grading it. Reload to see the latest.", status: 409 };

  const programId = submission.task.module.programId;
  for (const internId of creditedInterns(submission))
    await recomputeInternProgress(internId, programId).catch((error) =>
      console.error("[grading] Progress update failed.", error instanceof Error ? error.message : error),
    );

  return {
    ok: true,
    message: regrade
      ? "Grade updated."
      : grade.decision === "ACCEPTED"
        ? "Submission accepted."
        : "Changes requested. The intern can now resubmit.",
  };
}
