// AI content creation exercises (pure; safe in the browser).
//
// Three modes, one exercise kind (CONTENT):
//
//  PROMPT     Prompt Lab. For each piece the client wants, the intern writes
//             a prompt; the app runs it on a real AI model and checks the
//             output: automatic text rules (length, must/mustn't mention,
//             hashtags, emojis, readability) plus an AI judge scoring the
//             exercise's criteria. The skill: refining the prompt until the
//             output meets the brief, without writing the answer into it.
//  BRIEF      Content Brief Studio. The intern writes (with whatever AI tools
//             they like) the final pieces for a client brief; the same rules
//             and judge mark them, and simulated readers react.
//  FACTCHECK  Fact-check and edit. The intern gets an AI-written draft with
//             planted errors (wrong facts, a made-up quote, off-brand lines)
//             and reference notes; they edit the draft. Each planted error
//             they changed counts as caught; rewriting the whole draft
//             doesn't. The AI judge also checks their fixes are right.
//
// Runs are made on the server and limited per exercise (AI calls cost).

export type ContentMode = "PROMPT" | "BRIEF" | "FACTCHECK";

export const CONTENT_MODES: Record<ContentMode, { label: string; help: string }> = {
  PROMPT: {
    label: "Prompt Lab",
    help: "Interns write prompts; the AI's output is checked against the brief.",
  },
  BRIEF: {
    label: "Content Brief Studio",
    help: "Interns write the finished pieces for a client brief (AI tools allowed).",
  },
  FACTCHECK: {
    label: "Fact-check and edit",
    help: "Interns find and fix the errors planted in an AI-written draft.",
  },
};

export type RuleType = "words" | "chars" | "includes" | "excludes" | "hashtags" | "emojis" | "sentence_length" | "paragraphs";

type Field = { key: string; label: string; placeholder?: string };

export const RULE_TYPES: Record<RuleType, { label: string; fields: Field[] }> = {
  words: {
    label: "Word count",
    fields: [
      { key: "min", label: "At least (words)", placeholder: "120" },
      { key: "max", label: "At most (words)", placeholder: "150" },
    ],
  },
  chars: {
    label: "Character limit",
    fields: [{ key: "max", label: "At most (characters)", placeholder: "280" }],
  },
  includes: {
    label: "Must mention",
    fields: [{ key: "text", label: "Each of these (comma separated)", placeholder: "₦4,500, Lekki" }],
  },
  excludes: {
    label: "Must not mention",
    fields: [{ key: "text", label: "Any of these (comma separated)", placeholder: "cheap, best in the world" }],
  },
  hashtags: {
    label: "Hashtags",
    fields: [
      { key: "min", label: "At least", placeholder: "0" },
      { key: "max", label: "At most", placeholder: "3" },
    ],
  },
  emojis: {
    label: "Emojis",
    fields: [{ key: "max", label: "At most", placeholder: "2" }],
  },
  sentence_length: {
    label: "Easy to read",
    fields: [{ key: "max", label: "Average sentence at most (words)", placeholder: "20" }],
  },
  paragraphs: {
    label: "Paragraphs",
    fields: [
      { key: "min", label: "At least", placeholder: "3" },
      { key: "max", label: "At most (optional)", placeholder: "" },
    ],
  },
};

export type ContentRule = { id: string; type: RuleType; params: Record<string, string> };

/** One thing the client wants written (a caption, a blog post, an email…). */
export type ContentPiece = {
  id: string;
  label: string;
  /** What this piece must do, shown to the intern. */
  instructions: string;
  rules: ContentRule[];
};

export type ErrorKind = "FACT" | "QUOTE" | "NUMBER" | "TONE" | "CLAIM" | "COPY" | "OTHER";

export const ERROR_KINDS: Record<ErrorKind, string> = {
  FACT: "A wrong fact",
  QUOTE: "A made-up quote",
  NUMBER: "A wrong number or price",
  TONE: "Off-brand or unsuitable wording",
  CLAIM: "A claim the brand can't make",
  COPY: "A line copied from somewhere else",
  OTHER: "Another problem",
};

/** An error planted in the fact-check draft. Hidden from interns. */
export type PlantedError = {
  id: string;
  /** The exact words in the draft that are wrong. */
  find: string;
  kind: ErrorKind;
  /** Why it's wrong and what's right (shown once the intern catches it). */
  why: string;
};

export type ContentConfig = {
  mode: ContentMode;
  client: { name: string; about: string; voice: string; audience: string };
  /** PROMPT and BRIEF: what to write. */
  pieces: ContentPiece[];
  /** PROMPT and BRIEF: what the AI judge scores, 0-10 each. */
  rubric: string[];
  /** FACTCHECK: the AI-written draft, the notes it should match, the errors. */
  draft: string;
  reference: string;
  errors: PlantedError[];
  maxRuns: number;
};

/** The intern's work. PROMPT: a prompt per piece; BRIEF: a text per piece; FACTCHECK: the edited draft. */
export type ContentWork = { texts: Record<string, string>; edited: string; notes: string };

export type RuleResult = { label: string; passed: boolean; detail: string };

export type CriterionScore = { criterion: string; score: number; comment: string };

export type PieceResult = {
  pieceId: string;
  label: string;
  /** PROMPT: the prompt the intern wrote. */
  prompt?: string;
  /** The text that was marked (the AI's output, or the intern's own). */
  output: string;
  rules: RuleResult[];
  /** Empty when the AI judge wasn't available. */
  criteria: CriterionScore[];
  reactions: string[];
  feedback: string;
  /** PROMPT: the prompt already contained the answer. */
  copied: boolean;
  score: number;
};

export type ErrorResult = { id: string; label: string; kind: ErrorKind; caught: boolean; why?: string; fix?: string };

export type ContentResult = {
  score: number;
  pieces: PieceResult[];
  /** FACTCHECK. */
  errors: ErrorResult[];
  /** FACTCHECK: how much of the draft's correct text they kept (0-1). */
  kept?: number;
  summary: string;
  improvements: string[];
  /** Whether the AI judge marked this run (otherwise rules only). */
  judged: boolean;
  /** The pass/fail list shown as the exercise's "checks". */
  goals: Array<{ label: string; met: boolean }>;
};

export type ContentRun = { at: string; work: ContentWork; result: ContentResult };

const MAX_PIECES = 6;
const MAX_RULES = 12;
export const MAX_PROMPT_CHARS = 4000;
export const MAX_TEXT_CHARS = 12_000;
const MAX_DRAFT_CHARS = 15_000;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const object = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []);

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function parseRule(value: unknown): ContentRule {
  const raw = object(value);
  const type = oneOf(raw.type, Object.keys(RULE_TYPES) as RuleType[], "words");
  const params = object(raw.params);
  return {
    id: text(raw.id, 20) || newId(),
    type,
    params: Object.fromEntries(RULE_TYPES[type].fields.map((field) => [field.key, text(params[field.key], 500)])),
  };
}

export function parseContentConfig(value: unknown): ContentConfig {
  if (!value || typeof value !== "object") return DEFAULT_CONTENT_CONFIGS.PROMPT;
  const raw = object(value);
  const mode = oneOf(raw.mode, ["PROMPT", "BRIEF", "FACTCHECK"] as const, "PROMPT");
  const client = object(raw.client);
  const maxRuns = Math.round(Number(raw.maxRuns));
  return {
    mode,
    client: {
      name: text(client.name, 100).trim(),
      about: text(client.about, 2000),
      voice: text(client.voice, 500),
      audience: text(client.audience, 500),
    },
    pieces: list(raw.pieces, MAX_PIECES).map((item) => {
      const piece = object(item);
      return {
        id: text(piece.id, 20) || newId(),
        label: text(piece.label, 100).trim() || "Piece",
        instructions: text(piece.instructions, 3000),
        rules: list(piece.rules, MAX_RULES).map(parseRule),
      };
    }),
    rubric: list(raw.rubric, 8)
      .map((item) => text(item, 200).trim())
      .filter(Boolean),
    draft: text(raw.draft, MAX_DRAFT_CHARS),
    reference: text(raw.reference, 8000),
    errors: list(raw.errors, 15).map((item) => {
      const error = object(item);
      return {
        id: text(error.id, 20) || newId(),
        find: text(error.find, 500),
        kind: oneOf(error.kind, Object.keys(ERROR_KINDS) as ErrorKind[], "FACT"),
        why: text(error.why, 1000),
      };
    }),
    maxRuns: Number.isFinite(maxRuns) && maxRuns >= 1 ? Math.min(maxRuns, 20) : mode === "PROMPT" ? 8 : 3,
  };
}

/** What makes an exercise unusable; empty when it's ready. */
export function contentConfigProblems(config: ContentConfig) {
  const problems: string[] = [];
  if (!config.client.name) problems.push("Name the client.");
  if (config.mode === "FACTCHECK") {
    if (!config.draft.trim()) problems.push("Add the draft interns will fact-check.");
    if (!config.errors.length) problems.push("Plant at least one error in the draft.");
    for (const [index, error] of config.errors.entries()) {
      if (!error.find.trim()) problems.push(`Error ${index + 1} needs the wrong words from the draft.`);
      else if (!normalize(config.draft).includes(normalize(error.find)))
        problems.push(`Error ${index + 1} (“${error.find.slice(0, 40)}”) isn't in the draft word for word.`);
    }
    const finds = config.errors.map((error) => normalize(error.find));
    if (new Set(finds).size !== finds.length) problems.push("Two planted errors point at the same words.");
    return problems;
  }
  if (!config.pieces.length) problems.push("Add at least one piece to write.");
  const labels = config.pieces.map((piece) => piece.label.toLowerCase());
  if (new Set(labels).size !== labels.length) problems.push("Give every piece a different name.");
  for (const piece of config.pieces) {
    if (!piece.instructions.trim()) problems.push(`“${piece.label}” needs instructions.`);
    for (const rule of piece.rules) {
      const filled = RULE_TYPES[rule.type].fields.some((field) => rule.params[field.key]?.trim());
      if (!filled) problems.push(`A “${RULE_TYPES[rule.type].label}” rule on “${piece.label}” is empty.`);
    }
  }
  if (!config.rubric.length && !config.pieces.some((piece) => piece.rules.length))
    problems.push("Add at least one rule or judging criterion, so there's something to mark.");
  return problems;
}

export function parseContentWork(value: unknown, config: ContentConfig): ContentWork {
  const raw = object(value);
  const texts = object(raw.texts);
  const max = config.mode === "PROMPT" ? MAX_PROMPT_CHARS : MAX_TEXT_CHARS;
  return {
    texts: Object.fromEntries(config.pieces.map((piece) => [piece.id, text(texts[piece.id], max)])),
    edited: config.mode === "FACTCHECK" ? (typeof raw.edited === "string" ? raw.edited.slice(0, MAX_DRAFT_CHARS + 5000) : config.draft) : "",
    notes: text(raw.notes, 3000),
  };
}

/** Blank work for an intern starting the exercise. */
export function blankWork(config: ContentConfig): ContentWork {
  return parseContentWork({}, config);
}

/** What's ready to run; empty when it is. */
export function workProblems(work: ContentWork, config: ContentConfig) {
  if (config.mode === "FACTCHECK")
    return work.edited.trim() ? [] : ["Your edited draft is empty."];
  const missing = config.pieces.filter((piece) => !work.texts[piece.id]?.trim()).map((piece) => piece.label);
  if (!missing.length) return [];
  return [`${config.mode === "PROMPT" ? "Write a prompt for" : "Write"}: ${missing.join(", ")}.`];
}

/** What interns may see: planted errors stay hidden (only how many). */
export function publicContentConfig(config: ContentConfig) {
  const { errors, ...rest } = config;
  return { ...rest, errorCount: errors.length };
}
export type PublicContentConfig = ReturnType<typeof publicContentConfig>;

// ---------------------------------------------------------------------------
// Text rules
// ---------------------------------------------------------------------------

/** Lower case, straight quotes, one space: for matching phrases. */
export function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export const countWords = (value: string) => value.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,-]*/gu)?.length ?? 0;
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
const EMOJI = /\p{Extended_Pictographic}/gu;
const num = (value: string | undefined) => {
  const n = Number(value?.trim());
  return value?.trim() && Number.isFinite(n) ? n : null;
};
// Commas separate phrases, except inside a number (₦4,500).
const phrases = (value: string | undefined) =>
  (value ?? "")
    .split(/,(?!\d)|(?<!\d),/)
    .map((item) => item.trim())
    .filter(Boolean);

export function ruleLabel(rule: ContentRule) {
  const p = rule.params;
  const range = (unit: string) => {
    const min = num(p.min);
    const max = num(p.max);
    return min !== null && max !== null
      ? `${min}–${max} ${unit}`
      : min !== null
        ? `at least ${min} ${unit}`
        : `at most ${max ?? 0} ${unit}`;
  };
  switch (rule.type) {
    case "words":
      return range("words");
    case "chars":
      return `At most ${num(p.max) ?? 0} characters`;
    case "includes":
      return `Mentions ${phrases(p.text).join(", ")}`;
    case "excludes":
      return `Doesn't mention ${phrases(p.text).join(", ")}`;
    case "hashtags":
      return `Hashtags: ${range("")}`.trim();
    case "emojis":
      return `At most ${num(p.max) ?? 0} emoji${num(p.max) === 1 ? "" : "s"}`;
    case "sentence_length":
      return `Sentences average ${num(p.max) ?? 20} words or fewer`;
    case "paragraphs":
      return `Paragraphs: ${range("")}`.trim();
  }
}

function inRange(value: number, min: number | null, max: number | null) {
  return (min === null || value >= min) && (max === null || value <= max);
}

export function checkRule(rule: ContentRule, output: string): RuleResult {
  const p = rule.params;
  const label = ruleLabel(rule);
  const plain = normalize(output);
  switch (rule.type) {
    case "words": {
      const words = countWords(output);
      return { label, passed: inRange(words, num(p.min), num(p.max)), detail: `${words} words` };
    }
    case "chars": {
      const chars = [...output.trim()].length;
      return { label, passed: chars <= (num(p.max) ?? Infinity), detail: `${chars} characters` };
    }
    case "includes": {
      const missing = phrases(p.text).filter((phrase) => !plain.includes(normalize(phrase)));
      return { label, passed: !missing.length, detail: missing.length ? `Missing: ${missing.join(", ")}` : "All there" };
    }
    case "excludes": {
      const found = phrases(p.text).filter((phrase) => plain.includes(normalize(phrase)));
      return { label, passed: !found.length, detail: found.length ? `Found: ${found.join(", ")}` : "None found" };
    }
    case "hashtags": {
      const count = output.match(HASHTAG)?.length ?? 0;
      return { label, passed: inRange(count, num(p.min), num(p.max)), detail: `${count} hashtag${count === 1 ? "" : "s"}` };
    }
    case "emojis": {
      const count = output.match(EMOJI)?.length ?? 0;
      return { label, passed: count <= (num(p.max) ?? 0), detail: `${count} emoji${count === 1 ? "" : "s"}` };
    }
    case "sentence_length": {
      const sentences = output.split(/[.!?]+(?:\s|$)|\n+/).filter((s) => countWords(s) > 0);
      const average = sentences.length ? countWords(output) / sentences.length : 0;
      return {
        label,
        passed: sentences.length > 0 && average <= (num(p.max) ?? 20),
        detail: `Average ${Math.round(average * 10) / 10} words a sentence`,
      };
    }
    case "paragraphs": {
      const count = output.split(/\n\s*\n/).filter((block) => block.trim()).length;
      return { label, passed: inRange(count, num(p.min), num(p.max)), detail: `${count} paragraph${count === 1 ? "" : "s"}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Word sequences of `n`, for telling how much of one text is in another. */
function shingles(value: string, n: number) {
  const words = normalize(value).match(/[\p{L}\p{N}']+/gu) ?? [];
  const set = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(" "));
  return set;
}

/** How much of `part` (0-1) is found in `whole`, by 5-word runs. */
export function overlap(part: string, whole: string, n = 5) {
  const a = shingles(part, n);
  if (!a.size) return 0;
  const b = shingles(whole, n);
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared / a.size;
}

/** Prompt Lab: the prompt already contains most of the output (the intern wrote the answer). */
export function promptContainsAnswer(prompt: string, output: string) {
  return countWords(output) >= 15 && overlap(output, prompt) >= 0.5;
}

/** A piece's score: rules and judge count half each (whichever there are). */
export function scorePiece(rules: RuleResult[], criteria: CriterionScore[], copied: boolean) {
  const parts: number[] = [];
  if (rules.length) parts.push(rules.filter((rule) => rule.passed).length / rules.length);
  if (criteria.length) parts.push(criteria.reduce((sum, c) => sum + c.score, 0) / (criteria.length * 10));
  const score = parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : 0;
  return copied ? Math.min(score, 30) : score;
}

/** A judging criterion counts as met at 7/10 or more. */
export const CRITERION_PASS = 7;

export function piecesGoals(pieces: PieceResult[]) {
  const many = pieces.length > 1;
  return pieces.flatMap((piece) => {
    const prefix = many ? `${piece.label}: ` : "";
    return [
      ...piece.rules.map((rule) => ({ label: `${prefix}${rule.label}`, met: rule.passed })),
      ...piece.criteria.map((c) => ({ label: `${prefix}${c.criterion}`, met: c.score >= CRITERION_PASS })),
      ...(piece.copied ? [{ label: `${prefix}The AI wrote it, not the prompt`, met: false }] : []),
    ];
  });
}

/**
 * Fact-check: which planted errors the intern changed, and how much of the
 * draft's correct text they kept (so rewriting everything doesn't count).
 */
export function matchErrors(config: ContentConfig, edited: string) {
  const plainEdited = normalize(edited);
  const caught = config.errors.map((error) => !plainEdited.includes(normalize(error.find)));
  // The correct text, as the pieces between the errors (word runs mustn't
  // span a gap where an error was).
  let segments = [config.draft];
  for (const error of config.errors) if (error.find) segments = segments.flatMap((segment) => segment.split(error.find));
  const correct = new Set(segments.flatMap((segment) => [...shingles(segment, 4)]));
  const inEdited = shingles(edited, 4);
  let shared = 0;
  for (const item of correct) if (inEdited.has(item)) shared++;
  const kept = correct.size ? shared / correct.size : 1;
  return { caught, kept: Math.round(kept * 100) / 100 };
}

/** Rewrites that keep less than this much of the correct text lose marks. */
export const KEEP_TARGET = 0.6;

export function factCheckScore(caught: boolean[], kept: number, fixQuality: number | null) {
  if (!caught.length) return 0;
  const found = caught.filter(Boolean).length / caught.length;
  const keptFactor = Math.min(1, kept / KEEP_TARGET);
  const base = fixQuality === null ? found : found * 0.7 + fixQuality * 0.3;
  return Math.round(base * keptFactor * 100);
}

export function errorLabel(index: number, kind: ErrorKind) {
  return `Error ${index + 1}: ${ERROR_KINDS[kind].toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

const rule = (type: RuleType, params: Record<string, string>): ContentRule => ({ id: newId(), type, params });

const SWEET_CRUMBS = {
  name: "Sweet Crumbs Bakery",
  about:
    "A family bakery in Lekki, Lagos, open since 2019. Known for chin chin, meat pies and celebration cakes. New this month: the Zobo Velvet Cake, a red velvet cake flavoured with zobo, ₦4,500 for a 6-inch cake. Orders on WhatsApp: 0803 555 0142. Delivery across Lekki and Ajah.",
  voice: "Warm, cheerful and homely, like a favourite aunty. Simple English, a little Nigerian flavour, never pushy.",
  audience: "Young professionals and parents in Lekki and Ajah, 25-40, who buy cakes for birthdays and office treats.",
};

export const DEFAULT_CONTENT_CONFIGS: Record<ContentMode, ContentConfig> = {
  PROMPT: {
    mode: "PROMPT",
    client: SWEET_CRUMBS,
    pieces: [
      {
        id: "caption",
        label: "Instagram caption",
        instructions:
          "An Instagram caption launching the Zobo Velvet Cake. 60–90 words, mention the price and the WhatsApp number, end with a clear call to action, and no more than 3 hashtags.",
        rules: [
          rule("words", { min: "60", max: "90" }),
          rule("includes", { text: "₦4,500, 0803 555 0142" }),
          rule("hashtags", { min: "", max: "3" }),
          rule("excludes", { text: "cheapest, best in Nigeria" }),
        ],
      },
    ],
    rubric: [
      "Sounds like the brand voice",
      "Opens with a hook that stops the scroll",
      "Ends with a clear call to action",
    ],
    draft: "",
    reference: "",
    errors: [],
    maxRuns: 8,
  },
  BRIEF: {
    mode: "BRIEF",
    client: SWEET_CRUMBS,
    pieces: [
      {
        id: "email",
        label: "Customer email",
        instructions:
          "An email to past customers announcing the Zobo Velvet Cake. Include a subject line on the first line, 120–200 words, the price, how to order, and a reason to order this week.",
        rules: [rule("words", { min: "120", max: "200" }), rule("includes", { text: "₦4,500, WhatsApp" })],
      },
      {
        id: "script",
        label: "30-second video script",
        instructions:
          "A script for a 30-second TikTok/Reels video showing the cake being cut. Include what's on screen and what's said. About 60–80 spoken words.",
        rules: [rule("words", { min: "60", max: "140" })],
      },
    ],
    rubric: [
      "Follows the brief exactly",
      "Matches the brand voice",
      "Clear structure that's easy to follow",
      "Original, not generic AI filler",
    ],
    draft: "",
    reference: "",
    errors: [],
    maxRuns: 3,
  },
  FACTCHECK: {
    mode: "FACTCHECK",
    client: SWEET_CRUMBS,
    pieces: [],
    rubric: [],
    reference:
      "Sweet Crumbs Bakery facts (from the client):\n• Opened in 2019 by Mrs Funmi Adeyemi.\n• Based in Lekki Phase 1, Lagos. Delivers to Lekki and Ajah only.\n• Zobo Velvet Cake: ₦4,500 (6-inch). Made with real zobo (hibiscus) and cream cheese frosting.\n• Orders: WhatsApp 0803 555 0142. Order at least 24 hours ahead.\n• No awards so far. Uses no preservatives.",
    draft:
      "Meet the Zobo Velvet Cake from Sweet Crumbs Bakery!\n\nSince opening in 2015, Sweet Crumbs has been Lekki's favourite family bakery. Our new Zobo Velvet Cake blends real hibiscus with soft red velvet sponge and a silky cream cheese frosting.\n\n\"It's the best cake I've ever tasted,\" says celebrity chef Tolu Bakare.\n\nAt just ₦3,500 for a 6-inch cake, it's the perfect treat for birthdays and office celebrations. Winner of the 2024 Lagos Baking Award, our cakes are made fresh with no preservatives.\n\nWe deliver anywhere in Lagos. Order on WhatsApp at 0803 555 0142, at least 24 hours ahead. Cheap cakes for cheap people? Not here!",
    errors: [
      { id: "year", find: "Since opening in 2015", kind: "FACT", why: "Sweet Crumbs opened in 2019, not 2015." },
      {
        id: "quote",
        find: "\"It's the best cake I've ever tasted,\" says celebrity chef Tolu Bakare.",
        kind: "QUOTE",
        why: "There's no such quote in the client's facts. Never publish a quote nobody gave you.",
      },
      { id: "price", find: "₦3,500", kind: "NUMBER", why: "The cake costs ₦4,500." },
      {
        id: "award",
        find: "Winner of the 2024 Lagos Baking Award",
        kind: "CLAIM",
        why: "The bakery hasn't won any awards. A made-up award could get the client in trouble.",
      },
      { id: "delivery", find: "We deliver anywhere in Lagos", kind: "FACT", why: "They deliver to Lekki and Ajah only." },
      { id: "tone", find: "Cheap cakes for cheap people? Not here!", kind: "TONE", why: "Insults customers and doesn't fit a warm, homely voice." },
    ],
    maxRuns: 3,
  },
};
