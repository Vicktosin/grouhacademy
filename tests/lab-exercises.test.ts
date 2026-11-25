import assert from "node:assert/strict";
import test from "node:test";
import { LAB_EXERCISES } from "../data/lab-exercises";
import { allSteps, expectedFrom, parseAutomationConfig, scoreWorkflow, workflowProblems, type AiLabels } from "../lib/automation-sim/model";
import { runTests } from "../lib/backend-sim/engine";
import { configProblems, parseBackendConfig, parseBackendFiles } from "../lib/backend-sim/model";
import { loadNodeModules } from "../lib/backend-sim/node-modules";
import { blankAdSet, blankCreative, campaignProblems, parseAdsConfig, parseCampaign, simulateCampaign, type Ratings } from "../lib/ads-sim/model";
import { checkRule, contentConfigProblems, factCheckScore, matchErrors, parseContentConfig, scorePiece } from "../lib/content-sim/model";
import { CURRICULUM } from "../lib/curriculum";
import { labRows } from "../lib/lab-exercises";
import { parseSocialConfig, planProblems, scoreWeek, simulateWeek, type PlanRatings, type SocialPlan } from "../lib/social-sim/model";
import { parseWpConfig, wpConfigProblems } from "../lib/wp-sim/model";

// Every exercise: a good answer passes and a lazy one doesn't. Web pages are
// checked in a real browser by scripts/check-web-labs.mjs.

const of = (kind: string) => LAB_EXERCISES.filter((item) => item.kind === kind);
const name = (item: { track: string; level: string; week: number }) => `${item.track} ${item.level} W${item.week}`;
const PASS = 70;

test("every Beginner and Novice week has one exercise, in this file or already live", () => {
  const seen = new Set(LAB_EXERCISES.map(name));
  assert.equal(seen.size, LAB_EXERCISES.length, "no duplicates");
  const isNew = (track: string) => track === "Virtual Assistant" || track === "Cybersecurity";
  const missing = CURRICULUM.flatMap(({ track }) =>
    ["Beginner", "Novice"].flatMap((level) =>
      [1, 2, 3, 4]
        // Beginner weeks 1 and 2 of the older tracks are already live.
        .filter((week) => !(level === "Beginner" && week < 3 && !isNew(track)))
        .map((week) => name({ track, level, week })),
    ),
  ).filter((item) => !seen.has(item));
  assert.deepEqual(missing, []);
  assert.equal(LAB_EXERCISES.length, 58);
});

test("every brief says what to do and what it adds to", () => {
  for (const item of LAB_EXERCISES) {
    assert.match(item.brief, /Do this:/, name(item));
    assert.match(item.brief, /What this adds to: /, name(item));
    if (item.week === 4) assert.match(item.brief, /your (finished|milestone)|the finished/, name(item));
  }
});

test("the rows the import saves keep the whole exercise", () => {
  for (const item of LAB_EXERCISES) {
    const row = labRows(item);
    assert.match(row.title, new RegExp(`^Week ${item.week}: `));
    assert.equal(row.published, true);
  }
});

test("content: the model answer passes, an empty or lazy one doesn't", () => {
  for (const item of of("CONTENT")) {
    const config = parseContentConfig(item.config);
    assert.deepEqual(contentConfigProblems(config), [], name(item));
    if (config.mode === "FACTCHECK") {
      const good = matchErrors(config, item.model!.edited);
      assert.ok(factCheckScore(good.caught, good.kept, null) >= 90, `${name(item)} ${JSON.stringify(good)}`);
      const lazy = matchErrors(config, config.draft);
      assert.equal(factCheckScore(lazy.caught, lazy.kept, null), 0, name(item));
      continue;
    }
    assert.equal(config.pieces.length, (item.config!.pieces as unknown[]).length, `${name(item)}: too many pieces`);
    const lazy = config.pieces.map((piece) => scorePiece(piece.rules.map((rule) => checkRule(rule, "good good good good")), [], false));
    assert.ok(lazy.reduce((a, b) => a + b, 0) / lazy.length < PASS, `${name(item)}: lazy passes`);
    for (const piece of config.pieces) {
      if (config.mode !== "BRIEF") continue;
      const answer = item.model?.[piece.id] ?? "";
      const failed = piece.rules.map((rule) => checkRule(rule, answer)).filter((result) => !result.passed);
      assert.deepEqual(failed.map((result) => `${result.label} (${result.detail})`), [], `${name(item)} ${piece.id}`);
    }
  }
});

test("automations: the model workflow handles every record, and a blank one doesn't", () => {
  for (const item of of("AUTOMATION")) {
    const row = labRows(item);
    const config = parseAutomationConfig(row.config);
    assert.deepEqual(workflowProblems(config.solution, config), [], name(item));
    assert.ok(config.expected, name(item));
    const labels: AiLabels = Object.fromEntries(
      allSteps(config.solution.steps).filter((step) => step.type === "AI").map((step) => [step.id, item.labels ?? {}]),
    );
    assert.deepEqual(expectedFrom(config.solution, config, labels), config.expected, name(item));
    const good = scoreWorkflow(config.solution, config, config.expected!, labels);
    assert.equal(good.score, 100, `${name(item)} ${JSON.stringify(good.outcomes.filter((o) => !o.passed), null, 1)}`);
    const first = { trigger: config.trigger, steps: config.solution.steps.slice(0, 1) };
    assert.ok(scoreWorkflow(first, config, config.expected!, labels).score < PASS, `${name(item)}: the first step alone passes`);
  }
});

test("APIs: the model answer passes every test and the starter fails", async () => {
  const modules = await loadNodeModules();
  for (const item of of("BACKEND")) {
    const config = parseBackendConfig(item.config);
    assert.deepEqual(configProblems(config), [], name(item));
    const solved = runTests(modules, parseBackendFiles(item.solutionFiles), config, config.tests);
    assert.equal(solved.score, 100, `${name(item)} ${JSON.stringify(solved.tests.filter((t) => !t.passed), null, 1).slice(0, 1500)}`);
    assert.ok(runTests(modules, parseBackendFiles(item.starterFiles), config, config.tests).score < PASS, `${name(item)}: the starter passes`);
  }
});

test("WordPress: every check is complete", () => {
  for (const item of of("WORDPRESS")) {
    const config = parseWpConfig(item.config);
    assert.deepEqual(wpConfigProblems(config), [], name(item));
    assert.equal(config.checks.length, (item.config!.checks as unknown[]).length, name(item));
  }
});

test("ads: a well-aimed campaign can pass, and a careless one can't", () => {
  for (const item of of("ADS")) {
    const config = parseAdsConfig(item.config);
    const run = (quality: number, fit: number, aimed: boolean, spend: number, seed: string) => {
      const sets = aimed ? 2 : 1;
      const days = 7;
      const campaign = parseCampaign({
        name: "Test",
        objective: aimed ? "LEADS" : "AWARENESS",
        adSets: Array.from({ length: sets }, (_, s) => ({
          ...blankAdSet(s, aimed ? "LEADS" : "AWARENESS"),
          id: `set${s + 1}`,
          name: `Set ${s + 1}`,
          budget: { type: "DAILY", amount: Math.floor(spend / sets / days) },
          days,
          ...(aimed ? { placementMode: "MANUAL", placements: ["SEARCH", "FEEDS"] } : {}),
          audience: aimed
            ? { ...config.idealAudience, interests: [config.idealAudience.interests[s]] }
            : { locations: ["lagos"], ageMin: 18, ageMax: 65, gender: "ALL", interests: [] },
          ads: [0, 1].map((a) => ({ ...blankCreative(a), id: `s${s + 1}ad${a + 1}`, primaryText: "Tired of fuel? Book a free solar visit in Kaduna today.", headline: "Home solar in two days", visual: "A family under bright lights at night" })),
        })),
      });
      assert.deepEqual(campaignProblems(campaign, config), [], name(item));
      const ratings: Ratings = {
        audienceFit: fit, objectiveFit: aimed ? 0.95 : 0.3, creative: quality, source: "rules",
        creatives: campaign.adSets.flatMap((set) => set.ads.map((ad) => ({ id: ad.id, quality }))),
        adSets: campaign.adSets.map((set) => ({ id: set.id, audienceFit: fit })),
      };
      return simulateCampaign({ campaign, config, ratings, seed });
    };
    const goals = (result: ReturnType<typeof run>) => result.goals.filter((goal) => goal.met).length;
    const seeds = ["a", "b", "c", "d", "e"];
    const good = seeds.map((seed) => run(0.8, 0.85, true, config.maxTotalBudget * 0.98, seed));
    assert.ok(good.filter((result) => goals(result) === config.goals.length).length >= 4, `${name(item)} good: ${JSON.stringify(good.map((r) => r.goals.map((g) => [g.metric, g.actual])))}`);
    const poor = seeds.map((seed) => run(0.3, 0.3, false, config.maxTotalBudget * 0.3, seed));
    assert.ok(poor.every((result) => goals(result) === 0), `${name(item)} poor: ${JSON.stringify(poor.map((r) => r.goals.map((g) => [g.metric, g.actual])))}`);
  }
});

test("social: a thoughtful week can pass, and a careless one can't", () => {
  for (const item of of("SOCIAL")) {
    const config = parseSocialConfig(item.config);
    const run = (good: boolean, seed: string) => {
      const count = good ? Math.round((config.minPosts + config.maxPosts) / 2) : config.minPosts;
      const plan: SocialPlan = {
        posts: Array.from({ length: count }, (_, i) => ({
          id: `p${i}`, day: good ? i % 7 : 0, time: good ? (i % 2 ? "19:30" : "12:30") : "03:00",
          platform: good ? config.platforms[i % 2] : config.platforms[0],
          format: good ? (i % 2 ? "VIDEO" : "CAROUSEL") : "IMAGE",
          pillar: good ? (["EDUCATE", "ENTERTAIN", "COMMUNITY", "PROMOTE", "BEHIND_SCENES"] as const)[i % 5] : "PROMOTE",
          caption: good ? "A useful, warm caption that asks people what they think." : "Buy now now now",
          hashtags: good ? "#abuja #food #style" : "", visual: "A clear, bright picture of the product", cta: good ? (i % 3 === 0 ? "DM" : "SAVE") : "NONE",
        })),
      };
      assert.deepEqual(planProblems(plan, config), [], name(item));
      const q = good ? 0.8 : 0.25;
      const ratings: PlanRatings = { mix: q, consistency: q, voice: q, source: "rules", posts: plan.posts.map((post) => ({ postId: post.id, hook: q, caption: q, relevance: q, tip: "" })) };
      const result = simulateWeek({ plan, config, ratings, seed, community: good ? 80 : 20 });
      return { score: scoreWeek(result.totals, config, ratings).score, goals: scoreWeek(result.totals, config, ratings).goals };
    };
    const seeds = ["a", "b", "c", "d", "e"];
    const good = seeds.map((seed) => run(true, seed));
    const poor = seeds.map((seed) => run(false, seed));
    const show = (runs: typeof good) => JSON.stringify(runs.map((r) => [r.score, ...r.goals.map((g) => `${g.metric} ${Math.round(g.actual * 10) / 10}/${g.target}`)]));
    assert.ok(good.filter((r) => r.score >= PASS + 5).length >= 4, `${name(item)} good: ${show(good)}`);
    assert.ok(poor.every((r) => r.score < PASS), `${name(item)} poor: ${show(poor)}`);
  }
});
