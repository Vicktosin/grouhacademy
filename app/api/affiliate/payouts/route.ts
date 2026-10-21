import { NextResponse } from "next/server";
import { naira, requestAffiliatePayout } from "@/lib/affiliates";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";

/** Cashes out the affiliate's whole balance, if it has reached the minimum. */
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Sign in to the Affiliate Program." }, { status: 401 });
  const profile = await getPrisma().affiliateProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });
  if (!profile)
    return NextResponse.json({ error: "Join the Affiliate Program first." }, { status: 403 });

  const result = await requestAffiliatePayout(userId);
  if (result.payout)
    return NextResponse.json({ payout: { id: result.payout.id, amount: result.payout.amount } }, { status: 201 });
  const refused = result.refused ?? "below_minimum";
  const message = {
    no_bank_details: "Add your bank details in Settings before cashing out.",
    already_pending: "You already have a cash-out waiting to be paid.",
    below_minimum: `You can cash out once your balance reaches ${naira(result.payoutMinimum)}.`,
  }[refused];
  return NextResponse.json({ error: message }, { status: refused === "already_pending" ? 409 : 400 });
}
