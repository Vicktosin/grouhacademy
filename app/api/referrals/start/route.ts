import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { REFERRAL_CLICK_COOKIE } from "@/lib/referrals";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const clickId =
    body && typeof body === "object" && "clickId" in body && typeof body.clickId === "string"
      ? body.clickId
      : "";
  const cookieClickId = request.cookies.get(REFERRAL_CLICK_COOKIE)?.value;
  if (!clickId || !cookieClickId || clickId !== cookieClickId) {
    return NextResponse.json({ success: true, tracked: false });
  }

  const result = await getPrisma().referralClick.updateMany({
    where: { id: clickId, registrationStartedAt: null },
    data: { registrationStartedAt: new Date() },
  });
  return NextResponse.json({ success: true, tracked: result.count > 0 });
}
