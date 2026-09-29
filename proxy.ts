import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  isMfaVerificationPending,
  MFA_CHALLENGE_PATH,
} from "@/lib/supabase/mfa";

// Paths the app has never served that bots keep requesting: spam "profile"
// pages and WordPress endpoints. 410 Gone tells crawlers to drop them for good.
const GONE_PATH = /^\/(profile(\/|$)|xmlrpc\.php$|wp-(admin|login\.php|content|includes)(\/|$))/;

export async function proxy(request: NextRequest) {
  if (GONE_PATH.test(request.nextUrl.pathname)) {
    return new NextResponse("Gone", {
      status: 410,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const requiresInternshipRegistration =
    pathname === "/internship/enroll" ||
    pathname.startsWith("/internship/onboarding") ||
    pathname.startsWith("/internship/assessment") ||
    pathname.startsWith("/internship/results") ||
    pathname.startsWith("/internship/payment") ||
    pathname.startsWith("/internship/dashboard");

  if (requiresInternshipRegistration && !claimsData?.claims?.sub) {
    const registerUrl = new URL("/register", request.url);
    registerUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(registerUrl);
  }

  // Internship pages load their data client-side, so without this redirect a
  // user who skipped the MFA challenge would only see failing API requests.
  if (requiresInternshipRegistration && claimsData?.claims?.aal !== "aal2") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && (await isMfaVerificationPending(supabase, user))) {
      return NextResponse.redirect(new URL(MFA_CHALLENGE_PATH, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
