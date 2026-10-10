import { redirect } from "next/navigation";
import { cache } from "react";
import { RoleName } from "@/generated/prisma/client";
import {
  getDevelopmentRolePermissions,
  getDevelopmentAuthRole,
  isDevelopmentBypassEnabled,
  ensureDevelopmentUser,
} from "@/lib/dev-auth";
import { userHasPermission, userHasRole } from "@/lib/rbac";
import { ensurePrismaUserWithRoles } from "@/lib/supabase/auth";
import { hasVerifiedFactorInDatabase } from "@/lib/supabase/mfa-db";
import { previewInternForRequest } from "@/lib/preview-intern";
import {
  isMfaVerificationPending,
  MFA_CHALLENGE_PATH,
} from "@/lib/supabase/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteAccessOptions = {
  requiredRoles?: RoleName[];
  requiredPermissions?: string[];
  redirectTo?: string;
};

type CurrentUser = {
  userId: string;
  mfaPending: boolean;
  /** Admins may experience the internship as their preview intern. */
  isAdmin?: boolean;
  /** This is an admin's preview intern (the admin is previewing). */
  preview?: boolean;
};

/**
 * Memoised per request: layouts, pages and permission checks that all ask
 * for the current user share one sign-in check and one Prisma sync.
 */
const resolveCurrentUser = cache(loadCurrentUser);

/**
 * The signed-in user, except that an admin experiencing the internship as
 * their preview intern ("Experience as intern", lib/preview-intern) is that
 * intern on the intern side's pages and APIs. Only ever an admin's own
 * preview intern; admin pages stay the admin's.
 */
async function loadCurrentUser(): Promise<CurrentUser | null> {
  const user = await loadSignedInUser();
  if (!user || user.mfaPending || !user.isAdmin) return user;
  const previewId = await previewInternForRequest(user.userId);
  return previewId ? { userId: previewId, mfaPending: false, preview: true } : user;
}

// The sign-in token's signature is verified here, with Supabase's public
// key (cached for 10 minutes), instead of asking Supabase Auth on every
// request: those requests were over 90% of the project's Supabase log
// volume. A token can't be forged or altered, and it expires (its lifetime
// is set in Supabase), so a session cut off elsewhere (a ban, a deleted
// account, "sign out everywhere") is refused once its token expires, not
// at once. Admins can do the most, so they're still checked with Supabase
// Auth on every request. Signing out deletes the token (refused at once),
// and an intern's removal is checked in our own database.
async function loadSignedInUser(): Promise<CurrentUser | null> {
  if (isDevelopmentBypassEnabled()) {
    const developmentRole = await getDevelopmentAuthRole();

    if (developmentRole) {
      return {
        userId: await ensureDevelopmentUser(developmentRole),
        mfaPending: false,
        isAdmin: developmentRole === RoleName.ADMIN,
      };
    }
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return null;
  }

  try {
    const passedMfa = claims.aal === "aal2";
    const [user, hasFactor] = await Promise.all([
      ensurePrismaUserWithRoles({
        id: claims.sub,
        email: claims.email,
        user_metadata: claims.user_metadata,
      }),
      // A session that hasn't done the second step is only let in when the
      // user has no second step set up.
      passedMfa ? false : hasVerifiedFactorInDatabase(claims.sub),
    ]);

    if (user.roles.includes(RoleName.ADMIN)) {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !authUser || authUser.id !== claims.sub) {
        return null;
      }
      return {
        userId: user.id,
        mfaPending: await isMfaVerificationPending(supabase, authUser),
        isAdmin: true,
      };
    }

    return { userId: user.id, mfaPending: !passedMfa && hasFactor };
  } catch (syncError) {
    console.error(
      "Failed to synchronize Supabase auth user with Prisma:",
      syncError,
    );
    return null;
  }
}

/**
 * Get the currently authenticated user's ID.
 *
 * Development:
 * - If DEV_AUTH_BYPASS is enabled, return the development
 *   user's real Prisma ID so API routes that need database
 *   relations continue to work.
 *
 * Production:
 * - Verify the sign-in token (admins: also with Supabase Auth).
 * - Treat the session as unauthenticated when the user has MFA enrolled
 *   but has not completed the second factor.
 * - Synchronize the Supabase user into Prisma and return their ID.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const currentUser = await resolveCurrentUser();

  return currentUser && !currentUser.mfaPending ? currentUser.userId : null;
}

/** An admin experiencing the internship as their preview intern. */
export async function isPreviewSession(): Promise<boolean> {
  return (await resolveCurrentUser())?.preview === true;
}

/** Signed in, but the second sign-in step (MFA) is still to be done. */
export async function isCurrentUserMfaPending(): Promise<boolean> {
  return (await resolveCurrentUser())?.mfaPending === true;
}

/**
 * Protect server-rendered routes.
 *
 * In development, the role cookie is trusted when the development
 * bypass is enabled. This avoids a database lookup just to render
 * a protected page.
 *
 * In production, the real authenticated user's database RBAC
 * permissions are checked.
 */
export async function requireRouteAccess({
  requiredRoles = [],
  requiredPermissions = [],
  redirectTo = "/login",
}: RouteAccessOptions = {}): Promise<string> {
  /*
   * DEVELOPMENT BYPASS
   *
   * The role cookie is trusted only while the bypass is enabled. The
   * returned identity still maps to a real Prisma User so downstream
   * domain queries can safely use it as a UUID foreign key.
   */
  if (isDevelopmentBypassEnabled()) {
    const developmentRole = await getDevelopmentAuthRole();

    if (developmentRole) {
      if (
        requiredRoles.length > 0 &&
        !requiredRoles.includes(developmentRole)
      ) {
        redirect(redirectTo);
      }

      if (requiredPermissions.length > 0) {
        const permissions =
          await getDevelopmentRolePermissions(developmentRole);
        const hasRequiredPermission = requiredPermissions.some((permission) =>
          permissions.includes(permission),
        );

        if (!hasRequiredPermission) {
          redirect(redirectTo);
        }
      }

      return ensureDevelopmentUser(developmentRole);
    }
  }

  /*
   * REAL AUTHENTICATION
   */
  const currentUser = await resolveCurrentUser();

  if (!currentUser) {
    redirect(redirectTo);
  }

  if (currentUser.mfaPending) {
    redirect(MFA_CHALLENGE_PATH);
  }

  const { userId } = currentUser;

  if (requiredRoles.length > 0) {
    const hasRequiredRole = await userHasRole(userId, requiredRoles);

    if (!hasRequiredRole) {
      redirect(redirectTo);
    }
  }

  if (requiredPermissions.length > 0) {
    const hasRequiredPermission = await userHasPermission(
      userId,
      requiredPermissions,
    );

    if (!hasRequiredPermission) {
      redirect(redirectTo);
    }
  }

  return userId;
}
