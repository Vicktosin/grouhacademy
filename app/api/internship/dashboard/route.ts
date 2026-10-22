import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { computeInternProgress } from "@/lib/internship-progress";
import { getInternTaskContext, getInternTasks } from "@/lib/intern-tasks";
import { cohortTimeline } from "@/lib/task-schedule";
import { audienceWhere } from "@/lib/learner-audience";
import { requireInternshipWorkspace } from "@/lib/internship-access";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgoLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export async function GET() {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      include: {
        program: true,
        payment: true,
        attempts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return NextResponse.json(
        {
          error:
            "Complete internship onboarding before accessing the dashboard.",
          code: "ONBOARDING_REQUIRED",
        },
        { status: 403 },
      );
    }

    if (!application.onboardingAnswers) {
      return NextResponse.json(
        {
          error:
            "Complete internship onboarding before accessing the dashboard.",
          code: "ONBOARDING_REQUIRED",
        },
        { status: 403 },
      );
    }

    const { program } = application;
    const paymentStatus = application.payment?.status ?? "PENDING";
    const latestAttempt = application.attempts[0];
    const assessmentStatus = latestAttempt?.status ?? "NOT_STARTED";

    const cohorts = await prisma.internshipCohort.findMany({
      where: { programId: program.id },
      orderBy: { startDate: "asc" },
    });

    const now = new Date();
    const assignedCohort = application.cohortId
      ? (cohorts.find((cohort) => cohort.id === application.cohortId) ?? null)
      : null;
    const activeCohort =
      cohorts.find(
        (cohort) => cohort.startDate <= now && cohort.endDate >= now,
      ) ?? null;
    const nextCohort = cohorts.find((cohort) => cohort.startDate > now) ?? null;
    const displayCohort = assignedCohort ?? activeCohort ?? nextCohort;

    // Intern progress: tasks passed out of every task set for their cohort.
    const { completedTasks, totalTasks, progressPercent } =
      await computeInternProgress(userId, application.cohortId);
    const timeline = assignedCohort
      ? cohortTimeline(assignedCohort.startDate, assignedCohort.endDate, now)
      : null;

    // Credited submissions: the intern's own, or group work listing them.
    const creditedSubmission = {
      task: { cohortId: application.cohortId ?? "__none__" },
      OR: [
        { groupId: null, userId },
        { groupId: { not: null }, participants: { some: { userId } } },
      ],
    };

    // Average grade across this cohort's graded, credited submissions.
    const gradedSubmissions = await prisma.taskSubmission.findMany({
      where: { ...creditedSubmission, score: { not: null } },
      select: { score: true, task: { select: { maxScore: true } } },
    });
    const averageGradePercent = gradedSubmissions.length
      ? Math.round(
          gradedSubmissions.reduce(
            (sum, s) => sum + ((s.score ?? 0) / s.task.maxScore) * 100,
            0,
          ) / gradedSubmissions.length,
        )
      : null;

    // Next task still needing work: the earliest-opening one the intern can
    // submit now, otherwise the next to open (tasks come in opening order).
    const taskContext = await getInternTaskContext(userId);
    const internTasks = taskContext
      ? await getInternTasks(userId, taskContext)
      : [];
    const pendingTasks = internTasks.filter((task) => task.canSubmit).length;
    const upcomingTask =
      internTasks.find((task) => task.canSubmit) ??
      internTasks.find((task) => task.window === "UPCOMING") ??
      null;

    const mentorAssignment = await prisma.mentorAssignment.findFirst({
      where: { internId: userId, programId: program.id, status: "ACTIVE" },
      include: { mentor: { include: { mentorProfile: true } } },
    });

    const recentFeedback = await prisma.taskSubmission.findFirst({
      where: { ...creditedSubmission, feedback: { not: null } },
      orderBy: { reviewedAt: "desc" },
      include: { task: true },
    });

    const activeMentorIds = (
      await prisma.mentorAssignment.findMany({
        where: { internId: userId, status: "ACTIVE" },
        select: { mentorId: true },
      })
    ).map((a) => a.mentorId);

    const announcements = await prisma.announcement.findMany({
      where: {
        ...audienceWhere("internship"),
        AND: [
          {
            OR: [
              { scope: "GLOBAL" },
              ...(activeMentorIds.length
                ? [
                    {
                      scope: "MENTOR_MENTEES" as const,
                      authorId: { in: activeMentorIds },
                    },
                  ]
                : []),
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    // The shown cohort's own days (its first to the end of its last, WAT),
    // not whether some other cohort is running.
    const displayTimeline = displayCohort
      ? cohortTimeline(displayCohort.startDate, displayCohort.endDate, now)
      : null;
    const cohortStatus = !displayTimeline
      ? "COMPLETED"
      : !displayTimeline.started
        ? "UPCOMING"
        : displayTimeline.ended
          ? "COMPLETED"
          : "ACTIVE";

    return NextResponse.json({
      program: { name: program.name, slug: program.slug },
      paymentStatus,
      assessmentStatus,
      weekLabel: timeline
        ? timeline.started
          ? `Week ${timeline.weekNumber} of ${timeline.totalWeeks}`
          : `Starts in ${Math.max(1, Math.ceil((assignedCohort!.startDate.getTime() - now.getTime()) / 86_400_000))} day(s)`
        : "Awaiting cohort placement",
      cohortProgress: timeline
        ? {
            dayNumber: timeline.dayNumber,
            totalDays: timeline.totalDays,
            percent: timeline.percent,
            started: timeline.started,
            ended: timeline.ended,
          }
        : null,
      cohort: displayCohort && displayTimeline
        ? {
            status: cohortStatus,
            name: displayCohort.name,
            startDateLabel: formatDate(displayCohort.startDate),
            endDateLabel: formatDate(displayCohort.endDate),
            // For the dashboard's live countdown (to the start, then the end).
            startsAt: displayTimeline.startsAt.toISOString(),
            endsAt: displayTimeline.endsAt.toISOString(),
            description: displayCohort.description,
          }
        : null,
      startDateLabel: assignedCohort
        ? formatDate(assignedCohort.startDate)
        : "—",
      completionDateLabel: assignedCohort
        ? formatDate(assignedCohort.endDate)
        : "—",
      progressPercent,
      stats: { completedTasks, totalTasks, averageGradePercent, pendingTasks },
      currentTask: upcomingTask
        ? {
            title: upcomingTask.title,
            moduleTitle: upcomingTask.weekLabel,
            dueLabel: upcomingTask.dueDateLabel,
          }
        : null,
      mentor: mentorAssignment
        ? {
            name: mentorAssignment.mentor.name ?? "Your mentor",
            expertise: mentorAssignment.mentor.mentorProfile?.expertise ?? null,
          }
        : null,
      recentFeedback: recentFeedback
        ? {
            taskTitle: recentFeedback.task.title,
            score: recentFeedback.score,
            feedback: recentFeedback.feedback,
            timeAgoLabel: timeAgoLabel(
              recentFeedback.reviewedAt ?? recentFeedback.submittedAt,
            ),
          }
        : null,
      announcements: announcements.map((a) => ({
        title: a.title,
        postedLabel: timeAgoLabel(a.createdAt),
      })),
    });
  } catch (error) {
    console.error("Failed to load internship dashboard:", error);
    return NextResponse.json(
      { error: "Unable to load internship dashboard." },
      { status: 500 },
    );
  }
}
