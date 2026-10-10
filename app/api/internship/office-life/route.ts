import { NextResponse } from "next/server";
import { requireInternshipWorkspace } from "@/lib/internship-access";
import { isPreviewSession } from "@/lib/route-guards";
import { officeLifeOverview } from "@/lib/office-life/server";

/** Office Life: the intern's workdays, when each opens, and their scores. */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  return NextResponse.json(await officeLifeOverview(access.userId, await isPreviewSession()));
}
