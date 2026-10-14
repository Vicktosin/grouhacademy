import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { referralStats } from "@/lib/referral-stats";

/** Referral performance for the admin Referrals page. ?days=7|30|90 (anything else: all time). */
export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const days = Number(new URL(request.url).searchParams.get("days"));
  return NextResponse.json(await referralStats([7, 30, 90].includes(days) ? days : null));
}
