// Minimal Tavus client (Conversational Video Interface). An interview is a
// Tavus "conversation" with our AI interviewer (a "PAL"); Tavus returns a
// meeting link the intern joins in the browser.
//
// Settings:
//   TAVUS_API_KEY         API key from the Tavus dashboard
//   TAVUS_PAL_ID          the interviewer PAL (scripts/tavus-create-interviewer.ts)
//   TAVUS_WEBHOOK_SECRET  random string; Tavus calls back with it so we can
//                         trust the call (Tavus doesn't sign callbacks)

const TAVUS_API = "https://tavusapi.com/v2";

export class TavusError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/**
 * TAVUS_FREE_PLAN=true: the free plan ends calls at 5 minutes, so
 * interviews are kept to 4 minutes and the call hard-stops at 5.
 */
export const FREE_PLAN_INTERVIEW_MINUTES = 4;
const FREE_PLAN_CALL_LIMIT_SECONDS = 5 * 60;

export function isTavusFreePlan() {
  return process.env.TAVUS_FREE_PLAN === "true";
}

/** The interview length actually used, given the Tavus plan. */
export function effectiveInterviewMinutes(minutes: number) {
  return isTavusFreePlan()
    ? Math.min(minutes, FREE_PLAN_INTERVIEW_MINUTES)
    : minutes;
}

/** Hard stop for a call: a little headroom, within the plan's limit. */
export function callLimitSeconds(minutes: number) {
  const seconds = (effectiveInterviewMinutes(minutes) + 3) * 60;
  return isTavusFreePlan()
    ? Math.min(seconds, FREE_PLAN_CALL_LIMIT_SECONDS)
    : seconds;
}

/**
 * True when Tavus refused a new conversation because the account is
 * already running as many as its plan allows (1 on the free plan) or is
 * out of minutes.
 */
export function isTavusCapacityError(error: unknown) {
  return (
    error instanceof TavusError &&
    (error.status === 429 ||
      error.status === 402 ||
      /concurren|limit|quota|credit|minutes/i.test(error.message))
  );
}

export function tavusConfig() {
  const apiKey = process.env.TAVUS_API_KEY;
  const palId = process.env.TAVUS_PAL_ID;
  const webhookSecret = process.env.TAVUS_WEBHOOK_SECRET;
  if (!apiKey || !palId || !webhookSecret) return null;
  return { apiKey, palId, webhookSecret };
}

export async function tavusRequest<T>(
  apiKey: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const response = await fetch(`${TAVUS_API}${path}`, {
    method: init.method,
    headers: {
      "x-api-key": apiKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok)
    throw new TavusError(
      `Tavus ${init.method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
      response.status,
    );
  return (text ? JSON.parse(text) : {}) as T;
}

export type TavusConversation = {
  conversation_id: string;
  conversation_url: string;
  status: string;
};

export function createConversation(options: {
  conversationName: string;
  audioOnly: boolean;
  /** Per-interview context appended to the interviewer's instructions. */
  context: string;
  greeting: string;
  callbackUrl: string;
  maxCallSeconds: number;
}) {
  const config = tavusConfig();
  if (!config) throw new TavusError("Tavus isn't configured.");
  return tavusRequest<TavusConversation>(config.apiKey, "/conversations", {
    method: "POST",
    body: {
      pal_id: config.palId,
      conversation_name: options.conversationName,
      audio_only: options.audioOnly,
      conversational_context: options.context,
      custom_greeting: options.greeting,
      callback_url: options.callbackUrl,
      properties: {
        max_call_duration: options.maxCallSeconds,
        // End the room soon after the intern leaves, or if they never join.
        participant_left_timeout: 30,
        participant_absent_timeout: 180,
        enable_closed_captions: true,
      },
    },
  });
}

export async function endConversation(conversationId: string) {
  const config = tavusConfig();
  if (!config) return;
  await tavusRequest(config.apiKey, `/conversations/${conversationId}/end`, {
    method: "POST",
  });
}
