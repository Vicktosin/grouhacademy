import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import {
  chooseApplicationLevel,
  getEntryLevel,
  getOpenLevels,
} from "@/lib/internship-levels";

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
    const [programs, questions] = await Promise.all([
      prisma.internshipProgram.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          slug: true,
          duration: true,
          description: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.internshipOnboardingQuestion.findMany({
        where: { active: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    const existingApplication = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
    });

    // Applicants choose a level as well as a track; only levels with a fee
    // and an entrance assessment are offered.
    const openLevels = await getOpenLevels(programs.map((item) => item.id));

    return NextResponse.json({
      programs: programs.map((program) => ({
        ...program,
        levels: (openLevels.get(program.id) ?? []).map((level) => ({
          id: level.id,
          name: level.name,
          description: level.description,
          acceptanceFee: level.acceptanceFee,
        })),
      })),
      questions: questions.map((question) => ({
        ...question,
        options: Array.isArray(question.options)
          ? question.options.filter(
              (option): option is string => typeof option === "string",
            )
          : [],
      })),
      existingProgramId: existingApplication?.programId ?? null,
      existingLevelId: existingApplication?.levelId ?? null,
      existingAnswers: existingApplication?.onboardingAnswers ?? null,
    });
  } catch (error) {
    console.error("Failed to load onboarding data:", error);
    return NextResponse.json(
      { error: "Unable to load onboarding options." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const programId = typeof body?.programId === "string" ? body.programId : null;
  const answers =
    body?.answers && typeof body.answers === "object" ? body.answers : {};

  if (!programId) {
    return NextResponse.json(
      { error: "Please choose a program." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  try {
    const program = await prisma.internshipProgram.findUnique({
      where: { id: programId },
    });
    if (!program || program.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Selected program is not available." },
        { status: 404 },
      );
    }

    const questions = await prisma.internshipOnboardingQuestion.findMany({
      where: { active: true },
    });
    for (const question of questions) {
      const answer = answers[question.id];
      if (question.required && (typeof answer !== "string" || !answer.trim()))
        return NextResponse.json(
          { error: `Please answer: ${question.prompt}` },
          { status: 400 },
        );
    }

    const levelId =
      typeof body?.levelId === "string" && body.levelId
        ? body.levelId
        : (await getEntryLevel()).id;
    const result = await chooseApplicationLevel(
      userId,
      programId,
      levelId,
      answers,
    );
    if ("error" in result)
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );

    return NextResponse.json({ applicationId: result.applicationId });
  } catch (error) {
    console.error("Failed to save onboarding answers:", error);
    return NextResponse.json(
      { error: "Unable to save your answers." },
      { status: 500 },
    );
  }
}
