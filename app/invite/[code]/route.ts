import { NextRequest, NextResponse } from "next/server";
import {
  AFFILIATE_CLICK_COOKIE,
  AFFILIATE_COOKIE_MAX_AGE,
  AFFILIATE_VISITOR_COOKIE,
  recordAffiliateClick,
} from "@/lib/affiliates";

type Params = { params: Promise<{ code: string }> };

// An affiliate's invite link: counts the visit, remembers it in this browser
// for 30 days (so signing up later is still credited), then goes to the
// internship sign-up. An unknown code just goes to sign-up.
export async function GET(request: NextRequest, { params }: Params) {
  const { code } = await params;
  const visitorKey =
    request.cookies.get(AFFILIATE_VISITOR_COOKIE)?.value || crypto.randomUUID();
  const click = await recordAffiliateClick(code.trim(), visitorKey).catch((error) => {
    console.error("Failed to record an affiliate link visit:", error);
    return null;
  });

  const response = NextResponse.redirect(new URL("/register", request.url));
  if (click) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: AFFILIATE_COOKIE_MAX_AGE,
      path: "/",
    };
    response.cookies.set(AFFILIATE_VISITOR_COOKIE, visitorKey, options);
    response.cookies.set(AFFILIATE_CLICK_COOKIE, click.id, options);
  }
  return response;
}
