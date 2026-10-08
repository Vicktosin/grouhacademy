import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { endInterview } from "@/lib/interviews";

/** Ends the intern's interview now. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const session = await endInterview(userId, (await params).id);
  if (!session)
    return NextResponse.json(
      { error: "Interview not found." },
      { status: 404 },
    );
  return NextResponse.json({ session });
}
