import { RoleName } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/route-guards";
import { userHasRole } from "@/lib/rbac";
import { isAssignedIntern } from "@/lib/mentor-data";
import { mediaOwner } from "@/lib/lab-media-shared";
import { labImageResponse } from "@/lib/lab-media";

/**
 * Shows a Practice Lab image to the intern who uploaded it, admins, and
 * mentors assigned to that intern. Redirects to a short-lived link to the
 * private bucket, so the image's bytes don't pass through this server.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const key = (await params).key.join("/");
  const owner = mediaOwner(key);
  if (!owner) return new Response("Not found", { status: 404 });
  const userId = await getCurrentUserId();
  if (!userId) return new Response("Sign in to see this image.", { status: 401 });
  const allowed =
    userId === owner ||
    (await userHasRole(userId, RoleName.ADMIN)) ||
    ((await userHasRole(userId, RoleName.MENTOR)) && (await isAssignedIntern(userId, owner)));
  if (!allowed) return new Response("Not allowed.", { status: 403 });
  return labImageResponse(key);
}
