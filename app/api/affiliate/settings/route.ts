import { NextResponse } from "next/server";
import { parseBankDetails } from "@/lib/affiliates";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";

/**
 * Body: any of { bankName, accountNumber, accountName } (all three together)
 * and { autoMonthlyPayout }. Payouts already requested keep the details
 * they were requested with.
 */
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Sign in to the Affiliate Program." }, { status: 401 });
  const profile = await getPrisma().affiliateProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Join the Affiliate Program first." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  const data: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    autoMonthlyPayout?: boolean;
  } = {};
  if ("bankName" in body || "accountNumber" in body || "accountName" in body) {
    const bank = parseBankDetails(body);
    if ("error" in bank) return NextResponse.json({ error: bank.error }, { status: 400 });
    Object.assign(data, bank);
  }
  if ("autoMonthlyPayout" in body) {
    if (typeof body.autoMonthlyPayout !== "boolean")
      return NextResponse.json({ error: "Choose whether to cash out monthly." }, { status: 400 });
    data.autoMonthlyPayout = body.autoMonthlyPayout;
  }
  const saved = await getPrisma().affiliateProfile.update({
    where: { userId },
    data,
    select: { bankName: true, accountNumber: true, accountName: true, autoMonthlyPayout: true },
  });
  return NextResponse.json(saved);
}
