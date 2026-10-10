import { NextResponse } from "next/server";
import { getCurrentUserId, isCurrentUserMfaPending } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import {
  getInternshipAccessStatus,
  internshipWorkspaceRedirect,
  type InternshipAccessStatus,
} from "@/lib/internship-access";
import { audienceWhere } from "@/lib/learner-audience";

// Everything the internship pages' shell needs, in one request: whether
// the user may use the workspace (the dashboard's pages are static files,
// so the browser redirects anyone who may not, including to the second
// sign-in step), access status (paywall), the sidebar's and header's name,
// photo and tier, and the bell's unread count. Each was its own request on every page view, and each
// request pays for the sign-in check again (Vercel bills the CPU). The client
// cache (lib/client-cache) hands each part to the component that asked for
// its old URL. A part that fails is null, and the client then asks that old
// route instead, so one failure never blanks the others.

export type ShellData = {
  /** Where to send someone without workspace access (null: an intern with
   *  access). The whole field is null when it couldn't be worked out. */
  workspace: { redirect: string | null } | null;
  accessStatus: InternshipAccessStatus | null;
  profile: { name: string; avatarUrl: string | null; tier: "Premium" | "Free" } | null;
  unreadCount: number | null;
  /** Signed in, but the second sign-in step (MFA) is still to be done:
   *  everything else is null, and the page sends them to do it. */
  mfaRequired?: true;
};

const settle = <T,>(promise: Promise<T>, part: string) =>
  promise.catch((error: unknown) => {
    console.error(`Shell: failed to load ${part}:`, error);
    return null;
  });

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    if (await isCurrentUserMfaPending()) {
      return NextResponse.json({
        workspace: null,
        accessStatus: null,
        profile: null,
        unreadCount: null,
        mfaRequired: true,
      } satisfies ShellData);
    }
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const prisma = getPrisma();
  const [workspace, accessStatus, profile, unreadCount] = await Promise.all([
    settle(
      internshipWorkspaceRedirect(userId).then((redirect) => ({ redirect })),
      "workspace access",
    ),
    settle(getInternshipAccessStatus(userId), "access status"),
    settle(
      Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
        // Same as /api/internship/profile: the latest application's tier.
        prisma.internshipApplication.findFirst({
          where: { studentId: userId },
          orderBy: { createdAt: "desc" },
          select: { premiumTier: true },
        }),
      ]).then(([user, application]) =>
        user
          ? {
              name: user.name ?? "",
              avatarUrl: user.avatarUrl,
              tier: application && application.premiumTier !== "NONE" ? ("Premium" as const) : ("Free" as const),
            }
          : null,
      ),
      "profile",
    ),
    settle(
      prisma.notification.count({ where: { userId, read: false, ...audienceWhere("internship") } }),
      "unread count",
    ),
  ]);

  return NextResponse.json({ workspace, accessStatus, profile, unreadCount } satisfies ShellData);
}
