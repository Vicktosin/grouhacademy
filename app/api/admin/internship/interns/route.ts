import { NextResponse } from "next/server";

import {
  AssessmentAttemptStatus,
  InternshipApplicationStatus,
  InternshipPaymentStatus,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  assignApplicationCohort,
  type CohortDb,
} from "@/lib/internship-cohort";
import { requireAdminApi } from "@/lib/api-guards";
import { REAL_USER } from "@/lib/real-user";

function formatTier(value: string | null | undefined) {
  if (!value || value === "NONE") return "Free Tier";
  const normalized = value.replace(/_/g, " ").toLowerCase();
  const words = normalized.split(" ");
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCohort(name: string | null | undefined) {
  return name || "Unassigned";
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatRelativeDate(date: Date | null | undefined) {
  if (!date) return "No activity yet";
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

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();

  const paidApplications = await prisma.internshipApplication.findMany({
    where: {
      student: REAL_USER,
      payment: { status: InternshipPaymentStatus.PAID },
      attempts: { some: { status: AssessmentAttemptStatus.PASSED } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      level: { select: { name: true } },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              program: true,
              institution: true,
              bio: true,
            },
          },
        },
      },
      program: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      cohort: {
        select: { name: true },
      },
      payment: {
        select: {
          status: true,
          paidAt: true,
          amount: true,
          currency: true,
        },
      },
      attempts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          scorePercent: true,
          submittedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  // An intern has one application per level they've joined; list each
  // intern once per track, at their current (newest) level.
  const seen = new Set<string>();
  const applications = paidApplications.filter((application) => {
    const key = `${application.studentId}:${application.programId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const progressRecords = await prisma.internshipProgress.findMany({
    where: {
      userId: { in: applications.map((application) => application.studentId) },
      programId: {
        in: applications.map((application) => application.programId),
      },
    },
    select: {
      userId: true,
      programId: true,
      progressPercent: true,
      lastUpdated: true,
    },
  });

  const progressMap = new Map<
    string,
    { progressPercent: number; lastUpdated: Date }
  >();
  for (const record of progressRecords) {
    progressMap.set(`${record.userId}:${record.programId}`, {
      progressPercent: record.progressPercent,
      lastUpdated: record.lastUpdated,
    });
  }

  const assignedCohortIds = await Promise.all(
    applications.map((application) =>
      // Removed interns keep whatever cohort they had; nobody re-places them.
      application.status === InternshipApplicationStatus.REMOVED
        ? application.cohortId
        : assignApplicationCohort(prisma as unknown as CohortDb, {
            id: application.id,
            programId: application.programId,
            levelId: application.levelId,
            cohortId: application.cohortId,
          }),
    ),
  );

  // Each intern's group on their track, and the choices for moving them.
  const [memberships, tracks, levels, cohorts, groups] = await Promise.all([
    prisma.internshipGroupMember.findMany({
      where: {
        userId: { in: applications.map((application) => application.studentId) },
      },
      select: {
        userId: true,
        programId: true,
        group: { select: { id: true, number: true } },
      },
    }),
    prisma.internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.internshipLevel.findMany({
      orderBy: { rank: "asc" },
      select: { id: true, name: true },
    }),
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        programId: true,
        levelId: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.internshipGroup.findMany({
      where: { cohortId: { not: null } },
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        cohortId: true,
        capacity: true,
        _count: { select: { members: true } },
      },
    }),
  ]);
  const groupByTrack = new Map(
    memberships.map((m) => [`${m.userId}:${m.programId}`, m.group]),
  );
  const assignedCohorts = await prisma.internshipCohort.findMany({
    where: {
      id: { in: assignedCohortIds.filter((id): id is string => Boolean(id)) },
    },
    select: { id: true, name: true },
  });
  const cohortNames = new Map(
    assignedCohorts.map((cohort) => [cohort.id, cohort.name]),
  );
  const assignedCohortByApplicationId = new Map(
    applications.map((application, index) => [
      application.id,
      assignedCohortIds[index],
    ]),
  );

  const interns = applications.map((application) => {
    const student = application.student;
    const latestAttempt = application.attempts[0];
    const progress = progressMap.get(`${student.id}:${application.programId}`);
    const lastActive = [
      student.updatedAt,
      progress?.lastUpdated,
      latestAttempt?.updatedAt,
      application.payment?.paidAt,
      application.updatedAt,
    ]
      .filter(Boolean)
      .sort(
        (a, b) => (b as Date).getTime() - (a as Date).getTime(),
      )[0] as Date | null;

    return {
      id: student.id,
      name:
        student.name ||
        [student.profile?.firstName, student.profile?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "Unnamed intern",
      email: student.email,
      profile:
        student.profile?.bio ||
        student.profile?.institution ||
        student.profile?.program ||
        "No profile details added yet",
      track: `${application.program.name} · ${application.level.name}`,
      progress: Math.max(0, Math.min(100, progress?.progressPercent ?? 0)),
      lastActive: formatRelativeDate(lastActive),
      enrollmentDate: formatDate(
        application.payment?.paidAt ?? application.createdAt,
      ),
      tier: formatTier(application.premiumTier),
      cohort: formatCohort(
        application.cohort?.name ??
          (application.cohortId
            ? cohortNames.get(application.cohortId)
            : null) ??
          (assignedCohortByApplicationId.get(application.id)
            ? cohortNames.get(
                assignedCohortByApplicationId.get(application.id) as string,
              )
            : null),
      ),
      status: application.status,
      applicationId: application.id,
      programId: application.programId,
      levelId: application.levelId,
      cohortId: assignedCohortByApplicationId.get(application.id) ?? null,
      group:
        groupByTrack.get(`${student.id}:${application.programId}`) ?? null,
      lastAssessmentStatus: latestAttempt?.status ?? "PASSED",
      examScore: latestAttempt?.scorePercent ?? null,
      enrollmentDateIso: (
        application.payment?.paidAt ?? application.createdAt
      ).toISOString(),
    };
  });

  return NextResponse.json({
    interns,
    options: {
      tracks,
      levels,
      cohorts: cohorts.map((cohort) => ({
        ...cohort,
        startDate: cohort.startDate.toISOString(),
        endDate: cohort.endDate.toISOString(),
      })),
      groups: groups.map(({ _count, ...group }) => ({
        ...group,
        members: _count.members,
      })),
    },
  });
}
