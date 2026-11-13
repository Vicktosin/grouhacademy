import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { setTestimonialDriveUrl } from "@/lib/testimonials";

// Set the Google Drive folder interns upload testimonial videos to: one
// cohort's ({ cohortId, url }) or the global fallback ({ cohortId: null }).
export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  const cohortId = typeof body?.cohortId === "string" && body.cohortId ? body.cohortId : null;
  const url = typeof body?.url === "string" ? body.url : null;
  try {
    const result = await setTestimonialDriveUrl(cohortId, url, adminId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Failed to save testimonial Drive link:", error);
    return NextResponse.json({ error: "Unable to save the link." }, { status: 500 });
  }
}
