import { requireInternshipWorkspace } from "@/lib/internship-access";
import { pendingPopupsForUser } from "@/lib/announcements";

// Pop-up announcements this intern hasn't pressed "Got it" on yet, oldest
// first (components/AnnouncementPopup shows them one at a time).
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  try {
    const popups = await pendingPopupsForUser(access.userId);
    return Response.json({
      popups: popups.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to load pop-up announcements:", error);
    return Response.json({ error: "Unable to load announcements." }, { status: 500 });
  }
}
