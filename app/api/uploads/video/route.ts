import { NextResponse } from "next/server";
import { RoleName } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/route-guards";
import { getUserRBAC } from "@/lib/rbac";
import { MAX_VIDEO_BYTES, createVideoUpload, isR2Configured } from "@/lib/r2";

/**
 * Starts a lesson video upload: returns a signed URL the browser PUTs the
 * file to, and the value to save as the lesson's videoUrl.
 * Body: { fileName, contentType, size, folder: "courses" | "resources" }.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  const body = (await request.json().catch(() => null)) as {
    fileName?: unknown;
    contentType?: unknown;
    size?: unknown;
    folder?: unknown;
  } | null;
  const folder = body?.folder;
  if (folder !== "courses" && folder !== "resources")
    return NextResponse.json(
      { error: "Unknown upload type." },
      { status: 400 },
    );

  // Internship resources are built by admins and Support Admins; courses
  // by admins and instructors.
  const { roles } = await getUserRBAC(userId);
  const allowed =
    roles.includes(RoleName.ADMIN) ||
    (folder === "resources" && roles.includes(RoleName.SUPPORT_ADMIN)) ||
    (folder === "courses" && roles.includes(RoleName.INSTRUCTOR));
  if (!allowed)
    return NextResponse.json(
      { error: "You can't upload videos here." },
      { status: 403 },
    );

  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const contentType =
    typeof body?.contentType === "string" ? body.contentType : "";
  const size = typeof body?.size === "number" ? body.size : 0;
  if (!fileName || !contentType.startsWith("video/"))
    return NextResponse.json(
      { error: "Choose a video file (for example an MP4)." },
      { status: 400 },
    );
  if (size <= 0 || size > MAX_VIDEO_BYTES)
    return NextResponse.json(
      { error: "Videos must be smaller than 5 GB." },
      { status: 400 },
    );

  if (process.env.NEXT_PUBLIC_VIDEO_UPLOADS_ENABLED !== "true")
    return NextResponse.json(
      { error: "Video uploads are turned off." },
      { status: 503 },
    );

  if (!isR2Configured())
    return NextResponse.json(
      {
        error:
          "Video uploads aren't set up yet. Add the Cloudflare R2 settings to the server environment.",
      },
      { status: 503 },
    );

  return NextResponse.json(
    await createVideoUpload(folder, fileName, contentType),
  );
}
