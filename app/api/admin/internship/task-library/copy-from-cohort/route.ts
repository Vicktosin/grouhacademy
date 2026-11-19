import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { copyCohortTasksToLibrary, taskLibrarySummary } from "@/lib/task-library-copy";

// The Task Library on the admin "Self-paced or cohort" page: cohorts to copy
// from and what's in the library (GET); copy one cohort's tasks (POST
// { cohortId }), see lib/task-library-copy.

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
    return NextResponse.json(await taskLibrarySummary());
  } catch (error) {
    console.error("Failed to load the Task Library:", error);
    return NextResponse.json({ error: "Unable to load the Task Library." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (typeof body?.cohortId !== "string" || !body.cohortId)
    return NextResponse.json({ error: "Choose a cohort to copy." }, { status: 400 });
  try {
    const result = await copyCohortTasksToLibrary(body.cohortId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to copy cohort tasks:", error);
    return NextResponse.json({ error: "Unable to copy the tasks." }, { status: 500 });
  }
}
