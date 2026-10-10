import { NextResponse } from "next/server";
import { listResourcesForIntern } from "@/lib/intern-resources";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** The published resources for the signed-in intern's track, with progress. */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  // Interns without workspace access have no tracks, so this is empty.
  return NextResponse.json({ resources: await listResourcesForIntern(userId) });
}
