import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { computeInternProgress } from "@/lib/internship-progress";
import { cohortTimeline } from "@/lib/task-schedule";
import {
  internshipCertificateSelect,
  serializeInternshipCertificate,
} from "@/lib/internship-certificates";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

// Unique per certificate: an intern can earn one per track.
function generateCertificateNumber(): string {
  return `CERT-INT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      include: { program: true, cohort: true },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return NextResponse.json({
        eligible: false,
        reason: "No internship application found.",
      });
    }

    let certificate = await prisma.internshipCertificate.findFirst({
      where: { userId, programId: application.programId },
    });

    // Certificates are issued once the cohort has ended, to interns who
    // passed at least the cohort's pass mark of its tasks. Once issued, a
    // certificate stays available.
    if (!certificate) {
      const { cohort } = application;
      if (!cohort) {
        return NextResponse.json({
          eligible: false,
          reason:
            "You'll be able to earn a certificate once you're placed in a cohort.",
        });
      }
      const progress = await computeInternProgress(userId, cohort.id);
      const timeline = cohortTimeline(cohort.startDate, cohort.endDate);
      const passMark = cohort.certificatePassMark;
      const details = {
        progressPercent: progress.progressPercent,
        passMark,
        completedTasks: progress.completedTasks,
        totalTasks: progress.totalTasks,
        cohortEndLabel: formatDate(cohort.endDate),
      };

      if (!timeline.ended) {
        return NextResponse.json({
          eligible: false,
          reason: `Certificates are issued when your cohort ends on ${details.cohortEndLabel}. You need to pass at least ${passMark}% of your tasks — you've passed ${progress.progressPercent}% so far.`,
          ...details,
        });
      }
      if (progress.totalTasks === 0 || progress.progressPercent < passMark) {
        return NextResponse.json({
          eligible: false,
          reason: `Your cohort has ended. The certificate required passing at least ${passMark}% of tasks, and you passed ${progress.progressPercent}%.`,
          ...details,
        });
      }

      certificate = await prisma.internshipCertificate.create({
        data: {
          userId,
          programId: application.programId,
          applicationId: application.id,
          title: `${application.program.name} Completion Certificate`,
          certificateNumber: generateCertificateNumber(),
        },
      });
    }

    const view = serializeInternshipCertificate(
      await prisma.internshipCertificate.findUniqueOrThrow({
        where: { id: certificate.id },
        select: internshipCertificateSelect,
      }),
    );
    return NextResponse.json({ eligible: true, ...view });
  } catch (error) {
    console.error("Failed to load certificate:", error);
    return NextResponse.json(
      { error: "Unable to load certificate." },
      { status: 500 },
    );
  }
}
