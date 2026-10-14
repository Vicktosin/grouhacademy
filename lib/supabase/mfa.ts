import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isStaffWorkspace } from "@/lib/learner-tracks";
import { isSafeInternalPath } from "@/lib/safe-redirect";

export const MFA_CHALLENGE_PATH = "/auth/mfa";

/**
 * Destinations the auth callback and MFA challenge may forward to after
 * sign-in. Anything else falls back to the user's role-based home route.
 */
export function isAllowedPostAuthPath(path: string | null): path is string {
  if (!isSafeInternalPath(path)) return false;
  const { pathname } = new URL(path, "http://placeholder.invalid");
  return (
    pathname === "/reset-password" ||
    pathname.startsWith("/internship/") ||
    pathname === "/student" ||
    pathname.startsWith("/student/")
  );
}

export function isPasswordRecoveryPath(path: string | null): path is string {
  return (
    isAllowedPostAuthPath(path) &&
    new URL(path, "http://placeholder.invalid").pathname === "/reset-password"
  );
}

export function getPostAuthDestination(
  next: string | null,
  home: string | null,
): string | null {
  if (isPasswordRecoveryPath(next)) return next;
  if (isStaffWorkspace(home)) return home;
  return isAllowedPostAuthPath(next) ? next : home;
}

/**
 * True when the user has a verified MFA factor but the current session has
 * only completed the first factor (AAL1).
 *
 * `user` must come from `supabase.auth.getUser()`, which is verified by the
 * Supabase Auth server. The session cookie's copy of the user (used by
 * `mfa.getAuthenticatorAssuranceLevel()` without a JWT) is client-controlled
 * and must not be trusted to report whether factors exist.
 */
export function hasVerifiedFactor(user: Pick<User, "factors">): boolean {
  return user.factors?.some((factor) => factor.status === "verified") ?? false;
}

export async function isMfaVerificationPending(
  supabase: Pick<SupabaseClient, "auth">,
  user: Pick<User, "factors">,
): Promise<boolean> {
  if (!hasVerifiedFactor(user)) {
    return false;
  }

  const { data, error } = await supabase.auth.getClaims();

  // Fail closed: if the session's assurance level cannot be verified, the
  // user must complete the challenge again.
  if (error || !data) {
    return true;
  }

  return data.claims.aal !== "aal2";
}
