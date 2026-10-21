import { NextResponse } from "next/server";

import { RoleName } from "@/generated/prisma/client";
import { userHasRole } from "@/lib/rbac";
import { getCurrentUserId } from "@/lib/route-guards";

/**
 * The single admin check for API route handlers. Every admin endpoint must
 * start with it:
 *
 *   const adminId = await requireAdminApi();
 *   if (adminId instanceof NextResponse) return adminId;
 *
 * Returns the administrator's user id, or a 403 response to return as-is
 * when the caller is signed out, mid-MFA, or not an administrator.
 */
export async function requireAdminApi(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();

  if (userId && (await userHasRole(userId, RoleName.ADMIN))) {
    return userId;
  }

  return NextResponse.json(
    { error: "Administrator access is required." },
    { status: 403 },
  );
}

/**
 * For the endpoints Support Admins share with admins (resources, banners,
 * groups, follow-ups). Returns who is asking and whether they are a full
 * admin, so the endpoint can refuse what only admins may do (publishing,
 * deleting, removing group members…). Everything else stays requireAdminApi.
 */
export async function requireSupportOrAdminApi(): Promise<
  { userId: string; isMainAdmin: boolean } | NextResponse
> {
  const userId = await getCurrentUserId();
  if (userId) {
    const isMainAdmin = await userHasRole(userId, RoleName.ADMIN);
    if (isMainAdmin || (await userHasRole(userId, RoleName.SUPPORT_ADMIN)))
      return { userId, isMainAdmin };
  }
  return NextResponse.json(
    { error: "Administrator access is required." },
    { status: 403 },
  );
}

/** The 403 for what a Support Admin may not do. */
export function adminOnly(action: string) {
  return NextResponse.json(
    { error: `Only an administrator can ${action}.` },
    { status: 403 },
  );
}

/**
 * The mentor equivalent of requireAdminApi(): returns the mentor's user id,
 * or a 403 response. Callers must still check that the intern or record
 * being accessed is assigned to this mentor.
 */
export async function requireMentorApi(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId();

  if (userId && (await userHasRole(userId, RoleName.MENTOR))) {
    return userId;
  }

  return NextResponse.json(
    { error: "Mentor access is required." },
    { status: 403 },
  );
}
