import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { replyToSocialComments } from "@/lib/practice-lab";

export const maxDuration = 60;

/**
 * Sends the intern's replies to a social run's comments for grading (once
 * per run). Body: { runIndex, replies: { [commentId]: text } }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const body = (await request.json().catch(() => null)) as {
    runIndex?: unknown;
    replies?: unknown;
  } | null;
  const result = await replyToSocialComments(
    userId,
    (await params).id,
    body?.runIndex,
    body?.replies,
  );
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
