import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { csvRows, listTestimonials } from "@/lib/testimonials";
import { testimonialsToCsv } from "@/lib/testimonial-input";

// CSV of testimonials, filtered like the admin page:
// ?cohortId=&programId=&status=&consentOnly=1
export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  try {
    const items = await listTestimonials({
      cohortId: params.get("cohortId") || null,
      programId: params.get("programId") || null,
      status: status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? status : null,
      consentOnly: params.get("consentOnly") === "1",
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(testimonialsToCsv(csvRows(items)), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="testimonials-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export testimonials:", error);
    return NextResponse.json({ error: "Unable to export testimonials." }, { status: 500 });
  }
}
