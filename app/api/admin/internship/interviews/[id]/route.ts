import { after, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { parseQuestions, scoreSession } from "@/lib/interviews";

type Params = { params: Promise<{ id: string }> };

/** One interview with its transcript and feedback. */
export async function GET(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const session = await getPrisma().interviewSession.findUnique({
    where: { id: (await params).id },
    include: {
      user: { select: { name: true, email: true } },
      setup: {
        include: {
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!session)
    return NextResponse.json(
      { error: "Interview not found." },
      { status: 404 },
    );
  return NextResponse.json({
    session: {
      id: session.id,
      intern: session.user.name ?? session.user.email,
      email: session.user.email,
      track: session.setup.program.name,
      level: session.setup.level.name,
      questions: parseQuestions(session.setup.questions),
      mode: session.mode,
      status: session.status,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      shutdownReason: session.shutdownReason,
      transcript: session.transcript ?? [],
      recordingUri: session.recordingUri,
      score: session.score,
      feedback: session.feedback,
      errorMessage: session.errorMessage,
    },
  });
}

/** Re-runs the scoring for an interview that has a transcript. */
export async function POST(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const prisma = getPrisma();
  const session = await prisma.interviewSession.findUnique({
    where: { id: (await params).id },
    select: { id: true, transcript: true },
  });
  if (!session?.transcript)
    return NextResponse.json(
      { error: "This interview has no transcript to score yet." },
      { status: 409 },
    );
  await prisma.interviewSession.update({
    where: { id: session.id },
    data: {
      status: "ENDED",
      score: null,
      feedback: undefined,
      errorMessage: null,
    },
  });
  after(() => scoreSession(session.id));
  return NextResponse.json({ ok: true });
}
