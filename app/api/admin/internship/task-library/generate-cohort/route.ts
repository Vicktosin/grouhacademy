import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { generateCohortTasks } from "@/lib/task-generation";

// Makes a cohort's tasks from the Task Library, for the weeks it has none.
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (typeof body?.cohortId !== "string" || !body.cohortId)
    return NextResponse.json({ error: "Choose a cohort." }, { status: 400 });
  try {
    const result = await generateCohortTasks(body.cohortId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate cohort tasks:", error);
    return NextResponse.json({ error: "Unable to generate the tasks." }, { status: 500 });
  }
}
