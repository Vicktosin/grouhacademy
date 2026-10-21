import { NextResponse } from "next/server";
import {
  affiliateDashboard,
  getAffiliateSettings,
  isAffiliateEligible,
} from "@/lib/affiliates";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";

/**
 * The affiliate app's state: signed out (401), not an intern, not joined
 * yet (with the program's terms), or the dashboard.
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Sign in to the Affiliate Program." }, { status: 401 });
  try {
    const [user, joined] = await Promise.all([
      getPrisma().user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, profile: { select: { firstName: true } } },
      }),
      getPrisma().affiliateProfile.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    const me = {
      firstName: user?.profile?.firstName?.trim() || user?.name?.trim().split(/\s+/)[0] || "there",
      email: user?.email ?? "",
    };
    if (!(await isAffiliateEligible(userId)))
      return NextResponse.json({ state: "not_eligible", me });
    if (!joined)
      return NextResponse.json({ state: "not_joined", me, terms: await getAffiliateSettings() });
    return NextResponse.json({ state: "joined", me, dashboard: await affiliateDashboard(userId) });
  } catch (error) {
    console.error("Failed to load the Affiliate Program:", error);
    return NextResponse.json(
      { error: "Unable to load the Affiliate Program. Please try again." },
      { status: 500 },
    );
  }
}
