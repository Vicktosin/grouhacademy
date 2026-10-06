import { NextResponse } from "next/server";
import { EnrollmentStatus, RoleName } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { getUserRBAC } from "@/lib/rbac";
import {
  getInternTrackAccess,
  internResourceWhere,
} from "@/lib/intern-resources";
import { isR2Configured, r2KeyFromVideoUrl, signedVideoUrl } from "@/lib/r2";

// Plays or downloads an uploaded lesson video. The player links here rather
// than to R2: this checks the viewer may see the lesson (enrolled in the
// course / intern on the resource's track / admin) and only then redirects
// to a short-lived signed R2 link. A shared link stops working once the
// signature expires.
//
//   /api/video?source=course|resource&type=lesson|module&id=…[&download=1]

const notFound = () =>
  NextResponse.json({ error: "Video not found." }, { status: 404 });

async function courseVideo(
  userId: string,
  isAdmin: boolean,
  type: string,
  id: string,
) {
  const prisma = getPrisma();
  const owner = await (type === "lesson"
    ? prisma.lesson.findUnique({
        where: { id },
        select: { videoUrl: true, module: { select: { courseId: true } } },
      })
    : prisma.courseModule.findUnique({
        where: { id },
        select: { videoUrl: true, courseId: true },
      }));
  if (!owner) return null;
  const courseId = "module" in owner ? owner.module.courseId : owner.courseId;

  if (!isAdmin) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        createdById: true,
        instructors: { select: { instructorId: true } },
      },
    });
    // The course's own creator/instructors can watch it too.
    const ownsCourse =
      course?.createdById === userId ||
      course?.instructors.some((item) => item.instructorId === userId);
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { status: true },
    });
    const enrolled =
      enrollment?.status === EnrollmentStatus.ACTIVE ||
      enrollment?.status === EnrollmentStatus.COMPLETED;
    if (!enrolled && !ownsCourse) return null;
  }
  return owner.videoUrl;
}

async function resourceVideo(
  userId: string,
  isAdmin: boolean,
  type: string,
  id: string,
) {
  const prisma = getPrisma();
  const owner = await (type === "lesson"
    ? prisma.internResourceLesson.findUnique({
        where: { id },
        select: { videoUrl: true, module: { select: { resourceId: true } } },
      })
    : prisma.internResourceModule.findUnique({
        where: { id },
        select: { videoUrl: true, resourceId: true },
      }));
  if (!owner) return null;
  const resourceId =
    "module" in owner ? owner.module.resourceId : owner.resourceId;

  if (!isAdmin) {
    // Same rule as the Resources pages: published and on the intern's track.
    const visible = await prisma.internResource.findFirst({
      where: {
        id: resourceId,
        ...internResourceWhere(await getInternTrackAccess(userId)),
      },
      select: { id: true },
    });
    if (!visible) return null;
  }
  return owner.videoUrl;
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  const params = new URL(request.url).searchParams;
  const source = params.get("source");
  const type = params.get("type");
  const id = params.get("id");
  if (
    (source !== "course" && source !== "resource") ||
    (type !== "lesson" && type !== "module") ||
    !id
  )
    return notFound();

  const { roles } = await getUserRBAC(userId);
  const isAdmin = roles.includes(RoleName.ADMIN);
  const videoUrl =
    source === "course"
      ? await courseVideo(userId, isAdmin, type, id)
      : await resourceVideo(userId, isAdmin, type, id);
  const key = r2KeyFromVideoUrl(videoUrl);
  if (!key) return notFound();

  if (!isR2Configured())
    return NextResponse.json(
      { error: "Video storage isn't set up on this server." },
      { status: 503 },
    );

  const response = NextResponse.redirect(
    await signedVideoUrl(key, params.get("download") === "1"),
  );
  // The signed link is specific to this viewer and expires.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
