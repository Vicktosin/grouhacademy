import { NextResponse } from "next/server";

import { missingAssessments } from "@/lib/entry-assessments";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import { listLevels, resolveLevelId } from "@/lib/internship-levels";

type QuestionInput = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

function normalizeQuestions(input: unknown): QuestionInput[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((question) => {
      if (!question || typeof question !== "object") return null;
      const promptValue =
        "prompt" in question
          ? String((question as { prompt?: unknown }).prompt ?? "")
          : "";
      const rawOptions =
        "options" in question
          ? ((question as { options?: unknown[] }).options ?? [])
          : [];
      const options = Array.isArray(rawOptions)
        ? rawOptions.map((option) => String(option).trim())
        : [];
      const rawCorrectIndex =
        "correctIndex" in question
          ? Number((question as { correctIndex?: unknown }).correctIndex ?? 0)
          : 0;
      const correctIndex = Number.isFinite(rawCorrectIndex)
        ? Math.max(0, Math.min(3, rawCorrectIndex))
        : 0;

      if (
        !promptValue.trim() ||
        options.length !== 4 ||
        options.some((option) => !option)
      ) {
        return null;
      }

      return { prompt: promptValue.trim(), options, correctIndex };
    })
    .filter((question): question is QuestionInput => Boolean(question));
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();

  const [programs, levels, assessments] = await Promise.all([
    prisma.internshipProgram.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listLevels(),
    prisma.internshipAssessment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            options: {
              orderBy: { order: "asc" },
              select: { id: true, optionText: true, isCorrect: true },
            },
          },
        },
      },
    }),
  ]);

  const questions = assessments.flatMap((assessment) =>
    assessment.questions.map((question) => {
      const correctOptionIndex = question.options.findIndex(
        (option) => option.isCorrect,
      );

      return {
        id: question.id,
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        track: assessment.program.name,
        levelId: assessment.levelId,
        level: assessment.level.name,
        instructions: assessment.description ?? "",
        passingScore: assessment.passingScore,
        prompt: question.prompt,
        options: question.options.map((option) => ({
          id: option.id,
          optionText: option.optionText,
          isCorrect: option.isCorrect,
        })),
        correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
      };
    }),
  );

  return NextResponse.json({
    missing: await missingAssessments(prisma),
    programs,
    levels,
    assessments: assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      track: assessment.program.name,
      levelId: assessment.levelId,
      level: assessment.level.name,
      questionCount: assessment.questions.length,
      passingScore: assessment.passingScore,
      instructions: assessment.description ?? "",
    })),
    questions,
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  if (!body || !body.programId) {
    return NextResponse.json(
      { error: "Please choose a valid internship track." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const {
    title,
    instructions,
    passingScore,
    programId,
    levelId: requestedLevelId,
    questionId,
    questions,
  } = body;
  // Each track has a separate entrance assessment per level.
  const levelId =
    requestedLevelId === undefined
      ? undefined
      : await resolveLevelId(requestedLevelId);
  if (levelId === null) {
    return NextResponse.json(
      { error: "Please choose a valid internship level." },
      { status: 400 },
    );
  }
  const normalizedQuestions = normalizeQuestions(questions);

  if (typeof questionId === "string" && questionId.trim()) {
    const question = await prisma.assessmentQuestion.findUnique({
      where: { id: questionId },
      include: { assessment: true },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found." },
        { status: 404 },
      );
    }

    if (!normalizedQuestions[0]) {
      return NextResponse.json(
        { error: "Question details are missing." },
        { status: 400 },
      );
    }

    const incoming = normalizedQuestions[0];

    await prisma.$transaction(async (tx) => {
      await tx.internshipAssessment.update({
        where: { id: question.assessmentId },
        data: {
          title:
            typeof title === "string" && title.trim()
              ? title.trim()
              : question.assessment.title,
          description:
            typeof instructions === "string"
              ? instructions
              : question.assessment.description,
          passingScore:
            Number(passingScore) || question.assessment.passingScore,
          programId: programId || question.assessment.programId,
          levelId: levelId ?? question.assessment.levelId,
        },
      });

      await tx.assessmentQuestion.update({
        where: { id: questionId },
        data: {
          prompt: incoming.prompt,
          order: 0,
          options: {
            deleteMany: {},
            create: incoming.options.map((optionText, optionIndex) => ({
              optionText,
              order: optionIndex,
              isCorrect: optionIndex === incoming.correctIndex,
            })),
          },
        },
      });
    });

    return NextResponse.json({ success: true, updated: true });
  }

  if (normalizedQuestions.length === 0) {
    return NextResponse.json(
      { error: "No valid assessment questions were provided." },
      { status: 400 },
    );
  }

  const createdAssessment = await prisma.internshipAssessment.create({
    data: {
      programId,
      levelId: levelId ?? (await resolveLevelId(undefined))!,
      title: String(title || "Entrance Exam"),
      description: typeof instructions === "string" ? instructions : "",
      passingScore: Number(passingScore) || 70,
      questions: {
        create: normalizedQuestions.map((question, questionIndex) => ({
          prompt: String(question.prompt),
          order: questionIndex,
          options: {
            create: question.options.map((optionText, optionIndex) => ({
              optionText: String(optionText),
              order: optionIndex,
              isCorrect: optionIndex === Number(question.correctIndex),
            })),
          },
        })),
      },
    },
  });

  return NextResponse.json({
    success: true,
    assessmentId: createdAssessment.id,
  });
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = await request.json().catch(() => null);
  const questionId =
    typeof body?.questionId === "string" ? body.questionId : null;
  const assessmentId =
    typeof body?.assessmentId === "string" ? body.assessmentId : null;

  const prisma = getPrisma();

  if (assessmentId) {
    const assessment = await prisma.internshipAssessment.findUnique({
      where: { id: assessmentId },
      include: { _count: { select: { questions: true } } },
    });
    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found." },
        { status: 404 },
      );
    }
    if (assessment._count.questions > 0) {
      return NextResponse.json(
        { error: "Delete all questions before removing this assessment." },
        { status: 409 },
      );
    }

    await prisma.internshipAssessment.delete({ where: { id: assessmentId } });
    return NextResponse.json({
      success: true,
      deletedAssessmentId: assessmentId,
    });
  }

  if (!questionId) {
    return NextResponse.json(
      { error: "A valid assessment or question id is required." },
      { status: 400 },
    );
  }

  const question = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }

  await prisma.assessmentQuestion.delete({ where: { id: questionId } });
  return NextResponse.json({ success: true });
}
