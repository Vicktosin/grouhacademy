import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { countGraduates, listTestimonialDriveLinks, listTestimonials } from "@/lib/testimonials";

// Admin testimonials: the list (filter by cohort / track client-side), the
// tracks, the Drive folder links, and how many interns have graduated.
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
    const [testimonials, drive, tracks, graduates] = await Promise.all([
      // The admin's own preview intern's testimonial is included (flagged).
      listTestimonials({ includePreviewOf: adminId }),
      listTestimonialDriveLinks(),
      getPrisma().internshipProgram.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      countGraduates(),
    ]);
    return NextResponse.json({ testimonials, drive, tracks, graduates });
  } catch (error) {
    console.error("Failed to load testimonials:", error);
    return NextResponse.json({ error: "Unable to load testimonials." }, { status: 500 });
  }
}
