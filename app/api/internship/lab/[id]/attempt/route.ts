import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { getLabAttempt } from "@/lib/practice-lab";

/** The intern's attempt (polled while the code review is prepared). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  return NextResponse.json({
    attempt: await getLabAttempt(userId, (await params).id),
  });
}
