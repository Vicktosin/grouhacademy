import { NextResponse } from "next/server";
import { getProgression, startNextLevel } from "@/lib/internship-progression";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** Where the intern stands: current level, certificate and next level. */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;
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
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;
  const result = await startNextLevel(userId);
  if ("error" in result)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json(result);
}
