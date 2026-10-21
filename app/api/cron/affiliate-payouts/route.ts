import { NextResponse } from "next/server";
import { runMonthlyAffiliatePayouts } from "@/lib/affiliates";

// Monthly job (vercel.json, the 1st of each month): cashes out affiliates
// who chose month-end payouts and whose balance has reached the minimum,
// for the month that just ended. Admins then pay them from Affiliates.

export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await runMonthlyAffiliatePayouts());
}
