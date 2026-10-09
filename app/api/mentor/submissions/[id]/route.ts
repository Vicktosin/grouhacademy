import { NextResponse } from "next/server";

import { requireMentorApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { creditedInterns, gradeSubmission, parseGrade } from "@/lib/submission-grading";
import { submissionHistory } from "@/lib/submission-history";

type Context = { params: Promise<{ id: string }> };

/** Whether the submission is from (or credits) one of this mentor's interns. */
async function mentorCanSee(mentorId: string, id: string) {
  const prisma = getPrisma();
  const submission = await prisma.taskSubmission.findUnique({
    where: { id },
    select: {
      userId: true,
      groupId: true,
      participants: { select: { userId: true } },
      task: { select: { module: { select: { programId: true } } } },
    },
  });
  if (!submission) return false;
  return (
    (await prisma.mentorAssignment.count({
      where: {
        mentorId,
        internId: { in: [submission.userId, ...creditedInterns(submission)] },
        programId: submission.task.module.programId,
        status: "ACTIVE",
      },
    })) > 0
  );
}

const notFound = () => NextResponse.json({ error: "Submission not found." }, { status: 404 });

/** The submission's grading history (every version and every grade). */
export async function GET(_request: Request, { params }: Context) {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;
  const { id } = await params;
  if (!(await mentorCanSee(mentorId, id))) return notFound();
  return NextResponse.json({ history: await submissionHistory(id) });
}

/**
 * Records a mentor's review of a task submission: accept it (optionally with
 * a score), or send it back with feedback so the intern can resubmit.
 * Mentors can also change a grade they gave (see lib/submission-grading).
 */
export async function POST(request: Request, { params }: Context) {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;

  const { id } = await params;
  const grade = parseGrade(await request.json().catch(() => null));
  if ("error" in grade) return NextResponse.json({ error: grade.error }, { status: 400 });

  try {
    if (!(await mentorCanSee(mentorId, id))) return notFound();
    const result = await gradeSubmission(id, { role: "MENTOR", userId: mentorId }, grade);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Failed to review submission:", error);
    return NextResponse.json(
      { error: "Unable to save your review. Please try again." },
      { status: 500 },
    );
  }
}
