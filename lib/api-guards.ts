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
