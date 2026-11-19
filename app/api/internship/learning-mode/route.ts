import { requireInternshipWorkspace } from "@/lib/internship-access";
import { chooseLearningMode, getLearningModeState } from "@/lib/learning-mode";

// Self-paced or cohort for the intern's current level: the options (GET)
// and their choice (POST { mode: "SELF_PACED" | "COHORT" }).

export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  try {
    const state = await getLearningModeState(access.userId);
    if (!state) return Response.json({ error: "No internship application found." }, { status: 404 });
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load learning mode:", error);
    return Response.json({ error: "Unable to load your options." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const body = await request.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== "SELF_PACED" && mode !== "COHORT")
    return Response.json({ error: "Choose self-paced or cohort." }, { status: 400 });
  try {
    const result = await chooseLearningMode(access.userId, mode);
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    console.error("Failed to save learning mode:", error);
    return Response.json({ error: "Unable to save your choice. Please try again." }, { status: 500 });
  }
}
