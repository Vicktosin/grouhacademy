import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { listLevels } from "@/lib/internship-levels";
import { isGradingEnabled, parseQuestions } from "@/lib/interviews";
import {
  FREE_PLAN_INTERVIEW_MINUTES,
  isTavusFreePlan,
  tavusConfig,
} from "@/lib/tavus";
import { REAL_USER } from "@/lib/real-user";

/** Tracks, levels, every interview setup, and recent interviews. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const prisma = getPrisma();
  const [tracks, levels, setups, sessions] = await Promise.all([
    prisma.internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listLevels(),
    prisma.interviewSetup.findMany({
      include: { _count: { select: { sessions: { where: { user: REAL_USER } } } } },
    }),
    prisma.interviewSession.findMany({
      where: { user: REAL_USER },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
        setup: {
          select: {
            program: { select: { name: true } },
            level: { select: { name: true } },
          },
        },
      },
    }),
  ]);
  return NextResponse.json({
    configured: {
      tavus: tavusConfig() !== null,
      grading: isGradingEnabled(),
      freePlan: isTavusFreePlan(),
      freePlanMinutes: FREE_PLAN_INTERVIEW_MINUTES,
    },
    tracks,
    levels: levels.map(({ id, name }) => ({ id, name })),
    setups: setups.map((setup) => ({
      id: setup.id,
      programId: setup.programId,
      levelId: setup.levelId,
      title: setup.title,
      instructions: setup.instructions ?? "",
      questions: parseQuestions(setup.questions),
      durationMinutes: setup.durationMinutes,
      maxAttempts: setup.maxAttempts,
      active: setup.active,
      sessionCount: setup._count.sessions,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      intern:
        [session.user.profile?.firstName, session.user.profile?.lastName]
          .filter(Boolean)
          .join(" ") ||
        session.user.name ||
        session.user.email,
      email: session.user.email,
      track: session.setup.program.name,
      level: session.setup.level.name,
      mode: session.mode,
      status: session.status,
      score: session.score,
      createdAt: session.createdAt.toISOString(),
      errorMessage: session.errorMessage,
    })),
  });
}

/**
 * Creates or updates the interview for a track and level. Body: { programId,
 * levelId, title, instructions, questions: string[], durationMinutes,
 * maxAttempts, active }.
 */
export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const programId = typeof body?.programId === "string" ? body.programId : "";
  const levelId = typeof body?.levelId === "string" ? body.levelId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const instructions =
    typeof body?.instructions === "string" ? body.instructions.trim() : "";
  const questions = parseQuestions(body?.questions).slice(0, 20);
  const durationMinutes = Number(body?.durationMinutes);
  const maxAttempts = Number(body?.maxAttempts);
  if (!programId || !levelId || !title)
    return NextResponse.json(
      { error: "Choose a track and level, and give the interview a title." },
      { status: 400 },
    );
  if (!questions.length)
    return NextResponse.json(
      { error: "Add at least one question." },
      { status: 400 },
    );
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 45
  )
    return NextResponse.json(
      { error: "Length must be 5 to 45 minutes." },
      { status: 400 },
    );
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20)
    return NextResponse.json(
      { error: "Attempts must be 1 to 20." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const [track, level] = await Promise.all([
    prisma.internshipProgram.findUnique({
      where: { id: programId },
      select: { id: true },
    }),
    prisma.internshipLevel.findUnique({
      where: { id: levelId },
      select: { id: true },
    }),
  ]);
  if (!track || !level)
    return NextResponse.json(
      { error: "Track or level not found." },
      { status: 404 },
    );

  const data = {
    title,
    instructions: instructions || null,
    questions,
    durationMinutes,
    maxAttempts,
    active: body?.active !== false,
  };
  const setup = await prisma.interviewSetup.upsert({
    where: { programId_levelId: { programId, levelId } },
    create: { programId, levelId, ...data },
    update: data,
  });
  return NextResponse.json({ setup: { ...setup, questions } });
}
