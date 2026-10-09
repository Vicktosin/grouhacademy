import test from "node:test";
import assert from "node:assert/strict";

import {
  adSetAudienceSize,
  allAds,
  audienceOverlap,
  blankAdSet,
  blankCreative,
  campaignProblems,
  DEFAULT_ADS_CONFIG as config,
  goalsFor,
  keepOwnMedia,
  normalizeRunResult,
  OBJECTIVE_DESTINATIONS,
  parseCampaign,
  plannedSpend,
  simulateCampaign,
  type AdSet,
  type Campaign,
  type Objective,
  type Ratings,
  type RunResult,
} from "../lib/ads-sim/model";
import { isMediaRef, mediaOwner, mediaSrc } from "../lib/lab-media-shared";

const owner = "0b3c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const other = "9f8e7d6c-5b4a-4321-8fed-cba987654321";
const image = (user: string) => `lab-media:lab-ads/${user}/1f2e3d4c-5b6a-4789-9abc-def012345678.webp`;

const goodAd = (i: number, set = 1) => ({
  ...blankCreative(i),
  id: `s${set}ad${i + 1}`,
  primaryText: "Hot jollof delivered in 45 minutes across Lekki. ₦4,500 combo, order now!",
  headline: "Lunch in 45 minutes",
  image: image(owner),
});

function adSet(i: number, ads: number, daily: number, audience: Partial<AdSet["audience"]> = {}): unknown {
  return {
    ...blankAdSet(i, "SALES"),
    id: `set${i + 1}`,
    name: `Ad set ${i + 1}`,
    destination: "WHATSAPP",
    performanceGoal: "CONVERSIONS",
    budget: { type: "DAILY", amount: daily },
    days: 7,
    audience: { locations: ["lagos"], ageMin: 20, ageMax: 40, gender: "ALL", interests: [], ...audience },
    ads: Array.from({ length: ads }, (_, a) => goodAd(a, i + 1)),
  };
}

function campaign(ads: number, daily = 20000, extra: Partial<Campaign> = {}): Campaign {
  return parseCampaign({ name: "Test", objective: "SALES", adSets: [adSet(0, ads, daily)], ...extra });
}

const ratings = (qualities: number[], fit = 0.7, adSetFits?: Record<string, number>): Ratings => ({
  audienceFit: fit,
  objectiveFit: 0.8,
  creative: qualities.reduce((a, b) => a + b, 0) / qualities.length,
  source: "rules",
  creatives: qualities.map((quality, i) => ({ id: `s1ad${i + 1}`, quality })),
  adSets: adSetFits ? Object.entries(adSetFits).map(([id, audienceFit]) => ({ id, audienceFit })) : undefined,
});

test("image references must be well-formed and know their owner", () => {
  assert.ok(isMediaRef(image(owner)));
  assert.equal(mediaOwner(image(owner)), owner);
  assert.equal(mediaSrc(image(owner)), `/api/lab-media/lab-ads/${owner}/1f2e3d4c-5b6a-4789-9abc-def012345678.webp`);
  for (const bad of ["https://evil.example/x.png", "lab-media:../etc/passwd", `lab-media:lab-ads/${owner}/x.webp`, ""])
    assert.equal(isMediaRef(bad), false, bad);
});

test("older campaigns (no ad sets, or one ad on the campaign) still load", () => {
  const v1 = parseCampaign({
    name: "Old",
    objective: "SALES",
    dailyBudget: 4000,
    days: 5,
    locations: ["lagos"],
    placements: ["FEED", "STORIES"],
    bidding: "COST_CAP",
    bidAmount: 2000,
    destination: "WHATSAPP",
    creatives: [goodAd(0), goodAd(1)],
  });
  assert.equal(v1.adSets.length, 1);
  const set = v1.adSets[0];
  assert.deepEqual(set.budget, { type: "DAILY", amount: 4000 });
  assert.equal(set.days, 5);
  assert.deepEqual(set.placements, ["FEEDS", "STORIES"]);
  assert.equal(set.placementMode, "MANUAL");
  assert.equal(set.bidStrategy, "COST_PER_RESULT");
  assert.equal(set.destination, "WHATSAPP");
  assert.equal(set.ads.length, 2);

  const oldest = parseCampaign({ name: "Oldest", headline: "Old headline", primaryText: "Old text", cta: "Order now" });
  assert.equal(allAds(oldest)[0].headline, "Old headline");
  assert.equal(allAds(oldest)[0].cta, "Order now");
});

test("every objective has a valid conversion location and performance goal", () => {
  for (const objective of Object.keys(OBJECTIVE_DESTINATIONS) as Objective[]) {
    const destinations = OBJECTIVE_DESTINATIONS[objective];
    for (const destination of destinations.length ? destinations : [null])
      assert.ok(goalsFor(objective, destination).length > 0, `${objective} / ${destination}`);
  }
  // A goal that doesn't fit is replaced by one that does.
  const c = parseCampaign({ objective: "TRAFFIC", adSets: [{ ...(adSet(0, 1, 5000) as object), destination: "WHATSAPP", performanceGoal: "LANDING_PAGE_VIEWS" }] });
  assert.equal(c.adSets[0].performanceGoal, "LINK_CLICKS");
});

test("interns can't use other people's images", () => {
  const mixed = campaign(2);
  mixed.adSets[0].ads[1].image = image(other);
  const kept = keepOwnMedia(mixed, owner);
  assert.equal(kept.adSets[0].ads[0].image, image(owner));
  assert.equal(kept.adSets[0].ads[1].image, "");
});

test("validation: copy, budgets, special categories, A/B tests", () => {
  const plan = campaign(1);
  plan.adSets[0].ads[0] = { ...plan.adSets[0].ads[0], format: "VIDEO", script: "" };
  assert.ok(campaignProblems(plan, config).some((p) => /script/.test(p)));
  assert.deepEqual(campaignProblems(campaign(2, 10000), config), []);
  assert.ok(campaignProblems(campaign(1, 500), config).some((p) => /at least ₦1,000 a day/.test(p)));
  assert.ok(campaignProblems(campaign(1, 50000), config).some((p) => /over this exercise's limit/.test(p)));

  const special = campaign(1, 10000, { specialCategory: "HOUSING" });
  const problems = campaignProblems(special, config);
  assert.ok(problems.some((p) => /ages 18–65/.test(p)));

  const cbo = parseCampaign({ objective: "SALES", budgetMode: "CAMPAIGN", budget: { type: "DAILY", amount: 1500 }, adSets: [adSet(0, 1, 0), adSet(1, 1, 0)] });
  assert.ok(campaignProblems(cbo, config).some((p) => /each ad set/.test(p)));
  // An A/B test needs 2+ ad sets: with one it's switched off.
  assert.equal(parseCampaign({ objective: "SALES", abTest: true, adSets: [adSet(0, 1, 5000)] }).abTest, false);
});

test("the system favours the stronger ad and reports each ad", () => {
  const result = simulateCampaign({ campaign: campaign(2), config, ratings: ratings([0.9, 0.4]), seed: "s" });
  const [strong, weak] = result.creatives!;
  assert.ok(strong.share > 0.6 && weak.share < 0.4, JSON.stringify(result.creatives));
  assert.ok(strong.ctr > weak.ctr);
  assert.ok(result.notes.some((note) => /got \d+% of the budget/.test(note)));
});

test("too many ads on a small budget is a costly mistake", () => {
  const thin = simulateCampaign({ campaign: campaign(5, 5000), config, ratings: ratings([0.7, 0.7, 0.7, 0.7, 0.7]), seed: "s" });
  const focused = simulateCampaign({ campaign: campaign(2, 5000), config, ratings: ratings([0.7, 0.7]), seed: "s" });
  assert.ok(thin.notes.some((note) => /too little for the system to learn/.test(note)));
  assert.ok(focused.totals.clicks > thin.totals.clicks);
});

test("better ads and better audiences get better results", () => {
  const good = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.9]), seed: "s" });
  const poor = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.3]), seed: "s" });
  assert.ok(good.totals.clicks > poor.totals.clicks * 1.5);
  const fits = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.7], 0.9), seed: "s" });
  const misses = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.7], 0.2), seed: "s" });
  assert.ok(fits.totals.conversions > misses.totals.conversions * 1.5);
});

test("results add up across levels and breakdowns", () => {
  const c = parseCampaign({ objective: "SALES", adSets: [adSet(0, 2, 10000), adSet(1, 1, 8000, { locations: ["fct"] })] });
  const r = simulateCampaign({ campaign: c, config, ratings: ratings([0.7, 0.6]), seed: "x" });
  const sets = r.adSets!;
  assert.equal(sets.length, 2);
  const near = (a: number, b: number, tolerance = 0.02) => Math.abs(a - b) <= Math.max(2, b * tolerance);
  assert.ok(near(sets.reduce((s, x) => s + x.spend, 0), r.totals.spend));
  assert.ok(near(sets.reduce((s, x) => s + x.clicks, 0), r.totals.clicks));
  for (const set of sets) {
    assert.ok(near(set.ads.reduce((s, a) => s + a.spend, 0), set.spend));
    for (const key of ["age", "gender", "placement", "day"] as const)
      assert.ok(near(set.breakdowns[key].reduce((s, row) => s + row.impressions, 0), set.impressions), `${set.name} ${key}`);
  }
  assert.equal(r.breakdowns!.day.length, 7);
  assert.ok(r.totals.spend <= plannedSpend(c));
  assert.equal(r.totals.resultLabel, "Purchases");
});

test("overlapping ad sets compete; separate audiences don't", () => {
  const same = parseCampaign({ objective: "SALES", adSets: [adSet(0, 1, 10000), adSet(1, 1, 10000)] });
  const apart = parseCampaign({ objective: "SALES", adSets: [adSet(0, 1, 10000), adSet(1, 1, 10000, { locations: ["kano"] })] });
  assert.ok(audienceOverlap(same.adSets[0].audience, same.adSets[1].audience) > 0.8);
  assert.equal(audienceOverlap(apart.adSets[0].audience, apart.adSets[1].audience), 0);
  const r = simulateCampaign({ campaign: same, config, ratings: ratings([0.7]), seed: "o" });
  assert.ok(r.notes.some((note) => /bid against each other/.test(note)));
  // An A/B test splits the audience, so no overlap penalty.
  const ab = simulateCampaign({ campaign: { ...same, abTest: true }, config, ratings: ratings([0.7]), seed: "o" });
  assert.ok(!ab.notes.some((note) => /bid against each other/.test(note)));
  assert.ok(ab.abTest);
});

test("a campaign budget moves money to the stronger ad set", () => {
  const c = parseCampaign({
    objective: "SALES",
    budgetMode: "CAMPAIGN",
    budget: { type: "DAILY", amount: 12000 },
    adSets: [adSet(0, 1, 0), adSet(1, 1, 0, { locations: ["kano"] })],
  });
  const r = simulateCampaign({ campaign: c, config, ratings: ratings([0.7], 0.5, { set1: 0.9, set2: 0.3 }), seed: "c" });
  const [strong, weak] = r.adSets!;
  assert.ok(strong.plannedBudget > weak.plannedBudget * 2, `${strong.plannedBudget} vs ${weak.plannedBudget}`);
  assert.ok(r.notes.some((note) => /campaign budget/.test(note)));
});

test("small budgets on conversion goals stay learning limited", () => {
  const r = simulateCampaign({ campaign: campaign(1, 1500), config, ratings: ratings([0.6]), seed: "l" });
  assert.equal(r.adSets![0].delivery, "LEARNING_LIMITED");
  assert.ok(r.notes.some((note) => /learning limited/.test(note)));
});

test("special ad categories must be declared, or the ads are rejected", () => {
  const housing = { ...config, specialCategory: "HOUSING" as const };
  const r = simulateCampaign({ campaign: campaign(1), config: housing, ratings: ratings([0.8]), seed: "h" });
  assert.equal(r.delivery, "REJECTED");
  assert.equal(r.totals.spend, 0);
  assert.equal(r.score, 0);
  const declared = campaign(1, 10000, { specialCategory: "HOUSING" });
  declared.adSets[0].audience = { ...declared.adSets[0].audience, ageMin: 18, ageMax: 65 };
  const ok = simulateCampaign({ campaign: declared, config: housing, ratings: ratings([0.8]), seed: "h" });
  assert.notEqual(ok.delivery, "REJECTED");
  assert.ok(ok.totals.spend > 0);
});

test("warm audiences are small but convert better", () => {
  const cold = adSetAudienceSize({ locations: ["lagos"], ageMin: 18, ageMax: 65, gender: "ALL", interests: [], advantage: false, custom: [], lookalike: 0, excludeCustomers: false });
  const warm = adSetAudienceSize({ locations: ["lagos"], ageMin: 18, ageMax: 65, gender: "ALL", interests: [], advantage: false, custom: ["WEBSITE_VISITORS"], lookalike: 0, excludeCustomers: false });
  assert.ok(warm < cold / 100);
  const coldRun = simulateCampaign({ campaign: campaign(1, 3000), config, ratings: ratings([0.7]), seed: "w" });
  const warmCampaign = campaign(1, 3000);
  warmCampaign.adSets[0].audience.custom = ["WEBSITE_VISITORS"];
  const warmRun = simulateCampaign({ campaign: warmCampaign, config, ratings: ratings([0.7]), seed: "w" });
  const rate = (r: RunResult) => r.totals.conversions / Math.max(1, r.totals.clicks);
  assert.ok(rate(warmRun) > rate(coldRun) * 1.5);
});

test("switched-off ad sets and ads aren't published", () => {
  const c = parseCampaign({ objective: "SALES", adSets: [adSet(0, 2, 10000), { ...(adSet(1, 1, 10000, { locations: ["kano"] }) as object), paused: true }] });
  c.adSets[0].ads[1].paused = true;
  // A paused ad set's problems don't block publishing.
  c.adSets[1].ads[0].primaryText = "";
  assert.deepEqual(campaignProblems(c, config), []);
  const r = simulateCampaign({ campaign: c, config, ratings: ratings([0.7, 0.7]), seed: "p" });
  assert.deepEqual(r.adSets!.map((s) => s.id), ["set1"]);
  assert.deepEqual(r.creatives!.map((a) => a.id), ["s1ad1"]);
  assert.ok(r.totals.spend <= 70000);
  // Everything off: nothing to publish.
  c.adSets[0].paused = true;
  assert.deepEqual(campaignProblems(c, config), ["Switch on at least one ad set."]);
  // An ad set with every ad off needs one on.
  const d = parseCampaign({ objective: "SALES", adSets: [adSet(0, 1, 10000)] });
  d.adSets[0].ads[0].paused = true;
  assert.ok(campaignProblems(d, config).some((p) => /switch on at least one ad/.test(p)));
  // Survives saving and loading.
  assert.equal(parseCampaign(JSON.parse(JSON.stringify(c))).adSets[1].paused, true);
});

test("runs from before ad sets are shown in the new shape", () => {
  const c = campaign(1);
  const old = {
    totals: { plannedBudget: 1000, spend: 900, audienceSize: 5, impressions: 100, reach: 50, frequency: 2, clicks: 10, ctr: 10, cpc: 90, cpm: 9000, conversions: 1, costPerConversion: 900, revenue: 4500, roas: 5 },
    daily: [{ day: 1, spend: 900, impressions: 100, clicks: 10, conversions: 1 }],
    ratings: ratings([0.5]),
    goals: [],
    score: 50,
    notes: [],
  } as RunResult;
  const normalized = normalizeRunResult(old, c);
  assert.equal(normalized.adSets!.length, 1);
  assert.equal(normalized.adSets![0].spend, 900);
  assert.equal(normalized.breakdowns!.day.length, 1);
});
