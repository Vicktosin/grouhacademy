import { RoleName, SubmissionStatus } from "@/generated/prisma/client";
import { MentorPage, MentorStat } from "@/components/MentorPage";
import { getPrisma } from "@/lib/prisma";
import { requireRouteAccess } from "@/lib/route-guards";

export default async function MentorAnalyticsPage() {
  const mentorId = await requireRouteAccess({
    requiredRoles: [RoleName.MENTOR],
    redirectTo: "/login",
  });
  const prisma = getPrisma();
  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId, status: "ACTIVE" },
    select: { internId: true },
  });
  const internIds = assignments.map((assignment) => assignment.internId);
  const [attempts, submissions, progress] = await Promise.all([
    prisma.assessmentAttempt.findMany({
      where: { application: { studentId: { in: internIds } } },
      select: { status: true, scorePercent: true },
    }),
    prisma.taskSubmission.findMany({
      where: { userId: { in: internIds } },
      select: { status: true },
    }),
    prisma.internshipProgress.findMany({
      where: { userId: { in: internIds } },
      select: { progressPercent: true },
    }),
  ]);
  const scoredAttempts = attempts.filter(
    (attempt) => attempt.scorePercent != null,
  );
  const completedTasks = submissions.filter(
    (submission) => submission.status === SubmissionStatus.ACCEPTED,
  ).length;
  const passRate = attempts.length
    ? Math.round(
        (attempts.filter((attempt) => attempt.status === "PASSED").length /
          attempts.length) *
          100,
      )
    : 0;
  const averageScore = scoredAttempts.length
    ? Math.round(
        scoredAttempts.reduce(
          (sum, attempt) => sum + (attempt.scorePercent ?? 0),
          0,
        ) / scoredAttempts.length,
      )
    : 0;
  const averageProgress = progress.length
    ? Math.round(
        progress.reduce((sum, item) => sum + item.progressPercent, 0) /
          progress.length,
      )
    : 0;

  return (
    <MentorPage
      title="Mentor analytics"
      description="Live performance data for interns assigned to you."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MentorStat
          label="Active interns"
          value={String(internIds.length)}
          detail="Current assignments"
        />
        <MentorStat
          label="Completed tasks"
          value={String(completedTasks)}
          detail="Accepted submissions"
        />
        <MentorStat
          label="Assessment pass rate"
          value={`${passRate}%`}
          detail={`${attempts.length} attempts`}
        />
        <MentorStat
          label="Average progress"
          value={`${averageProgress}%`}
          detail={`Assessment average ${averageScore}%`}
        />
      </div>
    </MentorPage>
  );
}
