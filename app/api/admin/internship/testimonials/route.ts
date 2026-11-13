import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { listTestimonialDriveLinks, listTestimonials } from "@/lib/testimonials";

// Admin testimonials: the list (filter by cohort / track client-side), the
// tracks, and the Drive folder links.
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
    const [testimonials, drive, tracks] = await Promise.all([
      listTestimonials({}),
      listTestimonialDriveLinks(),
      getPrisma().internshipProgram.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return NextResponse.json({ testimonials, drive, tracks });
  } catch (error) {
    console.error("Failed to load testimonials:", error);
    return NextResponse.json({ error: "Unable to load testimonials." }, { status: 500 });
  }
}
