import { NextResponse } from "next/server";

import {
  AssessmentAttemptStatus,
  InternshipPaymentStatus,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

function formatDate(date: Date | null | undefined) {
  if (!date) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const applications = await getPrisma().internshipApplication.findMany({
    where: {
      OR: [
        { payment: null },
        { payment: { status: { not: InternshipPaymentStatus.PAID } } },
      ],
      attempts: {
        some: {
          status: { not: AssessmentAttemptStatus.NOT_STARTED },
        },
      },
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
              institution: true,
              program: true,
              bio: true,
            },
          },
          groupMemberships: {
            select: {
              programId: true,
              group: {
                select: { number: true },
              },
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
      cohort: { select: { name: true } },
      payment: {
        select: {
          status: true,
          paidAt: true,
          amount: true,
          currency: true,
          createdAt: true,
        },
      },
      attempts: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          scorePercent: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const enrolleeRows = applications.map((application) => {
    const student = application.student;
    const latestAttempt = application.attempts[0];
    const membership = student.groupMemberships.find(
      (item) => item.programId === application.programId,
    );

    return {
      id: student.id,
      applicationId: application.id,
      name:
        student.name ||
        [student.profile?.firstName, student.profile?.lastName]
          .filter(Boolean)
          .join(" ") ||
        "Unnamed enrollee",
      email: student.email,
      track: `${application.program.name} · ${application.level.name}`,
      examScore: latestAttempt?.scorePercent ?? null,
      attempts: application.attempts.length,
      cohort: application.cohort?.name ?? "Unassigned",
      group: membership?.group ? `Group ${membership.group.number}` : null,
      status: application.payment?.status
        ? application.payment.status
        : "NOT_STARTED",
      lastUpdated: formatDate(
        latestAttempt?.updatedAt ?? application.updatedAt,
      ),
    };
  });

  return NextResponse.json({ enrolleeRows });
}
