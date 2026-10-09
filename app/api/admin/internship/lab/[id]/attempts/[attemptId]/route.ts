import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

/** One intern's full work on an exercise: code files or simulator runs. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id, attemptId } = await params;
  const attempt = await getPrisma().labAttempt.findFirst({
    where: { id: attemptId, scenarioId: id },
    select: { files: true, runs: true, review: true, checkResults: true },
  });
  if (!attempt)
    return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  return NextResponse.json({
    files: attempt.files,
    runs: Array.isArray(attempt.runs) ? attempt.runs : [],
    review: attempt.review,
    checkResults: attempt.checkResults,
  });
}
