import { NextResponse } from "next/server";
import { getCurrentUserId, isCurrentUserMfaPending, isPreviewSession } from "@/lib/route-guards";
import { describePreviewIntern } from "@/lib/preview-intern";
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
  /** An admin previewing the internship (the banner): where they're placed. */
  preview?: { track: string; level: string; cohort: string | null } | null;
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
  const accessStatusLoad = getInternshipAccessStatus(userId);
  const [workspace, accessStatus, profile, unreadCount, preview] = await Promise.all([
    settle(
      internshipWorkspaceRedirect(userId).then((redirect) => ({ redirect })),
      "workspace access",
    ),
    settle(accessStatusLoad, "access status"),
    settle(
      Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
        // Same as /api/internship/profile: the latest application's tier,
        // which the access status has already loaded.
        accessStatusLoad,
      ]).then(([user, status]) =>
        user
          ? {
              name: user.name ?? "",
              avatarUrl: user.avatarUrl,
              tier: status.premiumTier !== "NONE" ? ("Premium" as const) : ("Free" as const),
            }
          : null,
      ),
      "profile",
    ),
    settle(
      prisma.notification.count({ where: { userId, read: false, ...audienceWhere("internship") } }),
      "unread count",
    ),
    isPreviewSession().then((preview) => (preview ? describePreviewIntern(userId) : null)),
  ]);

  return NextResponse.json({ workspace, accessStatus, profile, unreadCount, preview } satisfies ShellData);
}
