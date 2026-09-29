import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const answers = Array.isArray(body?.answers) ? body.answers : [];

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
    });
    if (!application) {
      return NextResponse.json(
        { error: "No application found." },
        { status: 404 },
      );
    }

    const attempt = await prisma.assessmentAttempt.findFirst({
      where: { applicationId: application.id, status: "IN_PROGRESS" },
      include: { assessment: true },
      orderBy: { createdAt: "desc" },
    });
    if (!attempt || !attempt.assessment) {
      return NextResponse.json(
        { error: "No assessment currently in progress." },
        { status: 404 },
      );
    }

    const questions = await prisma.assessmentQuestion.findMany({
      where: { assessmentId: attempt.assessmentId! },
      include: { options: true },
    });

    let correctCount = 0;
    const answerRows: { questionId: string; answer: string }[] = [];
    for (const question of questions) {
      const submitted = answers.find(
        (a: { questionId: string; optionId: string }) =>
          a.questionId === question.id,
      );
      const selectedOption = question.options.find(
        (o) => o.id === submitted?.optionId,
      );
      if (selectedOption?.isCorrect) correctCount += 1;

      if (typeof submitted?.optionId === "string" && submitted.optionId)
        answerRows.push({ questionId: question.id, answer: submitted.optionId });
    }

    // Save every answer in one transaction (two statements) instead of one
    // upsert per question. Replacing only the submitted questions matches the
    // previous per-question upsert behaviour.
    await prisma.$transaction([
      prisma.assessmentAnswer.deleteMany({
        where: {
          attemptId: attempt.id,
          section: "objective",
          questionId: { in: answerRows.map((row) => row.questionId) },
        },
      }),
      prisma.assessmentAnswer.createMany({
        data: answerRows.map((row) => ({
          attemptId: attempt.id,
          section: "objective",
          ...row,
        })),
      }),
    ]);

    const totalQuestions = questions.length;
    const scorePercent =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0;
    const passed = scorePercent >= attempt.assessment.passingScore;

    await prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: passed ? "PASSED" : "FAILED",
        score: correctCount,
        totalQuestions,
        scorePercent,
        objectiveSubmittedAt: new Date(),
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      scorePercent,
      passed,
      correctCount,
      totalQuestions,
    });
  } catch (error) {
    console.error("Failed to submit assessment:", error);
    return NextResponse.json(
      { error: "Unable to submit your assessment." },
      { status: 500 },
    );
  }
}
