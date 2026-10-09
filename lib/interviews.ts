import { after } from "next/server";
import type {
  InterviewMode,
  InterviewSession,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { isAiEnabled } from "@/lib/ai";
import { getSiteUrl } from "@/lib/site-url";
import {
  callLimitSeconds,
  createConversation,
  effectiveInterviewMinutes,
  endConversation,
  isTavusCapacityError,
  isTavusFreePlan,
  tavusConfig,
  tavusRequest,
} from "@/lib/tavus";
import {
  gradeInterview,
  type InterviewFeedback,
  type TranscriptTurn,
} from "@/lib/interview-grading";

// Practice interviews: an intern picks video or voice, talks to the Tavus
// interviewer, and gets a Claude-graded score and feedback afterwards. Each
// intern's track and level decide the questions (InterviewSetup) and how
// many attempts they get.

/** Sessions stuck starting this long are treated as failed. */
const STALE_START_MS = 10 * 60 * 1000;
/**
 * Scoring is optional: without an AI key (see lib/ai.ts) interviews still run and
 * their transcripts are kept for admins; adding the key later lets admins
 * score them with Re-score.
 */
export function isGradingEnabled() {
  return isAiEnabled();
}

/** Grading normally takes under a minute; retry if it's been this long. */
const REGRADE_AFTER_MS = 3 * 60 * 1000;

export function parseQuestions(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

/** The intern's current application, track/level and its interview setup. */
async function internContext(userId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      student: {
        select: {
          name: true,
          email: true,
          profile: { select: { firstName: true } },
        },
      },
    },
  });
  if (!application) return null;
  const setup = await prisma.interviewSetup.findUnique({
    where: {
      programId_levelId: {
        programId: application.programId,
        levelId: application.levelId,
      },
    },
  });
  return { application, setup: setup?.active ? setup : null };
}

function sessionView(session: InterviewSession) {
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    conversationUrl:
      session.status === "ACTIVE" || session.status === "STARTING"
        ? session.conversationUrl
        : null,
    createdAt: session.createdAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    score: session.score,
    feedback: (session.feedback as InterviewFeedback | null) ?? null,
    errorMessage: session.errorMessage,
    hasTranscript: session.transcript !== null,
    // False when no score is coming automatically (grading switched off).
    gradingEnabled: isGradingEnabled(),
  };
}

export type InterviewSessionView = ReturnType<typeof sessionView>;

/**
 * Counts toward the attempt limit: everything except starts that failed and
 * interviews the intern never joined (e.g. camera/microphone blocked), which
 * Tavus closes with "participant_absent_timeout".
 */
const usesAttempt = (session: {
  status: string;
  shutdownReason: string | null;
}) =>
  session.status !== "FAILED" &&
  session.shutdownReason !== "participant_absent_timeout";

export async function getInterviewOverview(userId: string) {
  const context = await internContext(userId);
  if (!context) return null;
  const { application, setup } = context;
  const sessions = setup
    ? await getPrisma().interviewSession.findMany({
        where: { userId, setupId: setup.id },
        orderBy: { createdAt: "desc" },
      })
    : [];
  return {
    track: application.program.name,
    level: application.level.name,
    // Practice interviews are a Premium feature (either tier).
    premium: application.premiumTier !== "NONE",
    configured: tavusConfig() !== null,
    freePlan: isTavusFreePlan(),
    gradingEnabled: isGradingEnabled(),
    setup: setup
      ? {
          title: setup.title,
          durationMinutes: effectiveInterviewMinutes(setup.durationMinutes),
          maxAttempts: setup.maxAttempts,
          questionCount: parseQuestions(setup.questions).length,
        }
      : null,
    attemptsUsed: sessions.filter(usesAttempt).length,
    sessions: sessions.map(sessionView),
  };
}

function interviewerContext(input: {
  firstName: string;
  track: string;
  level: string;
  durationMinutes: number;
  instructions: string | null;
  questions: string[];
}) {
  return `You are interviewing ${input.firstName}, an intern on the ${input.track} track at ${input.level} level, for a practice job interview lasting about ${input.durationMinutes} minutes.

Ask these questions in order, one at a time. After each answer you may ask at most one short follow-up, then move on:
${input.questions.map((question, index) => `${index + 1}. ${question}`).join("\n")}
${input.instructions ? `\nAlso: ${input.instructions}\n` : ""}
Don't give feedback or scores during the interview; it is graded afterwards. When the questions are done or time is nearly up, thank ${input.firstName}, tell them their feedback will appear on their dashboard shortly, and end politely.`;
}

export async function startInterview(
  userId: string,
  mode: InterviewMode,
): Promise<
  { session: InterviewSessionView } | { error: string; status: number }
> {
  const config = tavusConfig();
  if (!config)
    return {
      error: "Interviews aren't set up yet. Please check back soon.",
      status: 503,
    };

  const context = await internContext(userId);
  // Premium only: each interview costs video and AI time.
  if (context && context.application.premiumTier === "NONE")
    return {
      error: "Practice interviews are a Premium feature. Upgrade to unlock them.",
      status: 403,
    };
  if (!context?.setup)
    return {
      error: "There's no practice interview for your track and level yet.",
      status: 404,
    };
  const { application, setup } = context;
  const questions = parseQuestions(setup.questions);
  if (!questions.length)
    return { error: "This interview has no questions yet.", status: 409 };

  const prisma = getPrisma();
  // Clear out starts that never got going.
  await prisma.interviewSession.updateMany({
    where: {
      userId,
      status: "STARTING",
      createdAt: { lt: new Date(Date.now() - STALE_START_MS) },
    },
    data: { status: "FAILED", errorMessage: "The interview didn't start." },
  });

  const sessions = await prisma.interviewSession.findMany({
    where: { userId, setupId: setup.id },
    select: { id: true, status: true, shutdownReason: true },
  });
  const live = sessions.find(
    (session) => session.status === "STARTING" || session.status === "ACTIVE",
  );
  if (live)
    return {
      error: "You already have an interview in progress.",
      status: 409,
    };
  if (sessions.filter(usesAttempt).length >= setup.maxAttempts)
    return {
      error: `You've used all ${setup.maxAttempts} practice interviews for this level.`,
      status: 409,
    };

  const session = await prisma.interviewSession.create({
    data: {
      userId,
      setupId: setup.id,
      applicationId: application.id,
      mode,
    },
  });

  const firstName =
    application.student.profile?.firstName?.trim() ||
    application.student.name?.trim().split(/\s+/)[0] ||
    "there";
  try {
    const callback = new URL("/api/webhooks/tavus", getSiteUrl());
    callback.searchParams.set("secret", config.webhookSecret);
    const conversation = await createConversation({
      conversationName: `Practice interview ${session.id}`,
      audioOnly: mode === "AUDIO",
      context: interviewerContext({
        firstName,
        track: application.program.name,
        level: application.level.name,
        durationMinutes: effectiveInterviewMinutes(setup.durationMinutes),
        instructions: setup.instructions,
        questions,
      }),
      greeting: `Hi ${firstName}, welcome to your practice interview for the ${application.program.name} track. Are you ready to begin?`,
      callbackUrl: callback.toString(),
      // A little headroom over the planned length for the close, within
      // the Tavus plan's call limit.
      maxCallSeconds: callLimitSeconds(setup.durationMinutes),
    });
    const started = await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        status: "ACTIVE",
        tavusConversationId: conversation.conversation_id,
        conversationUrl: conversation.conversation_url,
        startedAt: new Date(),
      },
    });
    return { session: sessionView(started) };
  } catch (error) {
    console.error("Failed to start Tavus interview.", error);
    // Usually another intern's interview is running (the free plan allows
    // one at a time) or the month's minutes are used up.
    const busy = isTavusCapacityError(error);
    const message = busy
      ? "The interviewer is busy with another intern right now. Please try again in a few minutes."
      : "The interview couldn't be started. Please try again in a moment.";
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { status: "FAILED", errorMessage: message },
    });
    return { error: message, status: busy ? 503 : 502 };
  }
}

/** The intern ends their own interview (e.g. the "End interview" button). */
export async function endInterview(userId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return null;
  if (session.status === "ACTIVE" || session.status === "STARTING") {
    if (session.tavusConversationId)
      await endConversation(session.tavusConversationId).catch((error) =>
        console.error("Failed to end Tavus conversation.", error),
      );
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: { status: "ENDED", endedAt: session.endedAt ?? new Date() },
    });
  }
  return getSession(userId, sessionId);
}

/**
 * One of the intern's sessions. While results are outstanding it checks
 * Tavus directly, so feedback still arrives if a webhook was missed (or
 * can't reach this server, e.g. in local development).
 */
export async function getSession(userId: string, sessionId: string) {
  const prisma = getPrisma();
  let session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) return null;
  if (
    (session.status === "ACTIVE" || session.status === "ENDED") &&
    !session.transcript &&
    session.tavusConversationId
  ) {
    await syncFromTavus(session.tavusConversationId).catch((error) =>
      console.error("Failed to sync interview from Tavus.", error),
    );
    session = await prisma.interviewSession.findUniqueOrThrow({
      where: { id: session.id },
    });
  }
  // Grading that never finished (e.g. the server restarted): try again.
  if (
    isGradingEnabled() &&
    session.status === "ENDED" &&
    session.transcript &&
    !session.errorMessage &&
    Date.now() - session.updatedAt.getTime() > REGRADE_AFTER_MS
  ) {
    const id = session.id;
    await prisma.interviewSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    after(() => scoreSession(id));
  }
  return sessionView(session);
}

type TavusEvent = {
  event_type?: string;
  conversation_id?: string;
  properties?: {
    transcript?: TranscriptTurn[];
    shutdown_reason?: string;
    reason?: string;
    storage_uri?: string;
  };
};

async function syncFromTavus(conversationId: string) {
  const config = tavusConfig();
  if (!config) return;
  const conversation = await tavusRequest<{ events?: TavusEvent[] }>(
    config.apiKey,
    `/conversations/${conversationId}?verbose=true`,
    { method: "GET" },
  );
  for (const event of conversation.events ?? [])
    await handleTavusEvent({ ...event, conversation_id: conversationId });
}

/** Applies a Tavus callback (or an event fetched from Tavus). */
export async function handleTavusEvent(event: TavusEvent) {
  if (!event.conversation_id || !event.event_type) return;
  const prisma = getPrisma();
  const session = await prisma.interviewSession.findUnique({
    where: { tavusConversationId: event.conversation_id },
  });
  if (!session) return;

  switch (event.event_type) {
    case "system.shutdown":
      if (session.status === "ACTIVE" || session.status === "STARTING")
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: {
            status: "ENDED",
            endedAt: session.endedAt ?? new Date(),
            shutdownReason:
              event.properties?.shutdown_reason ??
              event.properties?.reason ??
              null,
          },
        });
      break;
    case "application.transcription_ready": {
      if (session.transcript) break;
      const transcript = (event.properties?.transcript ?? []).filter(
        (turn) => turn.role === "user" || turn.role === "assistant",
      );
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          transcript,
          status: session.status === "SCORED" ? "SCORED" : "ENDED",
          endedAt: session.endedAt ?? new Date(),
        },
      });
      // Grade after responding; Claude can take a little while.
      after(() => scoreSession(session.id));
      break;
    }
    case "application.recording_ready":
      if (event.properties?.storage_uri)
        await prisma.interviewSession.update({
          where: { id: session.id },
          data: { recordingUri: event.properties.storage_uri },
        });
      break;
  }
}

/** Grades a session's transcript and stores the score and feedback. */
export async function scoreSession(sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      setup: {
        include: {
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!session?.transcript || session.status === "SCORED") return;
  if (!isGradingEnabled()) return;
  const transcript = session.transcript as TranscriptTurn[];
  const answers = transcript.filter((turn) => turn.role === "user");

  // Too little said to grade: record that instead of calling Claude.
  if (answers.length < 2) {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        status: "SCORED",
        score: 0,
        scoredAt: new Date(),
        feedback: {
          summary:
            "This interview ended before you answered enough questions to score it. Try again when you have time to complete it.",
          strengths: [],
          improvements: [
            "Find a quiet place and set aside the full interview time.",
          ],
          questions: [],
        } satisfies Omit<InterviewFeedback, "overallScore">,
      },
    });
    return;
  }

  try {
    const feedback = await gradeInterview({
      track: session.setup.program.name,
      level: session.setup.level.name,
      questions: parseQuestions(session.setup.questions),
      transcript,
    });
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        status: "SCORED",
        score: feedback.overallScore,
        feedback,
        scoredAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    console.error(`Failed to grade interview ${session.id}.`, error);
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        errorMessage:
          "Your interview was saved but couldn't be scored yet. An admin can re-run the scoring.",
      },
    });
  }
}
