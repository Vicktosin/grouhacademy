import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getSession } from "@/lib/interviews";

/** One of the intern's interviews (polled while waiting for feedback). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const session = await getSession(userId, (await params).id);
  if (!session)
    return NextResponse.json(
      { error: "Interview not found." },
      { status: 404 },
    );
  return NextResponse.json({ session });
}
