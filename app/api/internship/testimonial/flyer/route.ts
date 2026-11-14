import { requireInternshipWorkspace } from "@/lib/internship-access";
import { canMakeFlyer, saveInternFlyer } from "@/lib/testimonials";
import { isStorageConfigured, uploadTestimonialMedia } from "@/lib/testimonial-media";
import { FLYER_TYPES, MEDIA_UPLOAD_MAX_BYTES, baseContentType } from "@/lib/testimonial-input";

// Saves the graduate's finished flyer (drawn in their browser; see
// components/graduation) when they download or share it, so admins can see
// it. Only the rendered flyer is sent: never the original photo.
export async function POST(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  if (!isStorageConfigured())
    return Response.json({ error: "Saving flyers isn't set up yet." }, { status: 503 });
  if (!(await canMakeFlyer(access.userId)))
    return Response.json({ error: "The graduation flyer is for interns who have completed." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "No flyer was sent." }, { status: 400 });
  const type = baseContentType(file.type);
  if (!(FLYER_TYPES as readonly string[]).includes(type))
    return Response.json({ error: "The flyer must be a JPG or PNG image." }, { status: 400 });
  if (file.size > MEDIA_UPLOAD_MAX_BYTES)
    return Response.json({ error: "The flyer image is too large." }, { status: 413 });

  try {
    const url = await uploadTestimonialMedia("flyers", access.userId, new Uint8Array(await file.arrayBuffer()), type);
    const saved = await saveInternFlyer(access.userId, url);
    if (!saved.ok) return Response.json({ error: saved.error }, { status: 403 });
    return Response.json({ url });
  } catch (error) {
    console.error("Failed to save flyer:", error);
    return Response.json({ error: "Unable to save your flyer." }, { status: 500 });
  }
}
