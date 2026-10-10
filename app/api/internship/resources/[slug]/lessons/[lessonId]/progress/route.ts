import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  getResourceForIntern,
  resourceLessonIds,
  resourceProgress,
} from "@/lib/intern-resources";
import { requireInternshipWorkspace } from "@/lib/internship-access";

/** Marks a lesson complete (or not) for the signed-in intern. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; lessonId: string }> },
) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  const { slug, lessonId } = await params;
  // Only resolves for a published resource on the intern's own track, so
  // progress can't be recorded against another track's lessons.
  const resource = await getResourceForIntern(userId, slug);
  if (!resource || !resourceLessonIds(resource).includes(lessonId))
    return NextResponse.json(
      { error: "Lesson not found." },
      { status: 404 },
    );

  const body = (await request.json().catch(() => null)) as {
    completed?: unknown;
  } | null;
  if (!body)
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  const completed = body.completed === true;

  await getPrisma().internResourceLessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: {
      userId,
      lessonId,
      completed,
      completedAt: completed ? new Date() : null,
    },
  });

  const progress = await resourceProgress(userId, resource);
  return NextResponse.json({
    completed,
    completedLessons: progress.completedLessons,
    totalLessons: progress.totalLessons,
    progressPercent: progress.progressPercent,
  });
}
