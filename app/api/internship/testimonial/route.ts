import { requireInternshipWorkspace } from "@/lib/internship-access";
import { getInternTestimonialForm, saveInternTestimonial } from "@/lib/testimonials";
import { isJsonRequest, parseTestimonialInput } from "@/lib/testimonial-input";

// The intern's testimonial: text only. Videos go to the cohort's Google
// Drive folder; this route accepts JSON and never a file upload.

export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  try {
    const form = await getInternTestimonialForm(access.userId);
    if (!form) return Response.json({ error: "No internship application found." }, { status: 404 });
    return Response.json(form);
  } catch (error) {
    console.error("Failed to load testimonial form:", error);
    return Response.json({ error: "Unable to load the testimonial form." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  if (!isJsonRequest(request.headers.get("content-type")))
    return Response.json(
      { error: "Files can't be uploaded here. Upload your video to the Google Drive folder and paste its link." },
      { status: 415 },
    );
  const parsed = parseTestimonialInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await saveInternTestimonial(access.userId, parsed.value);
    if (!result.ok) return Response.json({ error: result.error }, { status: 404 });
    return Response.json({ saved: true });
  } catch (error) {
    console.error("Failed to save testimonial:", error);
    return Response.json({ error: "Unable to save your testimonial." }, { status: 500 });
  }
}
