import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

function formatDate(date: Date | null | undefined) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/internship/enrollees/[applicationId]">,
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const { applicationId } = await params;
  const prisma = getPrisma();

  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
    include: {
      student: {
        select: {
          name: true,
          email: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              country: true,
              state: true,
              gender: true,
              institution: true,
              program: true,
            },
          },
        },
      },
      program: { select: { name: true } },
      cohort: { select: { name: true } },
      payment: { select: { status: true } },
      attempts: {
        orderBy: { createdAt: "desc" },
        select: { status: true, scorePercent: true, submittedAt: true },
      },
    },
  });

  if (!application) {
    return NextResponse.json(
      { error: "Enrollee not found." },
      { status: 404 },
    );
  }

  // Answers are stored as { [questionId]: answer }. Load every active question
  // plus any retired ones this enrollee answered, so nothing they wrote is hidden.
  const answers =
    application.onboardingAnswers &&
    typeof application.onboardingAnswers === "object" &&
    !Array.isArray(application.onboardingAnswers)
      ? (application.onboardingAnswers as Record<string, unknown>)
      : {};
  const answeredIds = Object.keys(answers);

  const questions = await prisma.internshipOnboardingQuestion.findMany({
    where: { OR: [{ active: true }, { id: { in: answeredIds } }] },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, prompt: true, active: true },
  });

  const answerText = (value: unknown) =>
    typeof value === "string" && value.trim()
      ? value.trim()
      : value != null && typeof value !== "object"
        ? String(value)
        : null;

  const responses = [
    ...questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      answer: answerText(answers[question.id]),
      retired: !question.active,
    })),
    // Answers whose question has since been deleted.
    ...answeredIds
      .filter((id) => !questions.some((question) => question.id === id))
      .map((id) => ({
        id,
        prompt: "Deleted question",
        answer: answerText(answers[id]),
        retired: true,
      })),
  ];

  const { student } = application;
  const profile = student.profile;
  const latestAttempt = application.attempts[0];

  return NextResponse.json({
    enrollee: {
      applicationId: application.id,
      name:
        student.name ||
        [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
        "Unnamed enrollee",
      email: student.email,
      phone: profile?.phone ?? null,
      location:
        [profile?.state, profile?.country].filter(Boolean).join(", ") || null,
      gender: profile?.gender ?? null,
      institution: profile?.institution ?? null,
      studyProgram: profile?.program ?? null,
      track: application.program.name,
      cohort: application.cohort?.name ?? "Unassigned",
      examScore: latestAttempt?.scorePercent ?? null,
      attempts: application.attempts.length,
      paymentStatus: application.payment?.status ?? "NOT_STARTED",
      appliedOn: formatDate(application.createdAt),
      onboardingUpdatedOn: formatDate(application.updatedAt),
    },
    responses,
  });
}
