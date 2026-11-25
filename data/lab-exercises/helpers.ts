// One Practice Lab exercise per track, level and week. Each level is one
// client's project: every week finishes a part of the level's milestone
// (data/milestones), so the brief always says what it adds up to.

export type LabKindName = "WEB" | "ADS" | "SOCIAL" | "AUTOMATION" | "BACKEND" | "WORDPRESS" | "CONTENT";

export type LabExercise = {
  track: string;
  level: string;
  week: number;
  kind: LabKindName;
  /** Without "Week N: ", which is added. */
  title: string;
  brief: string;
  config?: Record<string, unknown>;
  starterFiles?: Record<string, string>;
  solutionFiles?: Record<string, string>;
  checks?: { label: string; code: string }[];
  /** A good answer, for the tests only: text per piece (or the corrected draft). */
  model?: Record<string, string>;
  /** Automations: the AI step's right answer for each record. */
  labels?: Record<string, string>;
};

/** A brief: the situation, what to do, and what it adds to. */
export function brief(situation: string, steps: string[], adds: string) {
  return `${situation}\n\nDo this:\n${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nWhat this adds to: ${adds}`;
}

// ── Content lab ─────────────────────────────────────────────────────────────

type RuleInput = Record<string, string>;
const rule = (type: string, params: RuleInput) => ({ type, params });

/** Phrases are separated by commas, so a phrase can't contain one. */
export const must = (...phrases: string[]) => rule("includes", { text: phrases.join(", ") });
export const avoid = (...phrases: string[]) => rule("excludes", { text: phrases.join(", ") });
export const words = (min: number, max: number) => rule("words", { min: String(min), max: String(max) });
export const chars = (max: number) => rule("chars", { max: String(max) });
export const easy = (max = 20) => rule("sentence_length", { max: String(max) });
export const tags = (min: number, max: number) => rule("hashtags", { min: String(min), max: String(max) });
export const paragraphs = (min: number) => rule("paragraphs", { min: String(min), max: "" });

export type Client = { name: string; about: string; voice: string; audience: string };

export function piece(label: string, instructions: string, ...rules: ReturnType<typeof rule>[]) {
  return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20), label, instructions, rules: rules.map((item, index) => ({ id: `r${index + 1}`, ...item })) };
}

export function writing(client: Client, rubric: string[], pieces: ReturnType<typeof piece>[], mode: "BRIEF" | "PROMPT" = "BRIEF") {
  return { mode, client, pieces, rubric, draft: "", reference: "", errors: [], maxRuns: mode === "PROMPT" ? 8 : 4 };
}

export type Mistake = [find: string, fix: string, why: string, kind?: string];

/** "Find and fix the mistakes": the draft holds each mistake word for word. */
export function correcting(client: Client, draft: string, reference: string, mistakes: Mistake[]) {
  return {
    mode: "FACTCHECK",
    client,
    pieces: [],
    rubric: [],
    draft,
    reference,
    errors: mistakes.map(([find, , why, kind = "FACT"], index) => ({ id: `e${index + 1}`, find, kind, why })),
    maxRuns: 4,
  };
}

export function corrected(draft: string, mistakes: Mistake[]) {
  return { edited: mistakes.reduce((text, [find, fix]) => text.replace(find, fix), draft) };
}
