import { after } from "next/server";
import { isAiEnabled } from "@/lib/ai";
import { isLabMediaEnabled } from "@/lib/lab-media";
import { mediaSrc } from "@/lib/lab-media-shared";
import { getSiteUrl } from "@/lib/site-url";
import { Prisma, type LabScenario } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getInternTrackAccess } from "@/lib/intern-resources";
import { getInternTaskContext } from "@/lib/intern-tasks";
import {
  MAX_SUBMISSION_LENGTH,
  submissionBlockedReason,
} from "@/lib/task-submission";
import { recomputeInternProgress } from "@/lib/internship-progress";
import {
  codeSubmissionFlags,
  gradeLabTask,
  scoreCodeChecks,
  type LabTaskGrade,
} from "@/lib/lab-task-grading";
import { reviewLabCode, type LabReview } from "@/lib/lab-review";
import {
  blankWork,
  CONTENT_MODES,
  parseContentConfig,
  parseContentWork,
  publicContentConfig,
  workProblems,
  type ContentRun,
} from "@/lib/content-sim/model";
import { evaluateContent, NoAiError } from "@/lib/content-sim/evaluate";
import {
  describeWpWork,
  parseWpConfig,
  parseWpResults,
  parseWpWork,
  publicWpConfig,
} from "@/lib/wp-sim/model";
import {
  isCodeKind,
  LAB_KIND_LABEL,
  normalizeChecks,
  normalizeFiles,
  type LabCheckResult,
  type LabFiles,
} from "@/lib/lab-shared";
import {
  BLANK_CAMPAIGN,
  DESTINATIONS,
  FORMATS as AD_FORMATS,
  keepOwnMedia,
  campaignProblems,
  formatGoalValue,
  LOCATIONS,
  OBJECTIVES,
  parseAdsConfig,
  parseCampaign,
  publicAdsConfig,
  simulateCampaign,
  type Campaign,
  type RunResult,
} from "@/lib/ads-sim/model";
import { judgeCampaign, type AdFeedback } from "@/lib/ads-sim/evaluate";
import {
  DAYS,
  FORMATS,
  formatSocialGoal,
  parsePlan,
  parseSocialConfig,
  PILLARS,
  PLATFORMS,
  planProblems,
  publicSocialConfig,
  scoreWeek,
  simulateWeek,
  type PlanRatings,
  type SimComment,
  type SocialFeedback,
  type SocialPlan,
  type SocialResult,
} from "@/lib/social-sim/model";
import { gradeReplies, judgeWeek } from "@/lib/social-sim/evaluate";
import {
  ACTIONS,
  BLANK_WORKFLOW,
  describeEffect,
  expectedFrom,
  parseAutomationConfig,
  parseWorkflow,
  publicAutomationConfig,
  publicResult,
  scoreWorkflow,
  TRIGGERS,
  workflowProblems,
  type AutomationConfig,
  type AutomationResult,
  type Workflow,
} from "@/lib/automation-sim/model";
import { aiLabelsFor } from "@/lib/automation-sim/evaluate";
import {
  compactBackendResult,
  parseBackendConfig,
  parseBackendFiles,
  publicBackendConfig,
  publicBackendResult,
  sortedFileNames,
  type BackendFiles,
  type BackendResult,
} from "@/lib/backend-sim/model";
import { BusyError, runBackendTestsIsolated } from "@/lib/backend-sim/server";

// Practice Lab (server side). Interns see published exercises on their
// track at their level or below (the same rule as Resources).
//
// Code exercises (WEB/REACT): attempts are autosaved; submitting stores the
// check results from the intern's browser and, when an AI key is set (see
// lib/ai.ts), an AI code review.
//
// An exercise linked to a cohort task grades that task on submit: the lab
// percentage against the task's pass mark (code: the exercise's own checks
// passed; simulators: the run score worked out here). Mentors can still
// change the grade.
//
// Ad campaign exercises (ADS): the campaign is judged and simulated here on
// the server, a limited number of times; the intern submits their best run.
//
// Social media exercises (SOCIAL): a week of posts is judged and simulated
// the same way; each run also brings follower comments, and the intern's
// replies are graded once per run into a community score.
//
// AI automation exercises (AUTOMATION): the intern's workflow runs here on
// the sample records (AI steps answered by Claude) and is checked against
// what the admin's model workflow does. Submitting also runs the hidden
// test records; interns only ever see those as passed or failed.
//
// Backend API exercises (BACKEND): the intern's Express API runs in a
// sandbox in their browser while they work (visible tests included).
// Submitting runs every test, hidden ones too, here on the server in a
// worker thread (lib/backend-sim/server), never in this process; interns
// see hidden tests as passed or failed with the admin's hint. Submissions
// also get an AI code review when an AI key is set (see lib/ai.ts).
//
// WordPress exercises (WORDPRESS): a real WordPress site runs in the
// intern's browser (WordPress Playground) and is saved there, never here.
// The checks run inside that site; submitting sends their results with a
// summary of the site and the files the intern wrote. Results that don't
// match the exercise's checks send a pass to a mentor instead.
//
// AI content exercises (CONTENT): Prompt Lab runs the intern's prompts on a
// real AI model and marks the output; Brief Studio marks the pieces they
// wrote; Fact-check marks which planted errors they fixed. Every run is
// made here on the server within the exercise's run limit (AI calls cost),
// and the intern submits their best run (see lib/content-sim).

export function isLabReviewEnabled() {
  return isAiEnabled();
}

/** One simulated ad campaign run, as stored on the attempt. */
export type AdsRun = {
  at: string;
  campaign: Campaign;
  result: RunResult;
  feedback: AdFeedback;
};

/** One simulated week of social posts, as stored on the attempt. */
export type SocialRun = {
  at: string;
  plan: SocialPlan;
  ratings: PlanRatings;
  feedback: SocialFeedback;
  comments: SimComment[];
  /** Set once the intern's replies have been graded. */
  repliedAt: string | null;
  result: SocialResult;
};

/** One run of an automation workflow, as stored on the attempt. */
export type AutomationRun = {
  at: string;
  workflow: Workflow;
  /** Submitted runs include the hidden test records. */
  full: boolean;
  result: AutomationResult;
};

/** One server-side test run of a backend API (made on each submit). */
export type BackendRun = {
  at: string;
  result: BackendResult;
};

const MAX_STORED_RUNS = 100;
/** Backend runs hold responses and logs, so fewer are kept. */
const MAX_BACKEND_RUNS = 10;
/** Between backend submissions, so one intern can't keep the testers busy. */
const BACKEND_SUBMIT_COOLDOWN_MS = 10_000;

function storedRuns<T = AdsRun>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Goals for a simulator exercise (shown as its "checks"). */
function goalCount(kind: string, config: unknown) {
  if (kind === "AUTOMATION") return parseAutomationConfig(config).records.length;
  if (kind === "BACKEND") return parseBackendConfig(config).tests.length;
  if (kind === "WORDPRESS") return parseWpConfig(config).checks.length;
  if (kind === "CONTENT") return contentGoalCount(parseContentConfig(config));
  return kind === "SOCIAL"
    ? parseSocialConfig(config).goals.length
    : parseAdsConfig(config).goals.length;
}

/**
 * What the model workflow does for each record. Worked out when the
 * exercise is saved; worked out now if it's missing.
 */
export async function expectedResults(config: AutomationConfig) {
  if (config.expected) return config.expected;
  const labels = await aiLabelsFor(config.solution, config.records);
  return expectedFrom(config.solution, config, labels);
}

/** Runs a workflow on records and checks it against the model workflow. */
export async function runAutomation(
  config: AutomationConfig,
  workflow: Workflow,
  records = config.records,
) {
  const [expected, labels] = await Promise.all([
    expectedResults(config),
    aiLabelsFor(workflow, records),
  ]);
  return scoreWorkflow(workflow, config, expected, labels, records);
}

/** Stored runs as an intern may see them (hidden records pass/fail only). */
const publicRuns = (runs: AutomationRun[]) =>
  runs.map((run) => ({ ...run, result: publicResult(run.result) }));
const publicBackendRuns = (runs: BackendRun[]) =>
  runs.map((run) => ({ ...run, result: publicBackendResult(run.result) }));

const accessWhere = (access: Awaited<ReturnType<typeof getInternTrackAccess>>) =>
  access.map(({ programId, rank }) => ({
    programId,
    level: { rank: { lte: rank } },
  }));

/** Published exercises the intern may open, with their own progress. */
export async function listLabForIntern(userId: string) {
  const access = await getInternTrackAccess(userId);
  if (!access.length) return [];
  const scenarios = await getPrisma().labScenario.findMany({
    where: { published: true, OR: accessWhere(access) },
    orderBy: [{ level: { rank: "asc" } }, { createdAt: "asc" }],
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      attempts: {
        where: { userId },
        select: { status: true, checksPassed: true, checksTotal: true },
      },
    },
  });
  return scenarios.map((scenario) => {
    const attempt = scenario.attempts[0];
    return {
      id: scenario.id,
      title: scenario.title,
      kind: scenario.kind,
      kindLabel: LAB_KIND_LABEL[scenario.kind],
      track: scenario.program.name,
      level: scenario.level.name,
      // Code: number of checks. Simulators: number of goals.
      checkCount: isCodeKind(scenario.kind)
        ? normalizeChecks(scenario.checks).length
        : goalCount(scenario.kind, scenario.config),
      status: attempt?.status ?? null,
      checksPassed: attempt?.checksPassed ?? null,
      checksTotal: attempt?.checksTotal ?? null,
    };
  });
}

/** One exercise for the intern, or null if it isn't on their track/level. */
async function scenarioForIntern(userId: string, scenarioId: string) {
  const access = await getInternTrackAccess(userId);
  if (!access.length) return null;
  return getPrisma().labScenario.findFirst({
    where: { id: scenarioId, published: true, OR: accessWhere(access) },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
    },
  });
}

/**
 * The cohort task this exercise is being done for, if `taskId` names one of
 * the intern's own cohort tasks that's linked to it.
 */
async function linkedTask(
  userId: string,
  scenarioId: string,
  taskId?: string | null,
) {
  if (!taskId) return null;
  const context = await getInternTaskContext(userId);
  if (!context?.cohortId) return null;
  return getPrisma().internshipTask.findFirst({
    where: { id: taskId, cohortId: context.cohortId, labScenarioId: scenarioId },
    select: {
      id: true,
      title: true,
      kind: true,
      opensAt: true,
      dueDate: true,
      maxScore: true,
      labPassMark: true,
      module: { select: { programId: true } },
    },
  });
}

/**
 * The attempt columns attemptView needs. Reads and writes select only what
 * they use: an attempt's files and simulator runs can be hundreds of KB,
 * and every byte read counts towards database egress.
 */
const VIEW_FIELDS = {
  status: true,
  checkResults: true,
  checksPassed: true,
  checksTotal: true,
  review: true,
  submittedAt: true,
} as const;

function attemptView(
  attempt: {
    status: string;
    checkResults: unknown;
    checksPassed: number | null;
    checksTotal: number | null;
    review: unknown;
    runs?: unknown;
    submittedAt: Date | null;
  } | null,
) {
  if (!attempt) return null;
  return {
    status: attempt.status,
    checkResults: (attempt.checkResults as LabCheckResult[] | null) ?? null,
    checksPassed: attempt.checksPassed,
    checksTotal: attempt.checksTotal,
    // Simulators also keep their submitted run here; only an AI review counts.
    review:
      attempt.review && typeof (attempt.review as LabReview).summary === "string"
        ? (({ rating, summary, strengths, improvements }: LabReview) => ({
            rating,
            summary,
            strengths,
            improvements,
          }))(attempt.review as LabReview)
        : null,
    // Every AI provider failed (e.g. free-tier limits): no review is coming.
    reviewUnavailable: Boolean(
      attempt.review && (attempt.review as { unavailable?: unknown }).unavailable === true,
    ),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
  };
}

export async function getLabForIntern(
  userId: string,
  scenarioId: string,
  taskId?: string | null,
) {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario) return null;
  const [attempt, task] = await Promise.all([
    getPrisma().labAttempt.findUnique({
      where: { userId_scenarioId: { userId, scenarioId } },
    }),
    linkedTask(userId, scenarioId, taskId),
  ]);
  const common = {
    id: scenario.id,
    title: scenario.title,
    brief: scenario.brief,
    kindLabel: LAB_KIND_LABEL[scenario.kind],
    track: scenario.program.name,
    level: scenario.level.name,
    attempt: attemptView(attempt),
    task: task
      ? { id: task.id, title: task.title, passMark: task.labPassMark }
      : null,
    reviewEnabled: isLabReviewEnabled(),
  };

  if (scenario.kind === "ADS") {
    const config = parseAdsConfig(scenario.config);
    return {
      ...common,
      kind: "ADS" as const,
      // The ideal audience and market prices stay hidden.
      ads: publicAdsConfig(config),
      campaign: attempt
        ? parseCampaign(attempt.files)
        : { ...BLANK_CAMPAIGN, name: `${config.business.name} campaign` },
      // Older runs had one ad on the campaign itself.
      runs: storedRuns<AdsRun>(attempt?.runs).map((run) => ({
        ...run,
        campaign: parseCampaign(run.campaign),
      })),
      /** Whether interns can upload ad images (file storage is set up). */
      mediaEnabled: isLabMediaEnabled(),
    };
  }

  if (scenario.kind === "BACKEND") {
    const starterFiles = parseBackendFiles(scenario.starterFiles);
    return {
      ...common,
      kind: "BACKEND" as const,
      // Hidden tests and the model answer stay hidden.
      backend: publicBackendConfig(parseBackendConfig(scenario.config)),
      starterFiles,
      files: attempt ? parseBackendFiles(attempt.files, starterFiles) : starterFiles,
      // Only the last submission is shown, so only it is sent.
      runs: publicBackendRuns(storedRuns<BackendRun>(attempt?.runs).slice(-1)),
    };
  }

  if (scenario.kind === "CONTENT") {
    const config = parseContentConfig(scenario.config);
    return {
      ...common,
      kind: "CONTENT" as const,
      // Fact-check: the planted errors stay hidden.
      content: publicContentConfig(config),
      work: attempt ? parseContentWork(attempt.files, config) : blankWork(config),
      runs: storedRuns<ContentRun>(attempt?.runs),
      aiEnabled: isAiEnabled(),
    };
  }

  if (scenario.kind === "WORDPRESS") {
    return {
      ...common,
      kind: "WORDPRESS" as const,
      wp: publicWpConfig(parseWpConfig(scenario.config)),
      // What was last submitted (the site itself is in their browser).
      work: attempt?.files ? parseWpWork(attempt.files) : null,
    };
  }

  if (scenario.kind === "AUTOMATION") {
    const config = parseAutomationConfig(scenario.config);
    const expected = await expectedResults(config);
    return {
      ...common,
      kind: "AUTOMATION" as const,
      // The hidden records, model workflow and right trigger stay hidden.
      automation: publicAutomationConfig({ ...config, expected }),
      workflow: attempt ? parseWorkflow(attempt.files) : BLANK_WORKFLOW,
      runs: publicRuns(storedRuns<AutomationRun>(attempt?.runs)),
    };
  }

  if (scenario.kind === "SOCIAL") {
    const config = parseSocialConfig(scenario.config);
    return {
      ...common,
      kind: "SOCIAL" as const,
      // The audience type (peak hours) and benchmarks stay hidden.
      social: publicSocialConfig(config),
      plan: attempt ? parsePlan(attempt.files) : { posts: [] },
      runs: storedRuns<SocialRun>(attempt?.runs),
    };
  }

  const starter = normalizeFiles(scenario.kind, scenario.starterFiles);
  return {
    ...common,
    kind: scenario.kind,
    // Interns see what the checks test; the model answer stays admin-only.
    checks: normalizeChecks(scenario.checks),
    starterFiles: starter,
    files: attempt
      ? normalizeFiles(scenario.kind, attempt.files, starter)
      : starter,
  };
}

export type InternLab = NonNullable<Awaited<ReturnType<typeof getLabForIntern>>>;
export type InternCodeLab = Extract<InternLab, { kind: "WEB" | "REACT" }>;
export type InternAdsLab = Extract<InternLab, { kind: "ADS" }>;
export type InternSocialLab = Extract<InternLab, { kind: "SOCIAL" }>;
export type InternAutomationLab = Extract<InternLab, { kind: "AUTOMATION" }>;
export type InternBackendLab = Extract<InternLab, { kind: "BACKEND" }>;
export type InternWordPressLab = Extract<InternLab, { kind: "WORDPRESS" }>;
export type InternContentLab = Extract<InternLab, { kind: "CONTENT" }>;

/** Autosaves the intern's work (keeps a submitted attempt's results). */
export async function saveLabDraft(
  userId: string,
  scenarioId: string,
  files: unknown,
) {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario) return false;
  // WordPress sites are saved in the intern's browser.
  if (scenario.kind === "WORDPRESS") return true;
  const work = scenario.kind === "CONTENT"
    ? parseContentWork(files, parseContentConfig(scenario.config))
    : isCodeKind(scenario.kind)
    ? normalizeFiles(scenario.kind, files)
    : scenario.kind === "SOCIAL"
      ? parsePlan(files)
      : scenario.kind === "AUTOMATION"
        ? parseWorkflow(files)
        : scenario.kind === "BACKEND"
          ? parseBackendFiles(files, parseBackendFiles(scenario.starterFiles))
          : keepOwnMedia(parseCampaign(files), userId);
  await getPrisma().labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: { userId, scenarioId, files: work },
    update: { files: work },
    select: { id: true },
  });
  return true;
}

/**
 * Judges and simulates the intern's ad campaign, within the exercise's run
 * limit, and keeps the run.
 */
export async function runAdsCampaign(
  userId: string,
  scenarioId: string,
  input: unknown,
): Promise<{ run: AdsRun; runsUsed: number } | { error: string; status: number }> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario || scenario.kind !== "ADS")
    return { error: "Exercise not found.", status: 404 };
  const config = parseAdsConfig(scenario.config);
  // Interns can only use images they uploaded themselves.
  const campaign = keepOwnMedia(parseCampaign(input), userId);
  const problems = campaignProblems(campaign, config);
  if (problems.length) return { error: problems.join(" "), status: 400 };

  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: { userId, scenarioId, files: campaign },
    update: { files: campaign },
    select: { id: true, runs: true },
  });
  const runs = storedRuns(attempt.runs);
  if (runs.length >= config.maxRuns)
    return {
      error: `You've used all ${config.maxRuns} runs for this exercise. Submit your best one.`,
      status: 409,
    };

  const { ratings, feedback } = await judgeCampaign(campaign, config);
  const result = simulateCampaign({
    campaign,
    config,
    ratings,
    seed: `${attempt.id}:${runs.length}`,
  });
  const run: AdsRun = { at: new Date().toISOString(), campaign, result, feedback };
  await prisma.labAttempt.update({
    where: { id: attempt.id },
    select: { id: true },
    data: { runs: [...runs, run] as unknown as Prisma.InputJsonValue },
  });
  return { run, runsUsed: runs.length + 1 };
}

/**
 * Judges and simulates the intern's week of social posts (within the run
 * limit) and keeps the run, with the follower comments to reply to.
 */
export async function runSocialWeek(
  userId: string,
  scenarioId: string,
  input: unknown,
): Promise<{ run: SocialRun; runsUsed: number } | { error: string; status: number }> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario || scenario.kind !== "SOCIAL")
    return { error: "Exercise not found.", status: 404 };
  const config = parseSocialConfig(scenario.config);
  const plan = parsePlan(input);
  const problems = planProblems(plan, config);
  if (problems.length) return { error: problems.slice(0, 5).join(" "), status: 400 };

  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: { userId, scenarioId, files: plan },
    update: { files: plan },
    select: { id: true, runs: true },
  });
  const runs = storedRuns<SocialRun>(attempt.runs);
  if (runs.length >= config.maxRuns)
    return {
      error: `You've used all ${config.maxRuns} runs for this exercise. Submit your best one.`,
      status: 409,
    };

  const run = await simulateSocialRun(plan, config, `${attempt.id}:${runs.length}`);
  await prisma.labAttempt.update({
    where: { id: attempt.id },
    select: { id: true },
    data: { runs: [...runs, run] as unknown as Prisma.InputJsonValue },
  });
  return { run, runsUsed: runs.length + 1 };
}

/** How many pass/fail items an AI content exercise marks. */
function contentGoalCount(config: ReturnType<typeof parseContentConfig>) {
  if (config.mode === "FACTCHECK") return config.errors.length;
  return config.pieces.reduce((sum, piece) => sum + piece.rules.length + config.rubric.length, 0);
}

/**
 * Marks the intern's AI content work (Prompt Lab: runs their prompts
 * first), within the exercise's run limit, and keeps the run.
 */
export async function runContent(
  userId: string,
  scenarioId: string,
  input: unknown,
): Promise<{ run: ContentRun; runsUsed: number } | { error: string; status: number }> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario || scenario.kind !== "CONTENT")
    return { error: "Exercise not found.", status: 404 };
  const config = parseContentConfig(scenario.config);
  const work = parseContentWork(input, config);
  const problems = workProblems(work, config);
  if (problems.length) return { error: problems.join(" "), status: 400 };

  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: { userId, scenarioId, files: work },
    update: { files: work },
    select: { id: true, runs: true },
  });
  const runs = storedRuns<ContentRun>(attempt.runs);
  const limitReached = {
    error: `You've used all ${config.maxRuns} runs for this exercise. Submit your best one.`,
    status: 409,
  };
  if (runs.length >= config.maxRuns) return limitReached;

  let result;
  try {
    result = await evaluateContent(config, work);
  } catch (error) {
    if (error instanceof NoAiError)
      return { error: "The AI is busy or unavailable right now, so your run wasn't used. Try again in a few minutes.", status: 503 };
    console.error("[practice-lab] Content run failed.", error);
    return { error: "Your work couldn't be marked just now. Try again.", status: 500 };
  }
  const run: ContentRun = { at: new Date().toISOString(), work, result };
  // Only if no other run was added meanwhile (two tabs at once), so the
  // limit holds.
  const saved = await prisma.labAttempt.updateMany({
    where: {
      id: attempt.id,
      runs: attempt.runs === null ? { equals: Prisma.AnyNull } : { equals: attempt.runs as Prisma.InputJsonValue },
    },
    data: { runs: [...runs, run] as unknown as Prisma.InputJsonValue },
  });
  if (!saved.count) return { error: "Another run finished at the same time. Reload the page to see it.", status: 409 };
  return { run, runsUsed: runs.length + 1 };
}

/**
 * Tests the intern's workflow on the sample records (not the hidden ones),
 * within the exercise's run limit, and keeps the run.
 */
export async function runAutomationTest(
  userId: string,
  scenarioId: string,
  input: unknown,
): Promise<{ run: AutomationRun; runsUsed: number } | { error: string; status: number }> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario || scenario.kind !== "AUTOMATION")
    return { error: "Exercise not found.", status: 404 };
  const config = parseAutomationConfig(scenario.config);
  const workflow = parseWorkflow(input);
  const problems = workflowProblems(workflow, config);
  if (problems.length) return { error: problems.slice(0, 4).join(" "), status: 400 };

  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: { userId, scenarioId, files: workflow },
    update: { files: workflow },
    select: { id: true, runs: true },
  });
  const runs = storedRuns<AutomationRun>(attempt.runs);
  const tests = runs.filter((run) => !run.full).length;
  if (tests >= config.maxRuns)
    return {
      error: `You've used all ${config.maxRuns} test runs for this exercise. You can still submit.`,
      status: 409,
    };

  const result = await runAutomation(
    config,
    workflow,
    config.records.filter((record) => !record.hidden),
  );
  const run: AutomationRun = { at: new Date().toISOString(), workflow, full: false, result };
  await prisma.labAttempt.update({
    where: { id: attempt.id },
    select: { id: true },
    data: {
      runs: [...runs, run].slice(-MAX_STORED_RUNS) as unknown as Prisma.InputJsonValue,
    },
  });
  return { run, runsUsed: tests + 1 };
}

/** Judge + simulate one week (also used by the admin test run). */
export async function simulateSocialRun(
  plan: SocialPlan,
  config: ReturnType<typeof parseSocialConfig>,
  seed: string,
): Promise<SocialRun> {
  const { ratings, feedback, comments } = await judgeWeek(plan, config);
  const result = simulateWeek({ plan, config, ratings, seed });
  return {
    at: new Date().toISOString(),
    plan,
    ratings,
    feedback,
    comments,
    repliedAt: null,
    result,
  };
}

/** Grades replies to a run's comments and re-scores the run (once per run). */
export async function gradeSocialRun(
  run: SocialRun,
  replies: unknown,
  config: ReturnType<typeof parseSocialConfig>,
): Promise<SocialRun> {
  const answers =
    replies && typeof replies === "object" ? (replies as Record<string, unknown>) : {};
  const withReplies = run.comments.map((comment) => ({
    ...comment,
    reply:
      typeof answers[comment.id] === "string"
        ? (answers[comment.id] as string).slice(0, 1000)
        : "",
  }));
  const { comments, community } = await gradeReplies(withReplies, run.plan, config);
  const totals = { ...run.result.totals, community };
  return {
    ...run,
    comments,
    repliedAt: new Date().toISOString(),
    result: { ...run.result, totals, ...scoreWeek(totals, config, run.ratings) },
  };
}

export async function replyToSocialComments(
  userId: string,
  scenarioId: string,
  runIndex: unknown,
  replies: unknown,
): Promise<{ run: SocialRun } | { error: string; status: number }> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario || scenario.kind !== "SOCIAL")
    return { error: "Exercise not found.", status: 404 };
  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
  });
  const runs = storedRuns<SocialRun>(attempt?.runs);
  const index = typeof runIndex === "number" ? runIndex : -1;
  const run = runs[index];
  if (!attempt || !run) return { error: "Run not found.", status: 404 };
  if (run.repliedAt)
    return { error: "You've already replied to this run's comments.", status: 409 };

  const graded = await gradeSocialRun(run, replies, parseSocialConfig(scenario.config));
  runs[index] = graded;
  await prisma.labAttempt.update({
    where: { id: attempt.id },
    select: { id: true },
    data: { runs: runs as unknown as Prisma.InputJsonValue },
  });
  return { run: graded };
}

function parseResults(value: unknown): LabCheckResult[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is LabCheckResult =>
            Boolean(item) &&
            typeof item.label === "string" &&
            typeof item.passed === "boolean",
        )
        .map(({ label, passed, error }) => ({
          label: label.slice(0, 200),
          passed,
          ...(typeof error === "string" ? { error: error.slice(0, 300) } : {}),
        }))
    : [];
}

function fit(text: string) {
  return text.length > MAX_SUBMISSION_LENGTH - 80
    ? `${text.slice(0, MAX_SUBMISSION_LENGTH - 80)}\n…(shortened; full work is in the Practice Lab)`
    : text;
}

/** Task submission text for a code exercise: check summary plus the code. */
function codeSubmissionText(
  scenario: Pick<LabScenario, "title">,
  files: LabFiles,
  results: LabCheckResult[],
) {
  const passed = results.filter((result) => result.passed).length;
  return fit(`Practice Lab: ${scenario.title}
Automatic checks: ${passed} of ${results.length} passed
${results.map((result) => `${result.passed ? "✓" : "✗"} ${result.label}`).join("\n")}
${Object.entries(files)
  .map(([name, contents]) => `\n--- ${name} ---\n${contents}`)
  .join("\n")}`);
}

/** Task submission text for an ad campaign: plan, results and goals. */
function adsSubmissionText(scenario: Pick<LabScenario, "title">, run: AdsRun) {
  const { campaign, result } = run;
  const t = result.totals;
  const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
  return fit(`Ad Campaign Simulator: ${scenario.title}
Score: ${result.score}/100 · Goals met: ${result.goals.filter((g) => g.met).length} of ${result.goals.length}
${result.goals.map((g) => `${g.met ? "✓" : "✗"} ${g.label}: ${formatGoalValue(g.metric, g.actual)} (target ${formatGoalValue(g.metric, g.target)})`).join("\n")}

Results: spend ${naira(t.spend)} of ${naira(t.plannedBudget)} · reach ${t.reach.toLocaleString("en-NG")} · CTR ${t.ctr}% · CPC ${naira(t.cpc)} · conversions ${t.conversions} · cost/conversion ${naira(t.costPerConversion)} · ROAS ${t.roas}×

Campaign: ${campaign.name} · ${OBJECTIVES[campaign.objective].label} · sends people to ${DESTINATIONS[campaign.destination].label} · ${naira(campaign.dailyBudget)}/day × ${campaign.days} days
Audience: ${LOCATIONS.filter((l) => campaign.locations.includes(l.id)).map((l) => l.name).join(", ")} · age ${campaign.ageMin}-${campaign.ageMax} · ${campaign.gender.toLowerCase()} · interests: ${campaign.interests.join(", ") || "broad"}

${campaign.creatives.map((ad) => describeAdForMentor(ad, result)).join("\n\n")}`);
}

/** One ad for the task submission, with links to its images for the mentor. */
function describeAdForMentor(ad: AdsRun["campaign"]["creatives"][number], result: AdsRun["result"]) {
  const link = (ref: string) => (ref ? `${getSiteUrl()}${mediaSrc(ref)}` : "(no image)");
  const stats = result.creatives?.find((c) => c.id === ad.id);
  const lines = [
    `${ad.name} · ${AD_FORMATS[ad.format]}${stats ? ` · ${Math.round(stats.share * 100)}% of budget · CTR ${stats.ctr}% · ${stats.conversions} conversions` : ""}`,
    `Text: ${ad.primaryText}`,
  ];
  if (ad.format === "CAROUSEL")
    ad.cards.forEach((card, i) => lines.push(`Card ${i + 1}: ${card.headline} · image: ${link(card.image)}`));
  else lines.push(`Headline: ${ad.headline}`, `${ad.format === "VIDEO" ? "Cover image" : "Image"}: ${link(ad.image)}`);
  if (ad.visual) lines.push(`Visual: ${ad.visual}`);
  if (ad.format === "VIDEO") lines.push(`Video (${ad.seconds}s) script: ${ad.script}`);
  lines.push(`Button: ${ad.cta}`);
  return lines.join("\n");
}

/** Task submission text for a social week: results, goals, posts, replies. */
function socialSubmissionText(scenario: Pick<LabScenario, "title">, run: SocialRun) {
  const { result, plan } = run;
  const t = result.totals;
  const resultFor = new Map(result.posts.map((p) => [p.postId, p]));
  const n = (v: number) => v.toLocaleString("en-NG");
  return fit(`Social Media Simulator: ${scenario.title}
Score: ${result.score}/100 · Goals met: ${result.goals.filter((g) => g.met).length} of ${result.goals.length}
${result.goals.map((g) => `${g.met ? "✓" : "✗"} ${g.label}: ${g.pending ? "not replied" : formatSocialGoal(g.metric, g.actual)} (target ${formatSocialGoal(g.metric, g.target)})`).join("\n")}

Week: ${t.posts} posts · reach ${n(t.reach)} · engagement rate ${t.engagementRate}% · ${n(t.followers)} new followers · ${n(t.clicks)} clicks · ${n(t.saves + t.shares)} saves+shares${t.community !== null ? ` · reply quality ${t.community}/100` : ""}

${plan.posts
  .map((post) => {
    const r = resultFor.get(post.id);
    return `${DAYS[post.day]} ${post.time} · ${PLATFORMS[post.platform].label} · ${FORMATS[post.format].label} · ${PILLARS[post.pillar].label}${r ? ` → reach ${n(r.reach)}, ${r.engagementRate}% engagement` : ""}
${post.caption}${post.hashtags ? `\n${post.hashtags}` : ""}`;
  })
  .join("\n\n")}

Replies to comments:
${run.comments.map((c) => `${c.author}: ${c.text}\n→ ${c.reply || "(no reply)"}${c.grade ? ` [${c.grade.score}/10]` : ""}`).join("\n\n")}`);
}

/** The workflow as indented plain text, for the task submission. */
function describeWorkflowSteps(steps: Workflow["steps"], indent: string): string {
  return steps
    .map((step) => {
      if (step.type === "IF") {
        const rules = step.rules
          .map((rule) => `${rule.field} ${rule.op.toLowerCase()} ${rule.value}`.trim())
          .join(step.match === "ANY" ? " or " : " and ");
        const branch = (inner: Workflow["steps"]) =>
          describeWorkflowSteps(inner, `${indent}  `) || `${indent}  (nothing)`;
        return `${indent}If ${rules}:\n${branch(step.then)}\n${indent}Otherwise:\n${branch(step.else)}`;
      }
      if (step.type === "AI") {
        const names = step.categories
          .split("\n")
          .map((line) => line.split(":")[0].trim())
          .filter(Boolean);
        return `${indent}AI sorts ${step.input} into ${names.join(" / ")} → {{${step.output}}}`;
      }
      const subject = step.subject ? ` · “${step.subject}”` : "";
      return `${indent}${ACTIONS[step.action].label}: ${step.target}${subject} · “${step.text}”`;
    })
    .join("\n");
}

/** Task submission text for an automation: test results and the workflow. */
function automationSubmissionText(
  scenario: Pick<LabScenario, "title">,
  run: AutomationRun,
) {
  const { result, workflow } = run;
  const outcomes = publicResult(result)
    .outcomes.map((o) => {
      const did = o.hidden ? "" : `: ${o.effects.map(describeEffect).join("; ") || "no actions"}`;
      return `${o.passed ? "✓" : "✗"} ${o.label}${did}`;
    })
    .join("\n");
  return fit(`AI Automation: ${scenario.title}
Score: ${result.score}/100 · Records handled correctly: ${result.passed} of ${result.total}
${outcomes}

Workflow
Trigger: ${workflow.trigger ? TRIGGERS[workflow.trigger].label : "(none)"}
${describeWorkflowSteps(workflow.steps, "")}`);
}

/** Task submission text for a backend API: test results and the code. */
function backendSubmissionText(
  scenario: Pick<LabScenario, "title">,
  files: BackendFiles,
  result: BackendResult,
) {
  const tests = publicBackendResult(result)
    .tests.map((t) => `${t.passed ? "✓" : "✗"} ${t.label}${t.points > 1 ? ` (${t.points} points)` : ""}`)
    .join("\n");
  return fit(`Backend API: ${scenario.title}
Score: ${result.score}/100 · Tests passed: ${result.passed} of ${result.total}
${tests}
${sortedFileNames(files)
  .map((name) => `\n--- ${name} ---\n${files[name]}`)
  .join("\n")}`);
}

/** Task submission text for AI content: the score, marks and the work. */
function contentSubmissionText(scenario: Pick<LabScenario, "title" | "config">, run: ContentRun) {
  const config = parseContentConfig(scenario.config);
  const { result, work } = run;
  const goals = result.goals.map((goal) => `${goal.met ? "✓" : "✗"} ${goal.label}`).join("\n");
  const body =
    config.mode === "FACTCHECK"
      ? `Kept ${Math.round((result.kept ?? 0) * 100)}% of the draft's correct text.\n\n--- Edited draft ---\n${work.edited}`
      : result.pieces
          .map((piece) =>
            [
              `\n--- ${piece.label} (${piece.score}/100) ---`,
              ...(piece.prompt !== undefined ? [`Prompt:\n${piece.prompt}\n\nAI output:`] : []),
              piece.output,
            ].join("\n"),
          )
          .join("\n");
  return fit(`${CONTENT_MODES[config.mode].label}: ${scenario.title}
Score: ${result.score}/100
${goals}
${result.summary}
${body}${work.notes.trim() ? `\n\n--- Notes from the intern ---\n${work.notes}` : ""}`);
}

/** Task submission text for a WordPress site: checks, site summary, files. */
function wordPressSubmissionText(
  scenario: Pick<LabScenario, "title">,
  work: ReturnType<typeof parseWpWork>,
  results: LabCheckResult[],
) {
  const passed = results.filter((result) => result.passed).length;
  return fit(`WordPress: ${scenario.title}
Automatic checks: ${passed} of ${results.length} passed
${results.map((result) => `${result.passed ? "✓" : "✗"} ${result.label}`).join("\n")}

${describeWpWork(work)}`);
}

type LinkedTask = NonNullable<Awaited<ReturnType<typeof linkedTask>>>;

/** What happened to the linked task when the exercise was submitted. */
export type LabTaskResult =
  | {
      taskId: string;
      graded: true;
      passed: boolean;
      /** A pass waiting for a mentor to confirm it (flagged, see below). */
      pending: boolean;
      percent: number;
      passMark: number;
    }
  | { taskId: string; graded: false; reason: string };

/**
 * Grades the linked task from the lab result: the same submission rules as
 * the task page (window open, not already passed or under review), then the
 * submission is stored as passed or failed and progress is updated.
 */
async function gradeLinkedTask(
  userId: string,
  task: LinkedTask,
  content: string,
  result: { percent: number; missed: string[]; missedLabel: string; needsReview?: boolean },
): Promise<LabTaskResult> {
  const prisma = getPrisma();
  if (task.kind !== "INDIVIDUAL")
    return { taskId: task.id, graded: false, reason: "Group tasks can't be graded from the Practice Lab." };
  const existing = await prisma.taskSubmission.findFirst({
    where: { taskId: task.id, userId, groupId: null },
    select: { id: true, status: true },
  });
  const blocked = submissionBlockedReason({
    task,
    existingStatus: existing?.status,
    group: null,
    userId,
  });
  if (blocked) return { taskId: task.id, graded: false, reason: blocked };

  const grade: LabTaskGrade = gradeLabTask({
    percent: result.percent,
    passMark: task.labPassMark,
    maxScore: task.maxScore,
    missed: result.missed,
    missedLabel: result.missedLabel,
    needsReview: result.needsReview,
  });
  const now = new Date();
  const data = {
    content,
    status: grade.status,
    score: grade.score,
    feedback: grade.feedback,
    submittedAt: now,
    reviewedAt: now,
  };
  if (existing)
    await prisma.taskSubmission.update({ where: { id: existing.id }, data });
  else
    await prisma.taskSubmission.create({
      data: { taskId: task.id, userId, ...data },
    });
  await recomputeInternProgress(userId, task.module.programId).catch((error) =>
    console.error("[practice-lab] Progress update failed.", error),
  );
  return {
    taskId: task.id,
    graded: true,
    passed: grade.passed,
    pending: grade.status === "UNDER_REVIEW",
    percent: grade.percent,
    passMark: task.labPassMark,
  };
}

/**
 * Submits the intern's work. Code: the current files with check results
 * from their browser. Simulators: the chosen run (by default their best).
 * A linked task is graded from the result (see gradeLinkedTask).
 */
export async function submitLab(
  userId: string,
  scenarioId: string,
  input: {
    files: unknown;
    checkResults: unknown;
    taskId?: string | null;
    runIndex?: number | null;
  },
): Promise<
  | {
      attempt: ReturnType<typeof attemptView>;
      taskResult: LabTaskResult | null;
      /** Automations: the submitted run (hidden records pass/fail only). */
      run?: AutomationRun;
      /** Backend APIs: the submitted test run (hidden tests pass/fail only). */
      backendRun?: BackendRun;
    }
  | { error: string; status: number }
> {
  const scenario = await scenarioForIntern(userId, scenarioId);
  if (!scenario) return { error: "Exercise not found.", status: 404 };
  const prisma = getPrisma();
  const task = await linkedTask(userId, scenarioId, input.taskId);

  // Backend APIs: every test, hidden ones included, runs in a worker thread
  // here on the server.
  if (scenario.kind === "BACKEND") {
    const config = parseBackendConfig(scenario.config);
    const existing = await prisma.labAttempt.findUnique({
      where: { userId_scenarioId: { userId, scenarioId } },
    });
    const files = parseBackendFiles(
      input.files ?? existing?.files,
      parseBackendFiles(scenario.starterFiles),
    );
    const runs = storedRuns<BackendRun>(existing?.runs);
    const last = runs[runs.length - 1];
    if (last && Date.now() - Date.parse(last.at) < BACKEND_SUBMIT_COOLDOWN_MS)
      return { error: "You've just submitted. Wait a few seconds, then try again.", status: 429 };
    let result: BackendResult;
    try {
      result = await runBackendTestsIsolated(files, config);
    } catch (error) {
      if (error instanceof BusyError)
        return {
          error: "Lots of interns are submitting right now. Try again in a minute.",
          status: 503,
        };
      console.error("[practice-lab] Backend tests failed to run.", error);
      return { error: "Your API couldn't be tested just now. Try again.", status: 500 };
    }
    const run: BackendRun = { at: new Date().toISOString(), result: compactBackendResult(result) };
    const allRuns = [...runs, run].slice(-MAX_BACKEND_RUNS);
    const shown = publicBackendResult(result).tests;
    const submitted = {
      files,
      runs: allRuns as unknown as Prisma.InputJsonValue,
      status: "SUBMITTED" as const,
      checkResults: shown.map((t) => ({ label: t.label, passed: t.passed })),
      checksPassed: result.passed,
      checksTotal: result.total,
      // The AI review is added to this when it's ready.
      review: { submittedRun: allRuns.length - 1, score: result.score },
      submittedAt: new Date(),
    };
    const saved = await prisma.labAttempt.upsert({
      where: { userId_scenarioId: { userId, scenarioId } },
      create: { userId, scenarioId, ...submitted },
      update: submitted,
      select: { id: true, ...VIEW_FIELDS },
    });
    if (isLabReviewEnabled()) after(() => reviewAttempt(saved.id));
    const taskResult = task
      ? await gradeLinkedTask(userId, task, backendSubmissionText(scenario, files, result), {
          percent: result.score,
          missed: shown.filter((t) => !t.passed).map((t) => t.label),
          missedLabel: "tests",
        })
      : null;
    return {
      attempt: attemptView({ ...saved, review: null }),
      taskResult,
      backendRun: { ...run, result: publicBackendResult(run.result) },
    };
  }

  // WordPress: the checks ran inside the intern's site, in their browser.
  if (scenario.kind === "WORDPRESS") {
    const config = parseWpConfig(scenario.config);
    const work = parseWpWork(input.files);
    const results = parseWpResults(input.checkResults);
    const checkLabels = config.checks.map((check) => check.label.slice(0, 200));
    const passed = results.filter((result) => result.passed).length;
    // Results whose labels don't match this exercise's checks may have been
    // edited: a pass goes to a mentor.
    const flags = codeSubmissionFlags({ starter: {}, files: {}, checkLabels, results });
    const submitted = {
      files: work as unknown as Prisma.InputJsonValue,
      status: "SUBMITTED" as const,
      checkResults: results,
      checksPassed: passed,
      checksTotal: checkLabels.length,
      review: flags.length ? { flags } : Prisma.DbNull,
      submittedAt: new Date(),
    };
    const saved = await prisma.labAttempt.upsert({
      where: { userId_scenarioId: { userId, scenarioId } },
      create: { userId, scenarioId, ...submitted },
      update: submitted,
      select: VIEW_FIELDS,
    });
    const text = wordPressSubmissionText(scenario, work, results);
    const taskResult = task
      ? await gradeLinkedTask(
          userId,
          task,
          flags.length ? `Note for the mentor: please confirm this result. ${flags.join(" ")}\n\n${text}` : text,
          {
            ...scoreCodeChecks(checkLabels, results),
            missedLabel: "checks",
            needsReview: flags.length > 0,
          },
        )
      : null;
    return { attempt: attemptView({ ...saved, review: null }), taskResult };
  }

  // Automations: the current workflow is run on every record, hidden ones
  // included, here on the server.
  if (scenario.kind === "AUTOMATION") {
    const config = parseAutomationConfig(scenario.config);
    const existing = await prisma.labAttempt.findUnique({
      where: { userId_scenarioId: { userId, scenarioId } },
    });
    const workflow = parseWorkflow(input.files ?? existing?.files);
    const problems = workflowProblems(workflow, config);
    if (problems.length)
      return { error: problems.slice(0, 4).join(" "), status: 400 };
    const result = await runAutomation(config, workflow);
    const run: AutomationRun = { at: new Date().toISOString(), workflow, full: true, result };
    const runs = [...storedRuns<AutomationRun>(existing?.runs), run].slice(-MAX_STORED_RUNS);
    const shown = publicResult(result).outcomes;
    const submitted = {
      files: workflow,
      runs: runs as unknown as Prisma.InputJsonValue,
      status: "SUBMITTED" as const,
      checkResults: shown.map((o) => ({ label: o.label, passed: o.passed })),
      checksPassed: result.passed,
      checksTotal: result.total,
      review: { submittedRun: runs.length - 1, score: result.score },
      submittedAt: new Date(),
    };
    const saved = await prisma.labAttempt.upsert({
      where: { userId_scenarioId: { userId, scenarioId } },
      create: { userId, scenarioId, ...submitted },
      update: submitted,
      select: { id: true, ...VIEW_FIELDS },
    });
    const taskResult = task
      ? await gradeLinkedTask(userId, task, automationSubmissionText(scenario, run), {
          percent: result.score,
          missed: shown.filter((o) => !o.passed).map((o) => o.label),
          missedLabel: "test records",
        })
      : null;
    return {
      attempt: attemptView(saved),
      taskResult,
      run: { ...run, result: publicResult(result) },
    };
  }

  if (!isCodeKind(scenario.kind)) {
    const attempt = await prisma.labAttempt.findUnique({
      where: { userId_scenarioId: { userId, scenarioId } },
    });
    const runs = storedRuns<AdsRun | SocialRun | ContentRun>(attempt?.runs);
    if (!attempt || !runs.length)
      return {
        error:
          scenario.kind === "SOCIAL"
            ? "Run your week at least once before submitting."
            : scenario.kind === "CONTENT"
              ? "Get your work marked at least once before submitting."
              : "Run your campaign at least once before submitting.",
        status: 400,
      };
    const chosen =
      typeof input.runIndex === "number" && runs[input.runIndex]
        ? runs[input.runIndex]
        : runs.reduce((best, run) => (run.result.score > best.result.score ? run : best));
    const goals: Array<{ label: string; met: boolean }> = chosen.result.goals;
    const saved = await prisma.labAttempt.update({
      where: { id: attempt.id },
      select: VIEW_FIELDS,
      data: {
        status: "SUBMITTED",
        checkResults: goals.map((goal) => ({ label: goal.label, passed: goal.met })),
        checksPassed: goals.filter((goal) => goal.met).length,
        checksTotal: goals.length,
        review: { submittedRun: runs.indexOf(chosen), score: chosen.result.score },
        submittedAt: new Date(),
      },
    });
    // The run and its score were worked out here on the server.
    const taskResult = task
      ? await gradeLinkedTask(
          userId,
          task,
          scenario.kind === "SOCIAL"
            ? socialSubmissionText(scenario, chosen as SocialRun)
            : scenario.kind === "CONTENT"
              ? contentSubmissionText(scenario, chosen as ContentRun)
              : adsSubmissionText(scenario, chosen as AdsRun),
          {
            percent: chosen.result.score,
            missed: goals.filter((goal) => !goal.met).map((goal) => goal.label),
            missedLabel: "goals",
          },
        )
      : null;
    return { attempt: attemptView(saved), taskResult };
  }

  const files = normalizeFiles(scenario.kind, input.files);
  const results = parseResults(input.checkResults);
  const passed = results.filter((result) => result.passed).length;
  // Stored results keep labels to 200 characters.
  const checkLabels = normalizeChecks(scenario.checks).map((check) => check.label.slice(0, 200));
  // The checks ran in the intern's browser: signs a pass may be faked send
  // it to a mentor instead of accepting it (admins see why).
  const flags = codeSubmissionFlags({
    starter: normalizeFiles(scenario.kind, scenario.starterFiles),
    files,
    checkLabels,
    results,
  });
  const flagged = flags.length ? { flags } : Prisma.DbNull;
  const attempt = await prisma.labAttempt.upsert({
    where: { userId_scenarioId: { userId, scenarioId } },
    create: {
      userId,
      scenarioId,
      files,
      status: "SUBMITTED",
      checkResults: results,
      checksPassed: passed,
      checksTotal: results.length,
      review: flagged,
      submittedAt: new Date(),
    },
    update: {
      files,
      status: "SUBMITTED",
      checkResults: results,
      checksPassed: passed,
      checksTotal: results.length,
      // A new submission gets a fresh review.
      review: flagged,
      submittedAt: new Date(),
    },
    select: { id: true, ...VIEW_FIELDS },
  });
  if (isLabReviewEnabled()) after(() => reviewAttempt(attempt.id));

  // Only the exercise's own checks count; a check with no result fails.
  const taskResult = task
    ? await gradeLinkedTask(
        userId,
        task,
        flags.length
          ? `Note for the mentor: please confirm this result. ${flags.join(" ")}\n\n${codeSubmissionText(scenario, files, results)}`
          : codeSubmissionText(scenario, files, results),
        {
          ...scoreCodeChecks(checkLabels, results),
          missedLabel: "checks",
          needsReview: flags.length > 0,
        },
      )
    : null;
  return { attempt: attemptView({ ...attempt, review: null }), taskResult };
}

export async function reviewAttempt(attemptId: string) {
  const prisma = getPrisma();
  const attempt = await prisma.labAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      files: true,
      checkResults: true,
      review: true,
      submittedAt: true,
      userId: true,
      scenarioId: true,
      scenario: {
        select: {
          kind: true,
          title: true,
          brief: true,
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
    },
  });
  if (!attempt || attempt.status !== "SUBMITTED") return;
  const kind = attempt.scenario.kind;
  const backend = kind === "BACKEND";
  if (!isCodeKind(kind) && !backend) return;
  // Backend attempts keep their submitted run and score alongside; code
  // attempts keep any flags.
  const kept =
    attempt.review && typeof attempt.review === "object"
      ? (attempt.review as Record<string, unknown>)
      : {};
  const flags = Array.isArray(kept.flags) ? (kept.flags as string[]) : [];
  const keptFields = {
    ...(typeof kept.submittedRun === "number" ? { submittedRun: kept.submittedRun } : {}),
    ...(typeof kept.score === "number" ? { score: kept.score } : {}),
    ...(flags.length ? { flags } : {}),
  };
  // Only if it's still the same submission: one made while this review was
  // being written gets its own review instead of this older one.
  const sameSubmission = { id: attempt.id, submittedAt: attempt.submittedAt };
  try {
    const review = await reviewLabCode({
      backend,
      track: attempt.scenario.program.name,
      level: attempt.scenario.level.name,
      kindLabel: LAB_KIND_LABEL[kind],
      title: attempt.scenario.title,
      brief: attempt.scenario.brief,
      files: isCodeKind(kind) ? normalizeFiles(kind, attempt.files) : parseBackendFiles(attempt.files),
      checkResults: (attempt.checkResults as LabCheckResult[] | null) ?? [],
    });
    // Code exercises: the reviewer also judges whether the passing checks
    // are believable for this code. If not, the pass goes to a mentor.
    const doubt =
      isCodeKind(kind) && review.checksPlausible === false
        ? `The AI reviewer doubts these check results: ${review.checksConcern || "the code doesn't seem to do what the checks need."}`
        : null;
    const saved = await prisma.labAttempt.updateMany({
      where: sameSubmission,
      data: {
        review: {
          ...keptFields,
          ...review,
          ...(doubt ? { flags: [...flags, doubt] } : {}),
        },
      },
    });
    if (doubt && saved.count) await sendPassToMentor(attempt, doubt);
  } catch (error) {
    console.error(
      `Failed to review lab attempt ${attempt.id}:`,
      error instanceof Error ? error.message : String(error),
    );
    // Tell the intern rather than leave them waiting (and their page polling).
    await prisma.labAttempt
      .updateMany({ where: sameSubmission, data: { review: { ...keptFields, unavailable: true } } })
      .catch(() => {});
  }
}

/**
 * Moves the task this code submission passed back to a mentor (when the
 * review raised a doubt after it was accepted) and updates progress.
 */
async function sendPassToMentor(
  attempt: { userId: string; scenarioId: string; submittedAt: Date | null },
  reason: string,
) {
  if (!attempt.submittedAt) return;
  const prisma = getPrisma();
  const submission = await prisma.taskSubmission.findFirst({
    where: {
      userId: attempt.userId,
      groupId: null,
      status: "ACCEPTED",
      task: { labScenarioId: attempt.scenarioId },
      // Graded by this submission, a moment after it was saved.
      reviewedAt: { gte: attempt.submittedAt },
    },
    select: { id: true, content: true, task: { select: { module: { select: { programId: true } } } } },
  });
  if (!submission) return;
  await prisma.taskSubmission.update({
    where: { id: submission.id },
    select: { id: true },
    data: {
      status: "UNDER_REVIEW",
      feedback: "Your Practice Lab result is waiting for a mentor to confirm it.",
      content: `Note for the mentor: please confirm this result. ${reason}\n\n${submission.content}`.slice(0, MAX_SUBMISSION_LENGTH),
    },
  });
  await recomputeInternProgress(attempt.userId, submission.task.module.programId).catch((error) =>
    console.error("[practice-lab] Progress update failed.", error instanceof Error ? error.message : error),
  );
}

/** The intern's attempt status (polled while waiting for the review). */
export async function getLabAttempt(userId: string, scenarioId: string) {
  const attempt = await getPrisma().labAttempt.findUnique({
    where: { userId_scenarioId: { userId, scenarioId } },
    select: VIEW_FIELDS,
  });
  return attemptView(attempt);
}
