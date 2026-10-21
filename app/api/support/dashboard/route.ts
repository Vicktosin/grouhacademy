import { NextResponse } from "next/server";
import {
  AssessmentAttemptStatus,
  InternResourceStatus,
  InternshipApplicationStatus,
  InternshipPaymentStatus,
  InternshipProgramStatus,
} from "@/generated/prisma/client";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { listFollowUps } from "@/lib/internship-follow-ups";
import { getPrisma } from "@/lib/prisma";
import { REAL_USER } from "@/lib/real-user";

// The Support Admin dashboard: enrollee, internship, track, cohort, group,
// follow-up and resource KPIs. Never anything about money (fees, revenue,
// payments made): it only counts people.

const DAY = 86_400_000;

/** Admitted: paid their acceptance fee and still in the internship. */
const ADMITTED = {
  student: REAL_USER,
  status: { not: InternshipApplicationStatus.REMOVED },
  payment: { is: { status: InternshipPaymentStatus.PAID } },
};

export async function GET() {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;

  const prisma = getPrisma();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);

  try {
    const [
      registered,
      registeredThisWeek,
      admitted,
      examTakers,
      examPassed,
      progress,
      atRisk,
      tracks,
      registeredByTrack,
      admittedByTrack,
      progressByTrack,
      cohorts,
      groups,
      pausedGroups,
      resourcesByStatus,
      myResources,
      followUps,
    ] = await Promise.all([
      prisma.internshipApplication.count({ where: { student: REAL_USER } }),
      prisma.internshipApplication.count({
        where: { student: REAL_USER, createdAt: { gte: weekAgo } },
      }),
      prisma.internshipApplication.count({ where: ADMITTED }),
      prisma.assessmentAttempt.count({
        where: {
          status: {
            in: [AssessmentAttemptStatus.PASSED, AssessmentAttemptStatus.FAILED],
          },
          application: { student: REAL_USER },
        },
      }),
      prisma.assessmentAttempt.count({
        where: {
          status: AssessmentAttemptStatus.PASSED,
          application: { student: REAL_USER },
        },
      }),
      prisma.internshipProgress.aggregate({
        where: { user: REAL_USER },
        _avg: { progressPercent: true },
      }),
      prisma.internshipProgress.count({
        where: { user: REAL_USER, progressPercent: { lt: 40 } },
      }),
      prisma.internshipProgram.findMany({
        where: { status: InternshipProgramStatus.PUBLISHED },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.internshipApplication.groupBy({
        by: ["programId"],
        where: { student: REAL_USER },
        _count: { _all: true },
      }),
      prisma.internshipApplication.groupBy({
        by: ["programId"],
        where: ADMITTED,
        _count: { _all: true },
      }),
      prisma.internshipProgress.groupBy({
        by: ["programId"],
        where: { user: REAL_USER },
        _avg: { progressPercent: true },
      }),
      // Running and upcoming cohorts.
      prisma.internshipCohort.findMany({
        where: { endDate: { gte: now } },
        orderBy: { startDate: "asc" },
        take: 8,
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          program: { select: { name: true } },
          level: { select: { name: true } },
          _count: {
            select: { applications: { where: ADMITTED }, groups: true },
          },
        },
      }),
      prisma.internshipGroup.count(),
      prisma.internshipGroup.count({ where: { discussionOpen: false } }),
      prisma.internResource.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.internResource.groupBy({
        by: ["status"],
        where: { createdById: access.userId },
        _count: { _all: true },
      }),
      listFollowUps(),
    ]);

    const registeredFor = new Map(
      registeredByTrack.map((row) => [row.programId, row._count._all]),
    );
    const admittedFor = new Map(
      admittedByTrack.map((row) => [row.programId, row._count._all]),
    );
    const progressFor = new Map(
      progressByTrack.map((row) => [
        row.programId,
        Math.round(row._avg.progressPercent ?? 0),
      ]),
    );
    const resources = new Map(
      resourcesByStatus.map((row) => [row.status, row._count._all]),
    );
    const mine = new Map(
      myResources.map((row) => [row.status, row._count._all]),
    );

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const contactedBy = (role: "ADMIN" | "SUPPORT_ADMIN") =>
      followUps.filter((row) =>
        row.followUp.contactedBy.some((contact) => contact.role === role),
      ).length;

    return NextResponse.json({
      overview: {
        registered,
        registeredThisWeek,
        admitted,
        examTakers,
        examPassRate: examTakers ? Math.round((examPassed / examTakers) * 100) : 0,
        averageProgress: Math.round(progress._avg.progressPercent ?? 0),
        atRisk,
        activeTracks: tracks.length,
      },
      tracks: tracks.map((track) => ({
        id: track.id,
        name: track.name,
        registered: registeredFor.get(track.id) ?? 0,
        admitted: admittedFor.get(track.id) ?? 0,
        averageProgress: progressFor.get(track.id) ?? 0,
      })),
      cohorts: cohorts.map((cohort) => ({
        id: cohort.id,
        name: cohort.name,
        track: cohort.program.name,
        level: cohort.level.name,
        startDate: cohort.startDate.toISOString(),
        endDate: cohort.endDate.toISOString(),
        running: cohort.startDate <= now,
        interns: cohort._count.applications,
        groups: cohort._count.groups,
      })),
      groups: { total: groups, paused: pausedGroups },
      followUps: {
        total: followUps.length,
        notContacted: followUps.filter(
          (row) => row.followUp.contactedBy.length === 0,
        ).length,
        contactedByAdmins: contactedBy("ADMIN"),
        contactedBySupport: contactedBy("SUPPORT_ADMIN"),
        dueToday: followUps.filter(
          (row) =>
            row.followUp.nextFollowUpAt &&
            new Date(row.followUp.nextFollowUpAt) <= endOfToday,
        ).length,
        interested: followUps.filter(
          (row) => row.followUp.status === "INTERESTED",
        ).length,
      },
      resources: {
        published: resources.get(InternResourceStatus.PUBLISHED) ?? 0,
        waitingForReview: resources.get(InternResourceStatus.PENDING_REVIEW) ?? 0,
        myDrafts: mine.get(InternResourceStatus.DRAFT) ?? 0,
        myWaitingForReview: mine.get(InternResourceStatus.PENDING_REVIEW) ?? 0,
        myPublished: mine.get(InternResourceStatus.PUBLISHED) ?? 0,
      },
    });
  } catch (error) {
    console.error("Failed to load the Support Admin dashboard:", error);
    return NextResponse.json(
      { error: "Dashboard data is unavailable right now." },
      { status: 500 },
    );
  }
}
