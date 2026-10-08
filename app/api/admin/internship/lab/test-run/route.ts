import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import {
  campaignProblems,
  parseAdsConfig,
  parseCampaign,
  simulateCampaign,
} from "@/lib/ads-sim/model";
import { judgeCampaign } from "@/lib/ads-sim/evaluate";
import { parsePlan, parseSocialConfig, planProblems } from "@/lib/social-sim/model";
import {
  gradeSocialRun,
  runAutomation,
  simulateSocialRun,
  type SocialRun,
} from "@/lib/practice-lab";
import {
  expectedFrom,
  parseAutomationConfig,
  parseWorkflow,
  workflowProblems,
} from "@/lib/automation-sim/model";
import { aiLabelsFor } from "@/lib/automation-sim/evaluate";

export const maxDuration = 60;

/**
 * Tries a simulator exercise with its settings as currently edited, without
 * saving anything. Body:
 *   ads:    { config, campaign }
 *   social: { kind: "SOCIAL", config, plan }
 *           { kind: "SOCIAL", config, run, replies }  (grade replies)
 *   automation: { kind: "AUTOMATION", config }
 *                 (what the model workflow does for every record)
 *               { kind: "AUTOMATION", config, workflow }
 *                 (an intern-style run on every record, hidden included)
 */
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    config?: unknown;
    campaign?: unknown;
    plan?: unknown;
    run?: unknown;
    replies?: unknown;
    workflow?: unknown;
  } | null;

  if (body?.kind === "AUTOMATION") {
    // Answers are worked out fresh from the settings as edited.
    const config = { ...parseAutomationConfig(body.config), expected: null };
    const solutionProblems = workflowProblems(config.solution, config);
    if (solutionProblems.length)
      return NextResponse.json(
        { error: `Model workflow: ${solutionProblems.slice(0, 3).join(" ")}` },
        { status: 400 },
      );
    const labels = await aiLabelsFor(config.solution, config.records);
    const expected = expectedFrom(config.solution, config, labels);
    if (!body.workflow)
      return NextResponse.json({
        expected,
        labels,
        trigger: config.trigger,
      });
    const workflow = parseWorkflow(body.workflow);
    const problems = workflowProblems(workflow, config);
    if (problems.length)
      return NextResponse.json(
        { error: problems.slice(0, 4).join(" ") },
        { status: 400 },
      );
    return NextResponse.json({
      run: {
        at: new Date().toISOString(),
        workflow,
        full: true,
        result: await runAutomation({ ...config, expected }, workflow),
      },
    });
  }

  if (body?.kind === "SOCIAL") {
    const config = parseSocialConfig(body.config);
    if (body.run) {
      const run = body.run as SocialRun;
      if (!Array.isArray(run.comments) || !run.result || !run.ratings)
        return NextResponse.json({ error: "Run not found." }, { status: 400 });
      return NextResponse.json({
        run: await gradeSocialRun(run, body.replies, config),
      });
    }
    const plan = parsePlan(body.plan);
    const problems = planProblems(plan, config);
    if (problems.length)
      return NextResponse.json(
        { error: problems.slice(0, 5).join(" ") },
        { status: 400 },
      );
    return NextResponse.json({
      run: await simulateSocialRun(plan, config, `admin-test:${Date.now()}`),
    });
  }

  const config = parseAdsConfig(body?.config);
  const campaign = parseCampaign(body?.campaign);
  const problems = campaignProblems(campaign, config);
  if (problems.length)
    return NextResponse.json({ error: problems.join(" ") }, { status: 400 });
  const { ratings, feedback } = await judgeCampaign(campaign, config);
  const result = simulateCampaign({
    campaign,
    config,
    ratings,
    seed: `admin-test:${Date.now()}`,
  });
  return NextResponse.json({
    run: { at: new Date().toISOString(), campaign, result, feedback },
  });
}
