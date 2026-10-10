import { NextResponse } from "next/server";
import { getCurrentUserId, isPreviewSession } from "@/lib/route-guards";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";
import { getInterviewOverview, startInterview } from "@/lib/interviews";

async function internId() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (!(await hasInternshipWorkspaceAccess(userId)))
    return NextResponse.json(
      { error: "Practice interviews are for admitted interns." },
      { status: 403 },
    );
  return userId;
}

/** The intern's interview for their track and level, and past attempts. */
export async function GET() {
  const userId = await internId();
  if (userId instanceof NextResponse) return userId;
  const overview = await getInterviewOverview(userId);
  if (!overview)
    return NextResponse.json(
      { error: "No internship found." },
      { status: 404 },
    );
  return NextResponse.json(overview);
}

/** Starts an interview. Body: { mode: "VIDEO" | "AUDIO" }. */
export async function POST(request: Request) {
  const userId = await internId();
  if (userId instanceof NextResponse) return userId;
  // Interviews use paid video minutes: not for an admin's preview intern.
  if (await isPreviewSession())
    return NextResponse.json(
      { error: "Interviews can't be started in preview: they use paid video minutes." },
      { status: 403 },
    );
  const body = (await request.json().catch(() => null)) as {
    mode?: unknown;
  } | null;
  if (body?.mode !== "VIDEO" && body?.mode !== "AUDIO")
    return NextResponse.json(
      { error: "Choose a video or voice interview." },
      { status: 400 },
    );
  const result = await startInterview(userId, body.mode);
  if ("error" in result)
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  return NextResponse.json(result);
}
