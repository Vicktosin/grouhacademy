import { LabKind, Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { normalizeChecks, normalizeFiles } from "@/lib/lab-shared";
import { parseAdsConfig } from "@/lib/ads-sim/model";
import { parseSocialConfig } from "@/lib/social-sim/model";
import {
  expectedFrom,
  parseAutomationConfig,
  workflowProblems,
} from "@/lib/automation-sim/model";
import { aiLabelsFor } from "@/lib/automation-sim/evaluate";
import {
  configProblems,
  parseBackendConfig,
  parseBackendFiles,
} from "@/lib/backend-sim/model";
import { parseWpConfig, wpConfigProblems } from "@/lib/wp-sim/model";
import { contentConfigProblems, parseContentConfig } from "@/lib/content-sim/model";

/** Validates an admin exercise create/update body. */
export async function parseScenarioInput(body: unknown) {
  if (!body || typeof body !== "object")
    return { error: "Exercise details are required." } as const;
  const raw = body as Record<string, unknown>;
  const kind = raw.kind;
  if (
    kind !== LabKind.WEB &&
    kind !== LabKind.REACT &&
    kind !== LabKind.ADS &&
    kind !== LabKind.SOCIAL &&
    kind !== LabKind.AUTOMATION &&
    kind !== LabKind.BACKEND &&
    kind !== LabKind.WORDPRESS &&
    kind !== LabKind.CONTENT
  )
    return { error: "Choose the kind of exercise." } as const;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const brief = typeof raw.brief === "string" ? raw.brief.trim() : "";
  const programId = typeof raw.programId === "string" ? raw.programId : "";
  const levelId = typeof raw.levelId === "string" ? raw.levelId : "";
  if (!title || !brief)
    return { error: "Give the exercise a title and a brief." } as const;

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
    return { error: "Choose a valid track and level." } as const;

  const common = {
    programId,
    levelId,
    kind,
    title,
    brief,
    published: raw.published === true,
  };

  // Automations: the model workflow's results on every record are worked
  // out now (AI steps included) and kept, so every intern is checked
  // against the same answers.
  if (kind === LabKind.AUTOMATION) {
    const config = parseAutomationConfig(raw.config);
    if (!config.fields.length)
      return { error: "Add at least one data field." } as const;
    if (config.records.filter((record) => !record.hidden).length < 2)
      return { error: "Add at least 2 sample records interns can see." } as const;
    const problems = workflowProblems(config.solution, config);
    if (problems.length)
      return {
        error: `Fix the model workflow first: ${problems.slice(0, 3).join(" ")}`,
      } as const;
    if (config.solution.trigger !== config.trigger)
      return {
        error: "The model workflow must start with the exercise's trigger.",
      } as const;
    const labels = await aiLabelsFor(config.solution, config.records);
    return {
      data: {
        ...common,
        starterFiles: {},
        solutionFiles: Prisma.DbNull,
        checks: [],
        config: {
          ...config,
          expected: expectedFrom(config.solution, config, labels),
        },
      },
    } as const;
  }

  // Backend APIs: the database and tests live in config; the starter and
  // model answer are files like a code exercise's.
  if (kind === LabKind.BACKEND) {
    const config = parseBackendConfig(raw.config);
    const problems = configProblems(config);
    if (problems.length)
      return { error: `Fix the tests first: ${problems.slice(0, 3).join(" ")}` } as const;
    const starterFiles = parseBackendFiles(raw.starterFiles);
    return {
      data: {
        ...common,
        starterFiles,
        solutionFiles: raw.solutionFiles
          ? parseBackendFiles(raw.solutionFiles, starterFiles)
          : Prisma.DbNull,
        checks: [],
        config,
      },
    } as const;
  }

  // AI content: the brief, rules, criteria (or the draft and its planted
  // errors) all live in config.
  if (kind === LabKind.CONTENT) {
    const config = parseContentConfig(raw.config);
    const problems = contentConfigProblems(config);
    if (problems.length)
      return { error: `Fix the exercise first: ${problems.slice(0, 3).join(" ")}` } as const;
    return {
      data: { ...common, starterFiles: {}, solutionFiles: Prisma.DbNull, checks: [], config },
    } as const;
  }

  // WordPress: versions, starter site and checks all live in config; the
  // intern's site itself stays in their browser.
  if (kind === LabKind.WORDPRESS) {
    const config = parseWpConfig(raw.config);
    const problems = wpConfigProblems(config);
    if (problems.length)
      return { error: `Fix the exercise first: ${problems.slice(0, 3).join(" ")}` } as const;
    return {
      data: {
        ...common,
        starterFiles: {},
        solutionFiles: Prisma.DbNull,
        checks: [],
        config,
      },
    } as const;
  }

  // Simulator exercises: settings live in config; no files or checks.
  if (kind === LabKind.ADS || kind === LabKind.SOCIAL) {
    const config =
      kind === LabKind.SOCIAL
        ? parseSocialConfig(raw.config)
        : parseAdsConfig(raw.config);
    if (!config.goals.length)
      return { error: "Add at least one goal." } as const;
    return {
      data: {
        ...common,
        starterFiles: {},
        solutionFiles: Prisma.DbNull,
        checks: [],
        config,
      },
    } as const;
  }

  const checks = normalizeChecks(raw.checks);
  if (checks.length > 30) return { error: "Use at most 30 checks." } as const;
  const starterFiles = normalizeFiles(kind, raw.starterFiles);
  const size = JSON.stringify([starterFiles, raw.solutionFiles ?? null]).length;
  if (size > 200_000)
    return {
      error: "The starter and model answer files are too large.",
    } as const;

  return {
    data: {
      ...common,
      starterFiles,
      solutionFiles: raw.solutionFiles
        ? normalizeFiles(kind, raw.solutionFiles, starterFiles)
        : Prisma.DbNull,
      checks,
      config: Prisma.DbNull,
    },
  } as const;
}
