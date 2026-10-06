import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { listRecommendedForIntern } from "@/lib/intern-resources";

/** Resources recommended for the intern's current track and level. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const recommended = await listRecommendedForIntern(userId);
  return NextResponse.json(
    recommended ?? {
      programName: null,
      levelName: null,
      curated: false,
      resources: [],
    },
  );
}
