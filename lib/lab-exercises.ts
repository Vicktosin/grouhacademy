import type { LabExercise } from "@/data/lab-exercises";
import type { Prisma } from "@/generated/prisma/client";
import { parseAdsConfig } from "@/lib/ads-sim/model";
import { allSteps, expectedFrom, parseAutomationConfig, type AiLabels } from "@/lib/automation-sim/model";
import { parseBackendConfig, parseBackendFiles } from "@/lib/backend-sim/model";
import { parseContentConfig } from "@/lib/content-sim/model";
import { parseSocialConfig } from "@/lib/social-sim/model";
import { parseWpConfig } from "@/lib/wp-sim/model";

/** Each kind's settings, checked the way the admin form checks them. */
function configFor(item: LabExercise) {
  switch (item.kind) {
    case "ADS":
      return parseAdsConfig(item.config);
    case "SOCIAL":
      return parseSocialConfig(item.config);
    case "BACKEND":
      return parseBackendConfig(item.config);
    case "WORDPRESS":
      return parseWpConfig(item.config);
    case "CONTENT":
      return parseContentConfig(item.config);
    case "AUTOMATION": {
      const config = parseAutomationConfig(item.config);
      // What each record should do, worked out from the model workflow with
      // the AI step's known answers.
      const labels: AiLabels = Object.fromEntries(
        allSteps(config.solution.steps)
          .filter((step) => step.type === "AI")
          .map((step) => [step.id, item.labels ?? {}]),
      );
      return { ...config, expected: expectedFrom(config.solution, config, labels) };
    }
    default:
      return undefined;
  }
}

/** A LabScenario's columns, all but its track and level. */
export function labRows(item: LabExercise) {
  const config = configFor(item);
  const backend = item.kind === "BACKEND";
  return {
    kind: item.kind,
    title: `Week ${item.week}: ${item.title}`,
    brief: item.brief,
    starterFiles: (backend ? parseBackendFiles(item.starterFiles) : (item.starterFiles ?? {})) as Prisma.InputJsonValue,
    ...(item.solutionFiles && { solutionFiles: (backend ? parseBackendFiles(item.solutionFiles) : item.solutionFiles) as Prisma.InputJsonValue }),
    checks: (item.checks ?? []) as Prisma.InputJsonValue,
    ...(config && { config: config as unknown as Prisma.InputJsonValue }),
    published: true,
  };
}
