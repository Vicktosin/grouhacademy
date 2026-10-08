import test from "node:test";
import assert from "node:assert/strict";

import {
  blankCreative,
  campaignProblems,
  DEFAULT_ADS_CONFIG as config,
  keepOwnMedia,
  parseCampaign,
  simulateCampaign,
  type Campaign,
  type Ratings,
} from "../lib/ads-sim/model";
import { isMediaRef, mediaOwner, mediaSrc } from "../lib/lab-media-shared";

const owner = "0b3c1f0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const other = "9f8e7d6c-5b4a-4321-8fed-cba987654321";
const image = (user: string) => `lab-media:lab-ads/${user}/1f2e3d4c-5b6a-4789-9abc-def012345678.webp`;

function campaign(ads: number, dailyBudget = 20000): Campaign {
  return parseCampaign({
    name: "Test",
    objective: "SALES",
    dailyBudget,
    days: 7,
    locations: ["lagos"],
    ageMin: 20,
    ageMax: 40,
    destination: "WHATSAPP",
    creatives: Array.from({ length: ads }, (_, i) => ({
      ...blankCreative(i),
      id: `ad${i + 1}`,
      primaryText: "Hot jollof delivered in 45 minutes across Lekki. ₦4,500 combo, order now!",
      headline: "Lunch in 45 minutes",
      image: image(owner),
    })),
  });
}

const ratings = (qualities: number[]): Ratings => ({
  audienceFit: 0.7,
  objectiveFit: 0.8,
  creative: qualities.reduce((a, b) => a + b, 0) / qualities.length,
  source: "rules",
  creatives: qualities.map((quality, i) => ({ id: `ad${i + 1}`, quality })),
});

test("image references must be well-formed and know their owner", () => {
  assert.ok(isMediaRef(image(owner)));
  assert.equal(mediaOwner(image(owner)), owner);
  assert.equal(mediaSrc(image(owner)), `/api/lab-media/lab-ads/${owner}/1f2e3d4c-5b6a-4789-9abc-def012345678.webp`);
  for (const bad of ["https://evil.example/x.png", "lab-media:../etc/passwd", `lab-media:lab-ads/${owner}/x.webp`, ""])
    assert.equal(isMediaRef(bad), false, bad);
});

test("campaigns saved with one ad on the campaign still load", () => {
  const old = parseCampaign({
    name: "Old",
    format: "IMAGE",
    headline: "Old headline",
    primaryText: "Old text",
    cta: "Order now",
    visual: "A plate of rice",
  });
  assert.equal(old.creatives.length, 1);
  assert.equal(old.creatives[0].headline, "Old headline");
  assert.equal(old.creatives[0].cta, "Order now");
  assert.equal(old.destination, "WEBSITE");
});

test("interns can't use other people's images", () => {
  const mixed = campaign(2);
  mixed.creatives[1].image = image(other);
  const kept = keepOwnMedia(mixed, owner);
  assert.equal(kept.creatives[0].image, image(owner));
  assert.equal(kept.creatives[1].image, "");
});

test("each ad needs its copy; carousels need cards; videos need a script", () => {
  const plan = campaign(1);
  plan.creatives[0] = { ...plan.creatives[0], format: "VIDEO", script: "" };
  assert.ok(campaignProblems(plan, config).some((p) => /script/.test(p)));
  plan.creatives[0] = { ...plan.creatives[0], format: "CAROUSEL", cards: [{ image: "", headline: "One" }] };
  assert.ok(campaignProblems(plan, config).some((p) => /at least 2 cards/.test(p)));
  assert.deepEqual(campaignProblems(campaign(2, 10000), config), []);
});

test("the platform favours the stronger ad and reports each ad", () => {
  const result = simulateCampaign({ campaign: campaign(2), config, ratings: ratings([0.9, 0.4]), seed: "s" });
  const [strong, weak] = result.creatives!;
  assert.ok(strong.share > 0.6 && weak.share < 0.4, JSON.stringify(result.creatives));
  assert.ok(strong.ctr > weak.ctr);
  assert.ok(Math.abs(strong.share + weak.share - 1) < 0.01);
  assert.ok(result.notes.some((note) => /gave Ad A/.test(note)));
});

test("too many ads on a small budget is a costly mistake", () => {
  const thin = simulateCampaign({ campaign: campaign(5, 5000), config, ratings: ratings([0.7, 0.7, 0.7, 0.7, 0.7]), seed: "s" });
  const focused = simulateCampaign({ campaign: campaign(2, 5000), config, ratings: ratings([0.7, 0.7]), seed: "s" });
  assert.ok(thin.notes.some((note) => /too little for the platform to learn/.test(note)));
  assert.ok(focused.totals.clicks > thin.totals.clicks);
});

test("better ads get better results", () => {
  const good = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.9]), seed: "s" });
  const poor = simulateCampaign({ campaign: campaign(1), config, ratings: ratings([0.3]), seed: "s" });
  assert.ok(good.totals.clicks > poor.totals.clicks * 1.5);
});

test("equally good ads split the budget, and the note says so", () => {
  const result = simulateCampaign({ campaign: campaign(3), config, ratings: ratings([0.6, 0.6, 0.6]), seed: "s" });
  assert.ok(result.notes.some((note) => /about the same/.test(note)));
  assert.ok(!result.notes.some((note) => /performed best/.test(note)));
});
