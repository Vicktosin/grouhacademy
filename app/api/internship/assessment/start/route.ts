import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const prisma = getPrisma();

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      include: { program: true },
      orderBy: { createdAt: "desc" },
    });

    if (!application || !user) {
      return NextResponse.json(
        { error: "Complete onboarding before starting your assessment." },
        { status: 404 },
      );
    }

    if (!application.onboardingAnswers) {
      return NextResponse.json(
        {
          error: "Complete onboarding before starting your assessment.",
          code: "ONBOARDING_REQUIRED",
        },
        { status: 403 },
      );
    }

    const assessment = await prisma.internshipAssessment.findFirst({
      where: {
        programId: application.programId,
        questions: { some: {} },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!assessment) {
      return NextResponse.json(
        {
          error:
            "No assessment has been set up for this program yet. Please check back soon.",
        },
        { status: 404 },
      );
    }

    const passedAttempt = await prisma.assessmentAttempt.findFirst({
      where: {
        applicationId: application.id,
        assessmentId: assessment.id,
        status: "PASSED",
      },
      select: { id: true },
    });
    if (passedAttempt) {
      return NextResponse.json(
        { error: "You have already passed this entrance assessment." },
        { status: 409 },
      );
    }

    // Reuse an in-progress attempt rather than creating a duplicate.
    let attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        applicationId: application.id,
        assessmentId: assessment.id,
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!attempt) {
      attempt = await prisma.assessmentAttempt.create({
        data: {
          applicationId: application.id,
          assessmentId: assessment.id,
          status: "NOT_STARTED",
          outcomeEmail: user.email,
        },
      });
    }

    if (attempt.status === "NOT_STARTED") {
      attempt = await prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    return NextResponse.json({
      attemptId: attempt.id,
      assessmentTitle: assessment.title,
    });
  } catch (error) {
    console.error("Failed to start assessment:", error);
    return NextResponse.json(
      { error: "Unable to start your assessment." },
      { status: 500 },
    );
  }
}
