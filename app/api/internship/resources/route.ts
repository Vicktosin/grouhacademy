import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { listResourcesForIntern } from "@/lib/intern-resources";

/** The published resources for the signed-in intern's track, with progress. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  // Interns without workspace access have no tracks, so this is empty.
  return NextResponse.json({ resources: await listResourcesForIntern(userId) });
}
