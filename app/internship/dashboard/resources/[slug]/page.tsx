import { notFound, redirect } from "next/navigation";
import CourseLearningPlayer, {
  type LearnCourseData,
} from "@/components/CourseLearningPlayer";
import InternshipShell from "@/components/InternshipShell";
import { getCurrentUserId } from "@/lib/route-guards";
import { getResourceForIntern, resourceProgress } from "@/lib/intern-resources";
import { lessonVideoSrc } from "@/lib/video-embed";

export default async function InternResourcePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  // A resource from another track (or an unpublished one) is a 404, so a
  // direct link can't be used to read it.
  const resource = await getResourceForIntern(userId, (await params).slug);
  if (!resource) notFound();

  const progress = await resourceProgress(userId, resource);
  const data: LearnCourseData = {
    slug: resource.slug,
    title: resource.title,
    modules: resource.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      videoUrl: lessonVideoSrc(
        module.videoUrl,
        "resource",
        "module",
        module.id,
      ),
      content: module.content,
      resources: module.materials.map(({ id, title, url }) => ({
        id,
        title,
        url,
      })),
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        videoUrl: lessonVideoSrc(
          lesson.videoUrl,
          "resource",
          "lesson",
          lesson.id,
        ),
        content: lesson.content,
        resources: lesson.materials.map(({ id, title, url }) => ({
          id,
          title,
          url,
        })),
        complete: progress.completedLessonIds.has(lesson.id),
      })),
    })),
  };

  return (
    <InternshipShell>
      <CourseLearningPlayer
        course={data}
        initialCompletedLessons={progress.completedLessons}
        initialTotalLessons={progress.totalLessons}
        initialProgressPercent={progress.progressPercent}
        itemLabel="Resource"
        backHref="/internship/dashboard/resources"
        lessonsApiPath={`/api/internship/resources/${resource.slug}/lessons`}
      />
    </InternshipShell>
  );
}
