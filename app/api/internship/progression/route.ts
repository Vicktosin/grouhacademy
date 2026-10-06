import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getProgression, startNextLevel } from "@/lib/internship-progression";

/** Where the intern stands: current level, certificate and next level. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const progression = await getProgression(userId);
  if (!progression)
    return NextResponse.json(
      { error: "No internship application found." },
      { status: 404 },
    );
  return NextResponse.json(progression);
}

/**
 * "Move to next level": queues the next level's application. The client
 * then starts the fee payment for the returned application.
 */
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const result = await startNextLevel(userId);
  if ("error" in result)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json(result);
}
