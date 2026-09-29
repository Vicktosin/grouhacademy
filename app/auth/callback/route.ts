import { NextRequest, NextResponse } from "next/server";
import {
  ensurePrismaUserForSupabaseAuth,
  getAuthorizedHomeRouteForUserId,
} from "@/lib/supabase/auth";
import {
  isAllowedPostAuthPath,
  isMfaVerificationPending,
  MFA_CHALLENGE_PATH,
} from "@/lib/supabase/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Users with MFA enrolled must complete the second factor before being
      // sent anywhere, including the registration and recovery destinations.
      if (user && (await isMfaVerificationPending(supabase, user))) {
        const challengeUrl = new URL(MFA_CHALLENGE_PATH, request.url);
        if (isAllowedPostAuthPath(next))
          challengeUrl.searchParams.set("next", next);
        return NextResponse.redirect(challengeUrl);
      }

      // Only allow internal destinations from the registration and recovery
      // flows. External callback redirects must never be accepted.
      if (isAllowedPostAuthPath(next)) {
        return NextResponse.redirect(new URL(next, request.url));
      }

      if (user) {
        const userId = await ensurePrismaUserForSupabaseAuth(user);
        const destination = await getAuthorizedHomeRouteForUserId(userId);
        return NextResponse.redirect(new URL(destination, request.url));
      }
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", request.url),
  );
}
