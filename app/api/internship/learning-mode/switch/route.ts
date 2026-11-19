import { requireInternshipWorkspace } from "@/lib/internship-access";
import { switchToCohort } from "@/lib/learning-mode";

// A self-paced intern joins the next cohort for this level (once per level;
// their self-paced work is kept).
export async function POST() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  try {
    const result = await switchToCohort(access.userId);
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    return Response.json(result);
  } catch (error) {
    console.error("Failed to switch to a cohort:", error);
    return Response.json({ error: "Unable to switch. Please try again." }, { status: 500 });
  }
}
