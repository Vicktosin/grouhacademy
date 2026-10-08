import { NextResponse } from "next/server";
import { RoleName } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/route-guards";
import { hasInternshipWorkspaceAccess } from "@/lib/internship-access";
import { userHasRole } from "@/lib/rbac";
import { MAX_MEDIA_BYTES, mediaSrc } from "@/lib/lab-media-shared";
import { MediaError, saveLabImage } from "@/lib/lab-media";

/**
 * Uploads an ad image for the Practice Lab (interns, and admins trying
 * exercises). Body: the image itself, already shrunk by the browser.
 * Returns { ref, src }: the reference to save and the URL to show it.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (
    !(await hasInternshipWorkspaceAccess(userId)) &&
    !(await userHasRole(userId, RoleName.ADMIN))
  )
    return NextResponse.json({ error: "The Practice Lab is for admitted interns." }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_MEDIA_BYTES)
    return NextResponse.json({ error: "Images must be under 600 KB." }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    const ref = await saveLabImage(userId, bytes);
    return NextResponse.json({ ref, src: mediaSrc(ref) });
  } catch (error) {
    if (error instanceof MediaError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[lab-media] Upload failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The image couldn't be uploaded. Try again." }, { status: 500 });
  }
}
