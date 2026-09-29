import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";

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
      include: { program: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
    if (!application) {
      return NextResponse.json(
        { error: "No application found." },
        { status: 404 },
      );
    }

    const passedAttempt = await prisma.assessmentAttempt.findFirst({
      where: { applicationId: application.id, status: "PASSED" },
      orderBy: { createdAt: "desc" },
    });

    const attempt =
      passedAttempt ??
      (await prisma.assessmentAttempt.findFirst({
        where: { applicationId: application.id, status: "FAILED" },
        orderBy: { createdAt: "desc" },
      }));

    if (!attempt) {
      return NextResponse.json(
        { error: "No completed assessment found." },
        { status: 404 },
      );
    }

    if (!attempt.assessmentId) {
      return NextResponse.json(
        { error: "Assessment questions are unavailable for this result." },
        { status: 500 },
      );
    }

    const [questions, answers] = await Promise.all([
      prisma.assessmentQuestion.findMany({
        where: { assessmentId: attempt.assessmentId },
        orderBy: { order: "asc" },
        include: {
          options: {
            select: { id: true, optionText: true, isCorrect: true },
            orderBy: { order: "asc" },
          },
        },
      }),
      prisma.assessmentAnswer.findMany({
        where: { attemptId: attempt.id, section: "objective" },
        select: { questionId: true, answer: true },
      }),
    ]);

    const answersByQuestionId = new Map(
      answers.map((answer) => [answer.questionId, answer.answer]),
    );
    const answerReview = questions.map((question) => {
      const selectedOptionId = answersByQuestionId.get(question.id) ?? null;
      const selectedOption =
        question.options.find((option) => option.id === selectedOptionId) ??
        null;
      const correctOption =
        question.options.find((option) => option.isCorrect) ?? null;

      return {
        questionId: question.id,
        question: question.prompt,
        selectedAnswer: selectedOption?.optionText ?? "Not answered",
        correctAnswer: correctOption?.optionText ?? "Not available",
        isCorrect: Boolean(selectedOption?.isCorrect),
      };
    });

    return NextResponse.json({
      programName: application.program.name,
      scorePercent: attempt.scorePercent,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      passed: Boolean(passedAttempt),
      acceptanceFee: application.program.acceptanceFee,
      acceptanceFeePaid: application.payment?.status === "PAID",
      answerReview,
    });
  } catch (error) {
    console.error("Failed to load assessment result:", error);
    return NextResponse.json(
      { error: "Unable to load your result." },
      { status: 500 },
    );
  }
}
