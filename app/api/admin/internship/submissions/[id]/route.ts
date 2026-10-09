import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { gradeSubmission, parseGrade } from "@/lib/submission-grading";
import { submissionHistory } from "@/lib/submission-history";

type Context = { params: Promise<{ id: string }> };

/** The submission's grading history (every version and every grade). */
export async function GET(_request: Request, { params }: Context) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const exists = await getPrisma().taskSubmission.count({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  return NextResponse.json({ history: await submissionHistory(id) });
}

/**
 * Grades a submission as an admin: anything waiting for review, or changes
 * a grade already given (by anyone). See lib/submission-grading.
 */
export async function POST(request: Request, { params }: Context) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const grade = parseGrade(await request.json().catch(() => null));
  if ("error" in grade) return NextResponse.json({ error: grade.error }, { status: 400 });
  try {
    const result = await gradeSubmission(id, { role: "ADMIN", userId: adminId }, grade);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Failed to grade submission:", error);
    return NextResponse.json({ error: "Unable to save the grade. Please try again." }, { status: 500 });
  }
}
