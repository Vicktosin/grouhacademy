import { NextRequest, NextResponse } from "next/server";

import { grantTrackRole, TRACK_ROLE } from "@/lib/learner-roles";
import { parseTrack } from "@/lib/learner-tracks";
import {
  ensurePrismaUserForSupabaseAuth,
  getAuthorizedHomeRouteForUserId,
} from "@/lib/supabase/auth";
import {
  isMfaVerificationPending,
  MFA_CHALLENGE_PATH,
} from "@/lib/supabase/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordReferralRegistration } from "@/lib/referrals";

/**
 * Called right after sign-in. `?track=internship|courses` names the side
 * whose login or sign-up page was used: the user is added to that side and
 * sent to it. Without a track, they go to their usual workspace.
 */
export async function GET(request: NextRequest) {
  const track = parseTrack(new URL(request.url).searchParams.get("track"));
  const loginPath = track === "courses" ? "/courses/login" : "/login";
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return NextResponse.json({ redirectTo: loginPath }, { status: 401 });
    }

    // Joining a side only needs a verified login, so it happens before the
    // second factor; the destination below still waits for it.
    const userId = await ensurePrismaUserForSupabaseAuth(
      data.user,
      track ? TRACK_ROLE[track] : undefined,
    );
    if (track) await grantTrackRole(userId, track);
    try {
      await recordReferralRegistration(
        request,
        userId,
        new URL(request.url).searchParams.get("referralClick"),
      );
    } catch (referralError) {
      console.error("Failed to attribute internship registration:", referralError);
    }

    if (await isMfaVerificationPending(supabase, data.user)) {
      return NextResponse.json({ redirectTo: MFA_CHALLENGE_PATH });
    }

    const redirectTo = await getAuthorizedHomeRouteForUserId(userId, track);
    return NextResponse.json({ redirectTo });
  } catch (error) {
    console.error(
      "Failed to resolve redirect destination for authenticated session:",
      error,
    );

    return NextResponse.json({ redirectTo: loginPath }, { status: 500 });
  }
}
