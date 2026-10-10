import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** Live dashboard banners for the internship workspace, in display order. */
export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;

  const now = new Date();
  try {
    const banners = await getPrisma().dashboardBanner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        imageUrl: true,
        mobileImageUrl: true,
        buttonLabel: true,
        buttonUrl: true,
      },
    });
    return NextResponse.json({ banners });
  } catch (error) {
    console.error("Failed to load dashboard banners:", error);
    return NextResponse.json(
      { error: "Unable to load banners." },
      { status: 500 },
    );
  }
}
