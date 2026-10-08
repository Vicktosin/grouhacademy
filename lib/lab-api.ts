import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";

/** The signed-in admitted intern's id, or the response to return instead. */
export async function requireInternApi(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (!(await hasInternshipWorkspaceAccess(userId)))
    return NextResponse.json(
      { error: "The Practice Lab is for admitted interns." },
      { status: 403 },
    );
  return userId;
}
