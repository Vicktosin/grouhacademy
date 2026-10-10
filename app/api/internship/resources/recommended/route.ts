import { NextResponse } from "next/server";
import { listRecommendedForIntern } from "@/lib/intern-resources";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** Resources recommended for the intern's current track and level. */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;
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
