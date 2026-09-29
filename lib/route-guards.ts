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
import { ensurePrismaUserForSupabaseAuth } from "@/lib/supabase/auth";
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
};

/**
 * Memoised per request: layouts, pages and permission checks that all ask
 * for the current user share one Supabase getUser call and one Prisma sync.
 */
const resolveCurrentUser = cache(loadCurrentUser);

async function loadCurrentUser(): Promise<CurrentUser | null> {
  if (isDevelopmentBypassEnabled()) {
    const developmentRole = await getDevelopmentAuthRole();

    if (developmentRole) {
      return {
        userId: await ensureDevelopmentUser(developmentRole),
        mfaPending: false,
      };
    }
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const mfaPending = await isMfaVerificationPending(supabase, user);

  try {
    return {
      userId: await ensurePrismaUserForSupabaseAuth(user),
      mfaPending,
    };
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
 * - Get the authenticated Supabase user.
 * - Treat the session as unauthenticated when the user has MFA enrolled
 *   but has not completed the second factor.
 * - Synchronize the Supabase user into Prisma and return their ID.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const currentUser = await resolveCurrentUser();

  return currentUser && !currentUser.mfaPending ? currentUser.userId : null;
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
