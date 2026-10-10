import { NextResponse } from "next/server";
import {
  AnnouncementScope,
  AssessmentAttemptStatus,
  InternshipApplicationStatus,
  InternshipPaymentStatus,
  InternshipProgramStatus,
  MentorAssignmentStatus,
  RoleName,
} from "@/generated/prisma/client";
import { audienceWhere } from "@/lib/learner-audience";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { REAL_USER } from "@/lib/real-user";

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

type LeaderboardEntry = {
  name: string;
  metric: number;
  learners: number;
  detail: string;
};

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();

  const fallbackDashboard = {
    overview: [
      { value: "0", label: "Registered internship applicants" },
      { value: "0%", label: "Current cohort progress" },
      { value: "0%", label: "Exam success rate" },
      { value: "₦0", label: "Total acceptance fee revenue" },
      { value: "0", label: "Exam takers" },
      { value: "0", label: "Active interns" },
      { value: "0", label: "Active mentors" },
      { value: "0", label: "Active internship programs" },
    ],
    programPerformance: [],
    priorityActions: [],
    recentActivity: [],
    mentorLoad: [],
    topCohorts: [],
    topTracks: [],
  };

  try {
    const [
      totalRegisteredApplicants,
      activeInterns,
      activePrograms,
      activeMentors,
      cohortProgress,
      examAttempts,
      activeMentorAssignments,
      recentApplications,
      recentPayments,
      recentAnnouncements,
      paidInternshipFees,
      passedAssessments,
    ] = await Promise.all([
      prisma.internshipApplication.count({ where: { student: REAL_USER } }),
      prisma.internshipApplication.count({
        where: { status: InternshipApplicationStatus.ACTIVE, student: REAL_USER },
      }),
      prisma.internshipProgram.count({
        where: { status: InternshipProgramStatus.PUBLISHED },
      }),
      prisma.user.count({
        where: { roles: { some: { role: { name: RoleName.MENTOR } } } },
      }),
      prisma.internshipProgress.aggregate({
        where: { user: REAL_USER },
        _avg: { progressPercent: true },
      }),
      prisma.assessmentAttempt.count({
        where: {
          status: { not: AssessmentAttemptStatus.NOT_STARTED },
          application: { student: REAL_USER },
        },
      }),
      prisma.mentorAssignment.groupBy({
        by: ["mentorId"],
        where: { status: MentorAssignmentStatus.ACTIVE },
        _count: { _all: true },
      }),
      prisma.internshipApplication.findMany({
        where: { status: InternshipApplicationStatus.ACTIVE, student: REAL_USER },
        include: {
          student: { select: { name: true } },
          program: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.internshipPayment.findMany({
        where: {
          status: {
            in: [InternshipPaymentStatus.PAID, InternshipPaymentStatus.PENDING],
          },
          application: { student: REAL_USER },
        },
        include: {
          application: {
            include: {
              student: { select: { name: true } },
              program: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.announcement.findMany({
        // Internship and site-wide announcements (not course ones).
        where: {
          scope: AnnouncementScope.GLOBAL,
          ...audienceWhere("internship"),
        },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.internshipPayment.aggregate({
        _sum: { amount: true },
        where: { status: InternshipPaymentStatus.PAID, application: { student: REAL_USER } },
      }),
      prisma.assessmentAttempt.count({
        where: { status: AssessmentAttemptStatus.PASSED, application: { student: REAL_USER } },
      }),
    ]);

    const currentCohortProgress = Math.round(
      cohortProgress._avg.progressPercent ?? 0,
    );
    const examSuccessRate =
      examAttempts === 0
        ? 0
        : Math.round((passedAssessments / examAttempts) * 100);
    const totalAcceptanceFeeRevenue = paidInternshipFees._sum.amount ?? 0;

    const atRiskInterns = await prisma.internshipProgress.count({
      where: { progressPercent: { lt: 40 }, user: REAL_USER },
    });

    const [programPerformance, programProgress] = await Promise.all([
      prisma.internshipProgram.findMany({
        where: { status: InternshipProgramStatus.PUBLISHED },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              applications: {
                where: { status: InternshipApplicationStatus.ACTIVE, student: REAL_USER },
              },
            },
          },
        },
      }),
      prisma.internshipProgress.groupBy({
        by: ["programId"],
        where: { user: REAL_USER },
        _avg: { progressPercent: true },
      }),
    ]);
    const averageProgressByProgram = new Map(
      programProgress.map((row) => [
        row.programId,
        Math.round(row._avg.progressPercent ?? 0),
      ]),
    );

    const programMetrics = programPerformance.map((program) => {
      const metricAvg = averageProgressByProgram.get(program.id) ?? 0;
      const learners = program._count.applications;
      return {
        name: program.name,
        learners,
        value: `${metricAvg}%`,
        detail: `${learners} active learners`,
        bar: Math.min(100, Math.max(0, metricAvg)),
      };
    });

    const cohortPerformance = await prisma.internshipCohort.findMany({
      where: { applications: { some: { student: REAL_USER } } },
      include: {
        program: { select: { name: true } },
        applications: {
          where: { status: InternshipApplicationStatus.ACTIVE, student: REAL_USER },
          select: { studentId: true, programId: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    // One progress query for every active intern across all cohorts, rather
    // than one query per cohort.
    const activeCohortInterns = cohortPerformance.flatMap(
      (cohort) => cohort.applications,
    );
    const cohortProgressRows = activeCohortInterns.length
      ? await prisma.internshipProgress.findMany({
          where: {
            OR: activeCohortInterns.map((application) => ({
              userId: application.studentId,
              programId: application.programId,
            })),
          },
          select: { userId: true, programId: true, progressPercent: true },
        })
      : [];
    const progressByIntern = new Map(
      cohortProgressRows.map((row) => [
        `${row.userId}:${row.programId}`,
        row.progressPercent,
      ]),
    );

    const topCohorts: LeaderboardEntry[] = cohortPerformance
      .map((cohort) => ({
        name: cohort.name,
        metric: average(
          cohort.applications.flatMap((application) => {
            const progress = progressByIntern.get(
              `${application.studentId}:${application.programId}`,
            );
            return progress === undefined ? [] : [progress];
          }),
        ),
        learners: cohort.applications.length,
        detail: `${cohort.program.name} • ${cohort.applications.length} active learners`,
      }))
      .filter((entry) => entry.learners > 0)
      .sort((a, b) => b.metric - a.metric)
      .slice(0, 3);

    const topTracks: LeaderboardEntry[] = [...programMetrics]
      .sort(
        (a, b) => Number.parseInt(b.value, 10) - Number.parseInt(a.value, 10),
      )
      .slice(0, 3)
      .map((program) => ({
        name: program.name,
        metric: Number.parseInt(program.value, 10),
        learners: program.learners,
        detail: `${program.learners} active learners`,
      }));

    // Counted in the database; only the three busiest mentors are loaded.
    const busiestMentors = [...activeMentorAssignments]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 3);
    const mentorLoad = await Promise.all(
      busiestMentors.map(async ({ mentorId, _count }) => {
        const latestAssignment = await prisma.mentorAssignment.findFirst({
          where: { mentorId, status: MentorAssignmentStatus.ACTIVE },
          orderBy: { createdAt: "desc" },
          include: {
            mentor: { select: { name: true } },
            program: { select: { name: true } },
          },
        });
        const activeInternsCount = _count._all;
        const loadStatus =
          activeInternsCount >= 7
            ? "Capacity"
            : activeInternsCount >= 4
              ? "Busy"
              : "Healthy";

        return {
          name: latestAssignment?.mentor.name ?? "Mentor",
          program: latestAssignment?.program.name ?? "Internship program",
          activeInterns: `${activeInternsCount} intern${activeInternsCount === 1 ? "" : "s"}`,
          loadValue: activeInternsCount,
          status: loadStatus,
          mentorId,
        };
      }),
    );

    const priorityActions = [
      {
        title: `${formatCompactNumber(totalRegisteredApplicants)} registered internship applicants`,
        href: "/admin/internship/interns",
        detail:
          "Track the current internship population and follow-up priorities.",
      },
      {
        title: `${formatCompactNumber(examAttempts)} exam takers`,
        href: "/admin/internship/assessments",
        detail: "Monitor how many learners have started the assessment phase.",
      },
      {
        title: `${formatCompactNumber(atRiskInterns)} learner${atRiskInterns === 1 ? "" : "s"} need closer support`,
        href: "/admin/internship/interns",
        detail: "Intervene early to protect completion and mentor trust.",
      },
    ];

    const recentActivity = [
      ...recentApplications.map((application) => ({
        title: `${application.student.name ?? "A learner"} applied for ${application.program.name}`,
        meta: `Application received ${formatRelativeTime(application.createdAt)}`,
        tone: "neutral" as const,
      })),
      ...recentPayments.map((payment) => ({
        title: `${payment.application.student.name ?? "A learner"} ${payment.status === InternshipPaymentStatus.PAID ? "completed" : "has a pending"} payment`,
        meta: `${payment.application.program.name} • ${payment.status}`,
        tone:
          payment.status === InternshipPaymentStatus.PAID
            ? ("success" as const)
            : ("warning" as const),
      })),
      ...recentAnnouncements.map((announcement) => ({
        title: announcement.title,
        meta: `${announcement.author.name ?? "Coordinator"} • ${formatRelativeTime(announcement.createdAt)}`,
        tone: "neutral" as const,
      })),
    ].slice(0, 6);

    return NextResponse.json({
      overview: [
        {
          value: formatCompactNumber(totalRegisteredApplicants),
          label: "Registered internship applicants",
        },
        {
          value: `${currentCohortProgress}%`,
          label: "Current cohort progress",
        },
        { value: `${examSuccessRate}%`, label: "Exam success rate" },
        {
          value: formatCurrency(totalAcceptanceFeeRevenue),
          label: "Total acceptance fee revenue",
        },
        { value: formatCompactNumber(examAttempts), label: "Exam takers" },
        { value: formatCompactNumber(activeInterns), label: "Active interns" },
        { value: formatCompactNumber(activeMentors), label: "Active mentors" },
        {
          value: formatCompactNumber(activePrograms),
          label: "Active internship programs",
        },
      ],
      programPerformance: programMetrics,
      priorityActions,
      recentActivity,
      mentorLoad,
      topCohorts,
      topTracks,
    });
  } catch (error) {
    console.error("Failed to load internship dashboard data:", error);
    return NextResponse.json(fallbackDashboard);
  }
}
