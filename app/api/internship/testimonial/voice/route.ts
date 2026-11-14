import { requireInternshipWorkspace } from "@/lib/internship-access";
import { isStorageConfigured, uploadTestimonialMedia } from "@/lib/testimonial-media";
import { MEDIA_UPLOAD_MAX_BYTES, VOICE_NOTE_TYPES, baseContentType } from "@/lib/testimonial-input";

// Uploads a voice note (recorded in the browser, up to 3 minutes) to the
// intern's own Storage folder and returns its URL; the experience form then
// saves the URL (../route.ts).
export async function POST(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  if (!isStorageConfigured())
    return Response.json({ error: "Voice notes aren't set up yet. Please write or share a video instead." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No voice note was sent." }, { status: 400 });
  const type = baseContentType(file.type);
  if (!(VOICE_NOTE_TYPES as readonly string[]).includes(type))
    return Response.json({ error: "That audio format isn't supported. Please record again." }, { status: 400 });
  if (file.size > MEDIA_UPLOAD_MAX_BYTES)
    return Response.json({ error: "That voice note is too long. Please keep it under 3 minutes." }, { status: 413 });

  try {
    const url = await uploadTestimonialMedia("voice-notes", access.userId, new Uint8Array(await file.arrayBuffer()), type);
    return Response.json({ url });
  } catch (error) {
    console.error("Failed to upload voice note:", error);
    return Response.json({ error: "Unable to upload your voice note. Please try again." }, { status: 500 });
  }
}
