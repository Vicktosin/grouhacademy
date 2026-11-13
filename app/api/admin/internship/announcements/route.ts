import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { listCohortOptions } from "@/lib/admin-cohort-options";
import { getPrisma } from "@/lib/prisma";
import {
  createAnnouncement,
  listAnnouncementsForAdmin,
} from "@/lib/announcements";

// Admin announcements: list (with the tracks and cohorts to target) and
// create. Same validation as the MCP create_announcement tool.

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
    const [announcements, cohorts, tracks] = await Promise.all([
      listAnnouncementsForAdmin(50),
      listCohortOptions(),
      getPrisma().internshipProgram.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return NextResponse.json({ announcements, cohorts, tracks });
  } catch (error) {
    console.error("Failed to load announcements:", error);
    return NextResponse.json({ error: "Unable to load announcements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  try {
    const result = await createAnnouncement(adminId, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result.value, { status: 201 });
  } catch (error) {
    console.error("Failed to create announcement:", error);
    return NextResponse.json({ error: "Unable to create the announcement." }, { status: 500 });
  }
}
