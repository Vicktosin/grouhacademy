import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { submitLab } from "@/lib/practice-lab";

// Backend API exercises run their tests on submit (well under a minute).
export const maxDuration = 60;

/**
 * Submits the intern's work. Body: { files, checkResults, taskId?, runIndex? }
 * (runIndex picks a simulator run; the best run by default). A linked task
 * is graded from the result against its pass mark (taskResult).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const body = (await request.json().catch(() => null)) as {
    files?: unknown;
    checkResults?: unknown;
    taskId?: unknown;
    runIndex?: unknown;
  } | null;
  if (!body)
    return NextResponse.json({ error: "Nothing to submit." }, { status: 400 });
  const result = await submitLab(userId, (await params).id, {
    files: body.files,
    checkResults: body.checkResults,
    taskId: typeof body.taskId === "string" ? body.taskId : null,
    runIndex: typeof body.runIndex === "number" ? body.runIndex : null,
  });
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
