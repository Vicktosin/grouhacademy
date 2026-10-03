import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";

/** Live dashboard banners for the internship workspace, in display order. */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

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
