import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// One way to ask an AI model for a structured (JSON) answer, used by every
// AI feature (lab reviews, simulators, interview grading). Providers are
// tried in order and the first good answer wins:
//
//   1. Anthropic (Claude)      ANTHROPIC_API_KEY
//   2. Google Gemini           GEMINI_API_KEY      (free tier available)
//   3. OpenRouter              OPENROUTER_API_KEY  (free models router)
//   4. Groq                    GROQ_API_KEY        (free tier available)
//   5. xAI Grok                XAI_API_KEY
//
// Only providers with a key are tried. Each model can be changed with
// GEMINI_MODEL, OPENROUTER_MODEL, GROQ_MODEL or XAI_MODEL. If every
// provider fails, the call throws and the feature falls back to its own
// rules (or skips the AI part).

type Effort = "low" | "medium";

type CompatibleProvider = {
  name: string;
  key: string | undefined;
  url: string;
  model: string;
};

/** OpenAI-style chat APIs (Gemini, OpenRouter, Groq and xAI all offer one). */
function compatibleProviders(): CompatibleProvider[] {
  const env = process.env;
  return [
    {
      name: "Gemini",
      key: env.GEMINI_API_KEY,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
    },
    {
      name: "OpenRouter",
      key: env.OPENROUTER_API_KEY,
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: env.OPENROUTER_MODEL || "openrouter/free",
    },
    {
      name: "Groq",
      key: env.GROQ_API_KEY,
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    {
      name: "xAI",
      key: env.XAI_API_KEY,
      url: "https://api.x.ai/v1/chat/completions",
      model: env.XAI_MODEL || "grok-3-mini",
    },
  ];
}

/** The AI providers that have a key, in the order they're tried. */
export function aiProviders(): string[] {
  return [
    ...(process.env.ANTHROPIC_API_KEY ? ["Anthropic"] : []),
    ...compatibleProviders()
      .filter((p) => p.key)
      .map((p) => p.name),
  ];
}

/** Whether any AI provider is set up. */
export function isAiEnabled() {
  return aiProviders().length > 0;
}

export class AiUnavailableError extends Error {}

/** A request that hangs is given up on so the next provider can answer. */
const TIMEOUT_MS = 90_000;

async function askAnthropic<S extends z.ZodType>(
  options: AskOptions<S>,
): Promise<z.infer<S>> {
  const response = await new Anthropic().beta.messages.parse({
    model: "claude-sonnet-5-5",
    max_tokens: options.maxTokens,
    // On a classifier decline, retry server-side on Anthropic's recommended
    // fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: options.effort, format: zodOutputFormat(options.schema) },
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("declined");
  if (!response.parsed_output) throw new Error("unreadable answer");
  return response.parsed_output as z.infer<S>;
}

/** The JSON object in a reply (some models wrap it in ``` fences or text). */
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON in the answer");
    return JSON.parse(body.slice(start, end + 1));
  }
}

async function askCompatible<S extends z.ZodType>(
  provider: CompatibleProvider,
  options: AskOptions<S>,
): Promise<z.infer<S>> {
  const schema = JSON.stringify(z.toJSONSchema(options.schema));
  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
      // OpenRouter shows these on its dashboard; others ignore them.
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://grouhacademy.com",
      "X-Title": "Grouh Academy",
    },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: Math.min(options.maxTokens, 8000),
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${options.system}

Answer with one JSON object only (no other text) that matches this JSON Schema:
${schema}`,
        },
        { role: "user", content: options.prompt },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`HTTP ${response.status} ${detail}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new Error("empty answer");
  const parsed = options.schema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error(`answer didn't match the schema: ${parsed.error.message.slice(0, 300)}`);
  return parsed.data;
}

type AskOptions<S extends z.ZodType> = {
  /** What it's for, in logs (e.g. "lab review"). */
  task: string;
  schema: S;
  system: string;
  prompt: string;
  maxTokens: number;
  /** How hard Claude thinks; other providers ignore it. */
  effort: Effort;
};

/**
 * Asks the first available provider for an answer matching `schema`,
 * moving on to the next if one fails. Throws AiUnavailableError when none
 * is set up or every one fails.
 */
export async function generateObject<S extends z.ZodType>(
  options: AskOptions<S>,
): Promise<z.infer<S>> {
  const attempts: Array<{ name: string; run: () => Promise<z.infer<S>> }> = [
    ...(process.env.ANTHROPIC_API_KEY ? [{ name: "Anthropic", run: () => askAnthropic(options) }] : []),
    ...compatibleProviders()
      .filter((provider) => provider.key)
      .map((provider) => ({ name: provider.name, run: () => askCompatible(provider, options) })),
  ];
  if (!attempts.length) throw new AiUnavailableError("No AI provider is set up.");
  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${attempt.name}: ${message}`);
      console.warn(`[ai] ${options.task}: ${attempt.name} failed, trying the next provider.`, message);
    }
  }
  throw new AiUnavailableError(`Every AI provider failed (${failures.join("; ")}).`);
}
