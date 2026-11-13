import { requireInternshipWorkspace } from "@/lib/internship-access";
import { dismissPopup } from "@/lib/announcements";

// "Got it" on a pop-up announcement: it won't be shown to this intern again.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { id } = await params;
  try {
    if (!(await dismissPopup(access.userId, id)))
      return Response.json({ error: "Announcement not found." }, { status: 404 });
    return Response.json({ dismissed: true });
  } catch (error) {
    console.error("Failed to dismiss pop-up announcement:", error);
    return Response.json({ error: "Unable to save." }, { status: 500 });
  }
}
