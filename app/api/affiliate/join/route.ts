import { NextResponse } from "next/server";
import { isAffiliateEligible, joinAffiliateProgram } from "@/lib/affiliates";
import { getCurrentUserId } from "@/lib/route-guards";

/** An admitted intern joins the Affiliate Program and gets their code. */
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Sign in to the Affiliate Program." }, { status: 401 });
  if (!(await isAffiliateEligible(userId)))
    return NextResponse.json(
      { error: "The Affiliate Program is for admitted interns only." },
      { status: 403 },
    );
  const profile = await joinAffiliateProgram(userId);
  return NextResponse.json({ code: profile.code }, { status: 201 });
}
