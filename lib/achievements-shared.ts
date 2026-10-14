import { z } from "zod";

// Achievement rules, labels and looks that both the server and the browser
// use (the admin editor, the celebration pop-up, the share card). No database
// code here, so client components can import it.

export const ACHIEVEMENT_TRIGGERS = [
  "TASK_SUBMITTED",
  "TASK_ACCEPTED",
  "PERFECT_SCORE",
  "SCORE_THRESHOLD",
  "WEEK_COMPLETE",
  "TASK_COUNT",
  "GROUP_LEADERSHIP",
  "PRACTICE_LAB_COMPLETE",
  "OFFICE_LIFE_CLOCK_IN",
  "OFFICE_LIFE_STEP",
  "OFFICE_LIFE_COMPLETE",
  "LEVEL_UP",
] as const;
export type AchievementTriggerName = (typeof ACHIEVEMENT_TRIGGERS)[number];

export const ACHIEVEMENT_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
export type AchievementRarityName = (typeof ACHIEVEMENT_RARITIES)[number];

export const OFFICE_LIFE_STEP_KINDS = ["meeting", "email", "report", "work"] as const;
export type OfficeLifeStepKind = (typeof OFFICE_LIFE_STEP_KINDS)[number];

export const TRIGGER_LABELS: Record<AchievementTriggerName, string> = {
  TASK_SUBMITTED: "Task submitted",
  TASK_ACCEPTED: "Accepted task",
  PERFECT_SCORE: "Perfect score",
  SCORE_THRESHOLD: "Score threshold",
  WEEK_COMPLETE: "Complete every task in a week",
  TASK_COUNT: "Accepted task count",
  GROUP_LEADERSHIP: "Lead an accepted group task",
  PRACTICE_LAB_COMPLETE: "Practice Lab exercise submitted",
  OFFICE_LIFE_CLOCK_IN: "Office Life: clock in",
  OFFICE_LIFE_STEP: "Office Life: meeting, email, report or work done",
  OFFICE_LIFE_COMPLETE: "Office Life day completed",
  LEVEL_UP: "Advance to an internship level",
};

export const STEP_KIND_LABELS: Record<OfficeLifeStepKind, string> = {
  meeting: "Meeting",
  email: "Email",
  report: "Report",
  work: "Work / deliverable",
};

const taskTitle = z.string().trim().max(100).optional();
const percent = z.number().int().min(1).max(100);
const score = z.number().int().min(0).max(100);

export const CONDITION_SCHEMAS: Record<AchievementTriggerName, z.ZodType> = {
  TASK_SUBMITTED: z.object({ minCount: z.number().int().min(1).max(1000).optional() }).strict(),
  TASK_ACCEPTED: z.object({ taskTitleContains: taskTitle }).strict(),
  PERFECT_SCORE: z.object({ taskTitleContains: taskTitle }).strict(),
  SCORE_THRESHOLD: z.object({ minPercent: percent, taskTitleContains: taskTitle }).strict(),
  WEEK_COMPLETE: z.object({ weekNumber: z.number().int().min(1).max(52).optional() }).strict(),
  TASK_COUNT: z.object({ minCount: z.number().int().min(1).max(1000) }).strict(),
  GROUP_LEADERSHIP: z.object({}).strict(),
  PRACTICE_LAB_COMPLETE: z.object({ minPercent: percent.optional() }).strict(),
  OFFICE_LIFE_CLOCK_IN: z.object({}).strict(),
  OFFICE_LIFE_STEP: z.object({
    stepKind: z.enum(OFFICE_LIFE_STEP_KINDS).optional(),
    minScore: score.optional(),
  }).strict(),
  OFFICE_LIFE_COMPLETE: z.object({ minScore: score.optional() }).strict(),
  LEVEL_UP: z.object({}).strict(),
};

export const AchievementDefinitionInputSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(500),
  congratulatoryMessage: z.string().trim().min(2).max(240),
  category: z.string().trim().min(2).max(80),
  trigger: z.enum(ACHIEVEMENT_TRIGGERS),
  conditions: z.record(z.string(), z.unknown()),
  programId: z.string().trim().max(100).nullable(),
  levelId: z.string().trim().max(100).nullable(),
  isRepeatable: z.boolean(),
  rarity: z.enum(ACHIEVEMENT_RARITIES),
  icon: z.string().trim().regex(/^[a-z0-9-]{1,40}$/i),
  isActive: z.boolean(),
}).superRefine((value, context) => {
  const parsed = CONDITION_SCHEMAS[value.trigger].safeParse(value.conditions);
  if (!parsed.success) {
    context.addIssue({
      code: "custom",
      path: ["conditions"],
      message: parsed.error.issues.map((issue) => issue.message).join(" "),
    });
  }
});

export type AchievementConditions = {
  taskTitleContains?: string;
  minPercent?: number;
  weekNumber?: number;
  minCount?: number;
  minScore?: number;
  stepKind?: OfficeLifeStepKind;
};

/** What happened, as far as the rules are concerned. */
export type AchievementFacts = {
  taskTitle?: string;
  scorePercent?: number | null;
  taskCount?: number;
  weekNumber?: number;
  stepKind?: string;
};

/** Whether an event meets a rule's conditions (the trigger already matched). */
export function meetsConditions(conditions: AchievementConditions, facts: AchievementFacts) {
  if (
    conditions.taskTitleContains &&
    !facts.taskTitle?.toLowerCase().includes(conditions.taskTitleContains.toLowerCase())
  ) return false;
  const minimum = conditions.minPercent ?? conditions.minScore;
  if (
    typeof minimum === "number" &&
    (facts.scorePercent === null || facts.scorePercent === undefined || facts.scorePercent < minimum)
  ) return false;
  if (
    typeof conditions.minCount === "number" &&
    (facts.taskCount === undefined || facts.taskCount < conditions.minCount)
  ) return false;
  if (typeof conditions.weekNumber === "number" && facts.weekNumber !== conditions.weekNumber) return false;
  if (conditions.stepKind && facts.stepKind !== conditions.stepKind) return false;
  return true;
}

/**
 * Fills {track} and {level} in a title or message ("Wizard of {track}" →
 * "Wizard of Digital Marketing"), so one rule reads right for every track.
 */
export function renderAchievementText(text: string, values: { track?: string | null; level?: string | null }) {
  return text
    .replace(/\{track\}/gi, values.track?.trim() || "Tech")
    .replace(/\{level\}/gi, values.level?.trim() || "New")
    .replace(/\s+/g, " ")
    .trim();
}

export type RarityTheme = {
  label: string;
  /** Gradient stops, light to deep. */
  from: string;
  to: string;
  /** Accent for text and rings on dark backgrounds. */
  accent: string;
  glow: string;
};

export const RARITY_THEMES: Record<AchievementRarityName, RarityTheme> = {
  COMMON: { label: "Achievement", from: "#7BD65E", to: "#2E9E5B", accent: "#8BE36D", glow: "rgba(95,187,70,0.55)" },
  RARE: { label: "Rare achievement", from: "#38BDF8", to: "#4F46E5", accent: "#7DD3FC", glow: "rgba(56,189,248,0.55)" },
  EPIC: { label: "Epic achievement", from: "#E879F9", to: "#7C3AED", accent: "#F0ABFC", glow: "rgba(217,70,239,0.55)" },
  LEGENDARY: { label: "Legendary achievement", from: "#FDE047", to: "#F97316", accent: "#FDE68A", glow: "rgba(250,204,21,0.6)" },
};

export function rarityTheme(rarity: string): RarityTheme {
  return RARITY_THEMES[rarity as AchievementRarityName] ?? RARITY_THEMES.COMMON;
}

/** Badge keys admins pick from, shown as emoji (they render the same in the app and on the card). */
export const BADGE_EMOJI: Record<string, string> = {
  award: "🏅",
  trophy: "🏆",
  star: "🌟",
  zap: "⚡",
  rocket: "🚀",
  crown: "👑",
  wand: "🪄",
  flame: "🔥",
  mail: "📧",
  mic: "🎙️",
  "briefcase-business": "💼",
  "calendar-check": "📅",
  "check-check": "✅",
  "code-2": "💻",
  "shield-check": "🛡️",
  "trending-up": "📈",
  flask: "🧪",
  "file-text": "📊",
  users: "🤝",
  gem: "💎",
};

export function badgeEmoji(icon: string) {
  return BADGE_EMOJI[icon] ?? "🏅";
}

/** The line under the title: what they actually did. */
export function accomplishmentLine(accomplishment: {
  taskTitle?: string | null;
  score?: number | null;
  maxScore?: number | null;
  scorePercent?: number | null;
}) {
  const parts: string[] = [];
  if (accomplishment.taskTitle) parts.push(accomplishment.taskTitle);
  if (typeof accomplishment.scorePercent === "number") parts.push(`${Math.round(accomplishment.scorePercent)}%`);
  else if (typeof accomplishment.score === "number" && typeof accomplishment.maxScore === "number")
    parts.push(`${accomplishment.score}/${accomplishment.maxScore}`);
  else if (typeof accomplishment.score === "number") parts.push(`Score ${accomplishment.score}/100`);
  return parts.join(" · ");
}

/** Channels a share can go out on (recorded for the referrals page). */
export const SHARE_CHANNELS = ["native", "whatsapp", "instagram", "linkedin", "facebook", "x", "download", "copy"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
