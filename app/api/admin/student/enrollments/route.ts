import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const enrollments = await getPrisma().enrollment.findMany({
    orderBy: { enrolledAt: "desc" },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      completedAt: true,
      user: {
        select: {
          name: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } },
          courseProgress: { select: { courseId: true, progressPercent: true } },
        },
      },
      course: {
        select: {
          id: true,
          title: true,
          instructors: { select: { instructor: { select: { name: true } } } },
        },
      },
    },
  });
  return NextResponse.json({
    enrollments: enrollments.map((item) => ({
      id: item.id,
      status: item.status,
      enrolledAt: item.enrolledAt.toISOString(),
      completedAt: item.completedAt?.toISOString() ?? null,
      student:
        item.user.name ||
        [item.user.profile?.firstName, item.user.profile?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "Unnamed learner",
      email: item.user.email,
      course: item.course.title,
      instructor:
        item.course.instructors
          .map(({ instructor }) => instructor.name)
          .filter(Boolean)
          .join(", ") || "Unassigned",
      progress:
        item.user.courseProgress.find(
          (progress) => progress.courseId === item.course.id,
        )?.progressPercent ?? 0,
    })),
  });
}
