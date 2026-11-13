import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { reviewTestimonial } from "@/lib/testimonials";

// Approve / reject and tag one testimonial.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    const result = await reviewTestimonial(id, body);
    if (!result.ok)
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Testimonial not found." ? 404 : 400 },
      );
    return NextResponse.json({ updated: true });
  } catch (error) {
    console.error("Failed to update testimonial:", error);
    return NextResponse.json({ error: "Unable to update the testimonial." }, { status: 500 });
  }
}
