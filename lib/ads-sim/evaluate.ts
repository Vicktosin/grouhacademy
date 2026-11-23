import { z } from "zod";
import { generateObject, isAiEnabled, type AiImage } from "@/lib/ai";
import { readLabThumb } from "@/lib/lab-media";
import {
  activePlacements,
  allAds,
  BID_STRATEGIES,
  campaignDays,
  CUSTOM_AUDIENCES,
  DESTINATIONS,
  FORMATS,
  liveCampaign,
  LOCATIONS,
  LOOKALIKES,
  OBJECTIVES,
  objectiveFitFor,
  PERFORMANCE_GOALS,
  PLACEMENTS,
  plannedSpend,
  SPECIAL_CATEGORIES,
  type AdSet,
  type AdSetAudience,
  type AdsConfig,
  type Campaign,
  type Creative,
  type Ratings,
} from "@/lib/ads-sim/model";

// Judges an ad campaign's plan before it's simulated: how well each ad set's
// audience fits the product, each ad's quality (looking at its uploaded
// images), and whether the objective and performance goals suit the goal.
// AI when a key is set (see lib/ai.ts); otherwise simple rules against the
// exercise's ideal audience.

export type AdFeedback = {
  summary: string;
  targeting: string[];
  /** Advice on the ads overall. */
  creative: string[];
  budget: string[];
  /** Advice per ad. */
  ads?: Array<{ id: string; name: string; tips: string[] }>;
  /** Advice per ad set (missing on runs from before ad sets). */
  adSets?: Array<{ id: string; name: string; tips: string[] }>;
};

/** Images shown to the AI per campaign: enough to judge, few enough to stay cheap. */
const MAX_AI_IMAGES = 8;

const objectsOnly = (value: unknown) => (Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : value);
const stringsOnly = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : value);

const JudgementSchema = z.object({
  objectiveFit: z.number().describe("0-10: how well the objective and performance goals serve the business's goal"),
  adSets: z
    .preprocess(
      objectsOnly,
      z.array(
        z.object({
          id: z.string().describe("The ad set's id, exactly as given"),
          audienceFit: z.number().describe("0-10: how well this ad set's audience fits the product's real buyers"),
          tips: z.preprocess(stringsOnly, z.array(z.string())).describe("1-3 specific improvements for this ad set"),
        }),
      ),
    )
    .describe("One entry per ad set, in the order given"),
  ads: z
    .preprocess(
      objectsOnly,
      z.array(
        z.object({
          id: z.string().describe("The ad's id, exactly as given"),
          quality: z.number().describe("0-10: how well this ad would stop the scroll and get the result, image and words together"),
          tips: z.preprocess(stringsOnly, z.array(z.string())).describe("1-3 specific improvements for this ad, mentioning the image if there is one"),
        }),
      ),
    )
    .describe("One entry per ad, in the order given"),
  summary: z.string().describe("Two sentences for the intern"),
  targeting: z.preprocess(stringsOnly, z.array(z.string())).describe("Advice on audiences and placements"),
  creative: z.preprocess(stringsOnly, z.array(z.string())).describe("Advice on the ads as a set: variety, testing, formats for the placements"),
  budget: z.preprocess(stringsOnly, z.array(z.string())).describe("Advice on campaign structure, objective, budget, schedule and bidding"),
});

const SYSTEM_PROMPT = `You are a senior performance marketer coaching digital-marketing interns at SabiRole, a Nigerian internship programme. An intern has built a paid social ad campaign for a business in a training simulator that works like the big platforms' ads managers: a campaign (objective, budget level, bid strategy, special ad category) with ad sets (conversion location, performance goal, audience, placements, budget and schedule), each with ads. Judge the plan as an experienced media buyer would for the Nigerian market.

Rate honestly: an average first attempt is around 5. Reserve 8+ for work a professional would run as-is. Base each ad set's audience fit on who realistically buys this product (location, age, gender, interests); warm audiences (website visitors, page engagers, past customers) and close lookalikes usually fit well but are small. The business's own audience research is provided for reference.

Judge an ad on its image (when one is attached: clear, eye-catching, relevant, readable text, suitable for the placements' shapes) and its words: clarity, a specific benefit or offer, relevance to the audience, local relevance, and a call to action that matches the goal. For a video, judge the cover image and the script (a hook in the first 3 seconds, the product shown, a clear action, a sensible length). For a carousel, judge whether the cards tell a story or show a range. If an ad has no image, rate the visual lower, since real ads need real images. Genuinely different ads are good testing practice.

On structure: too many ad sets on a small budget each stay in the learning phase; overlapping audiences compete; a performance goal should match what the business wants. Write advice directly to the intern ("you"), specific to their choices, short and practical. Don't invent results or numbers; the simulator calculates those.`;

function describeAd(ad: Creative) {
  const lines = [`  [${ad.id}] ${ad.name} · ${FORMATS[ad.format]}`, `  Primary text: ${ad.primaryText}`];
  if (ad.format === "CAROUSEL")
    ad.cards.forEach((card, i) => lines.push(`  Card ${i + 1}: headline "${card.headline}"${card.image ? " (image attached)" : " (no image)"}`));
  else {
    lines.push(`  Headline: ${ad.headline}`);
    lines.push(`  ${ad.format === "VIDEO" ? "Cover image" : "Image"}: ${ad.image ? "attached" : "none uploaded"}`);
  }
  if (ad.description) lines.push(`  Description: ${ad.description}`);
  lines.push(`  Button: ${ad.cta}`);
  if (ad.visual) lines.push(`  What the visual shows (intern's words): ${ad.visual}`);
  if (ad.format === "VIDEO") lines.push(`  Video length: ${ad.seconds} seconds`, `  Script: ${ad.script}`);
  return lines.join("\n");
}

function describeAudience(a: AdSetAudience) {
  const locations = LOCATIONS.filter((l) => a.locations.includes(l.id)).map((l) => l.name).join(", ") || "none";
  const warm = a.custom.map((id) => CUSTOM_AUDIENCES[id].label);
  return [
    `Locations: ${locations}; age ${a.ageMin}-${a.ageMax}${a.ageMax === 65 ? "+" : ""}; ${a.gender.toLowerCase()}`,
    `Interests: ${a.interests.join(", ") || "none"}`,
    warm.length ? `Custom audiences: ${warm.join(", ")}` : null,
    a.lookalike ? `Lookalike of customers: ${LOOKALIKES[a.lookalike]?.label}` : null,
    a.advantage ? "Automatic audience: on (the system may look beyond the targeting)" : null,
    a.excludeCustomers ? "Excludes past customers" : null,
  ]
    .filter(Boolean)
    .join("\n  ");
}

function describeAdSet(set: AdSet, campaign: Campaign) {
  const budget =
    campaign.budgetMode === "CAMPAIGN"
      ? "(uses the campaign budget)"
      : `${set.budget.type === "DAILY" ? "daily" : "lifetime"} ₦${set.budget.amount.toLocaleString("en-NG")}, ${BID_STRATEGIES[set.bidStrategy].label}${set.bidAmount ? ` (${set.bidAmount})` : ""}`;
  return `Ad set [${set.id}] ${set.name}
  Conversion location: ${set.destination ? DESTINATIONS[set.destination].label : "none (awareness)"}; performance goal: ${PERFORMANCE_GOALS[set.performanceGoal].label}
  Budget: ${budget}; runs ${set.days} days
  ${describeAudience(set.audience)}
  Placements: ${set.placementMode === "AUTO" ? "automatic (all)" : activePlacements(set).map((p) => PLACEMENTS[p].label).join(", ")}
  Ads (${set.ads.length}):
${set.ads.map(describeAd).join("\n\n")}`;
}

function describe(campaign: Campaign) {
  return `Campaign: ${campaign.name}
Objective: ${OBJECTIVES[campaign.objective].label}
Special ad category: ${SPECIAL_CATEGORIES[campaign.specialCategory].label}
Budget: ${
    campaign.budgetMode === "CAMPAIGN"
      ? `campaign budget, ${campaign.budget.type === "DAILY" ? "daily" : "lifetime"} ₦${campaign.budget.amount.toLocaleString("en-NG")}, ${BID_STRATEGIES[campaign.bidStrategy].label}${campaign.bidAmount ? ` (${campaign.bidAmount})` : ""}`
      : "set per ad set"
  }; total planned ₦${plannedSpend(campaign).toLocaleString("en-NG")} over up to ${campaignDays(campaign)} days
A/B test: ${campaign.abTest ? "yes (ad sets compared)" : "no"}

${campaign.adSets.map((set) => describeAdSet(set, campaign)).join("\n\n")}`;
}

/** The images to show the AI: each ad's main one first, then more cards. */
async function imagesFor(campaign: Campaign): Promise<AiImage[]> {
  const ads = allAds(campaign);
  const wanted: Array<{ ref: string; label: string }> = [];
  for (const ad of ads) {
    const main = ad.format === "CAROUSEL" ? ad.cards[0]?.image : ad.image;
    if (main)
      wanted.push({
        ref: main,
        label: `${ad.name} [${ad.id}]: ${ad.format === "VIDEO" ? "video cover image" : ad.format === "CAROUSEL" ? "carousel card 1" : "image"}`,
      });
  }
  for (const ad of ads)
    ad.cards.slice(1).forEach((card, i) => {
      if (card.image) wanted.push({ ref: card.image, label: `${ad.name} [${ad.id}]: carousel card ${i + 2}` });
    });
  const loaded = await Promise.all(
    wanted.slice(0, MAX_AI_IMAGES).map(async ({ ref, label }): Promise<AiImage | null> => {
      // Thumbnails: enough for judging, a quarter of the download.
      const image = await readLabThumb(ref).catch(() => null);
      return image ? { label, mediaType: image.contentType, data: Buffer.from(image.bytes).toString("base64") } : null;
    }),
  );
  return loaded.filter((image): image is AiImage => image !== null);
}

async function judgeWithAi(campaign: Campaign, config: AdsConfig) {
  const ideal = config.idealAudience;
  return generateObject({
    task: "ad campaign judging",
    schema: JudgementSchema,
    system: SYSTEM_PROMPT,
    prompt: `Business: ${config.business.name}
${config.business.description}

Product: ${config.product.name} — ₦${config.product.price.toLocaleString("en-NG")}
${config.product.description}
Goal: ${config.conversionEvent === "SALES" ? "sales" : "leads"}${config.hasApp ? "" : " (the business has no app)"}

The business's audience research (for reference): ${LOCATIONS.filter((l) => ideal.locations.includes(l.id)).map((l) => l.name).join(", ") || "anywhere"}; age ${ideal.ageMin}-${ideal.ageMax}; ${ideal.gender.toLowerCase()}; interests: ${ideal.interests.join(", ") || "broad"}.

The intern's plan:
${describe(campaign)}${allAds(campaign).some((ad) => ad.image || ad.cards.some((c) => c.image)) ? "\n\nThe ads' images follow, each labelled with its ad." : ""}`,
    images: await imagesFor(campaign),
    maxTokens: 16000,
    effort: "medium",
  });
}

/** Rules fallback for one ad's quality (0–1) and tips. */
function rateAd(ad: Creative, config: AdsConfig) {
  const tips: string[] = [];
  const words = `${ad.headline} ${ad.primaryText} ${ad.description} ${ad.cards.map((c) => c.headline).join(" ")}`.toLowerCase();
  let quality = 0.15;
  const headlineOk =
    ad.format === "CAROUSEL" ? ad.cards.every((c) => c.headline.length >= 3) : ad.headline.length >= 5 && ad.headline.length <= 45;
  if (headlineOk) quality += 0.1;
  if (ad.primaryText.length >= 40 && ad.primaryText.length <= 350) quality += 0.1;
  else
    tips.push(
      ad.primaryText.length < 40
        ? "Your primary text is very short; say what the product does for the customer."
        : "Shorten the primary text; most people read only the first two lines.",
    );
  if (words.includes(config.product.name.toLowerCase().split(" ")[0])) quality += 0.06;
  if (/₦|\bnaira\b|\d/.test(words)) quality += 0.08;
  else tips.push("Mention the price or a specific offer; numbers make ads concrete.");
  if (/free|off|discount|today|now|limited|order|book|get/.test(words)) quality += 0.07;
  const images = ad.format === "CAROUSEL" ? ad.cards.filter((c) => c.image).length : ad.image ? 1 : 0;
  if (images) quality += ad.format === "CAROUSEL" ? Math.min(0.15, 0.05 * images) : 0.15;
  else {
    if (ad.visual.length >= 20) quality += 0.05;
    tips.push(`Upload ${ad.format === "VIDEO" ? "a cover image" : "an image"}: people stop scrolling for pictures, not descriptions.`);
  }
  if (ad.format === "VIDEO") {
    if (/first|hook|\b0-3|\b3 ?s/.test(ad.script.toLowerCase()) || ad.script.length >= 120) quality += 0.06;
    else tips.push("Plan what happens in the first 3 seconds; that's when people decide to keep watching.");
    if (ad.seconds > 30) tips.push("Keep feed and story videos under 30 seconds.");
  }
  const salesCta = ["Shop now", "Order now", "Get offer", "Book now", "Send WhatsApp message"];
  const leadCta = ["Sign up", "Apply now", "Send message", "Send WhatsApp message", "Contact us", "Get quote", "Call now"];
  if ((config.conversionEvent === "SALES" ? salesCta : leadCta).includes(ad.cta)) quality += 0.08;
  else tips.push("Choose a button that matches what you want people to do.");
  return { quality: Math.max(0, Math.min(1, quality)), tips: tips.slice(0, 3) };
}

/** Rules fallback for one ad set's audience fit (0–1) and tips. */
function rateAudience(set: AdSet, config: AdsConfig) {
  const ideal = config.idealAudience;
  const a = set.audience;
  const tips: string[] = [];
  const overlap = (chosen: string[], wanted: string[]) =>
    !wanted.length
      ? 0.6
      : !chosen.length
        ? 0.4
        : (chosen.filter((x) => wanted.includes(x)).length / chosen.length) * 0.5 +
          (wanted.filter((x) => chosen.includes(x)).length / wanted.length) * 0.5;
  const ageOverlap =
    Math.max(0, Math.min(a.ageMax, ideal.ageMax) - Math.max(a.ageMin, ideal.ageMin)) /
    Math.max(1, Math.max(a.ageMax, ideal.ageMax) - Math.min(a.ageMin, ideal.ageMin));
  const genderFit = ideal.gender === "ALL" || a.gender === ideal.gender ? 1 : a.gender === "ALL" ? 0.6 : 0;
  const locationFit = overlap(a.locations, ideal.locations);
  let fit = 0.3 * locationFit + 0.3 * ageOverlap + 0.15 * genderFit + 0.25 * overlap(a.interests, ideal.interests);
  // Warm audiences and close lookalikes are people already near the business.
  for (const id of a.custom) fit = Math.max(fit, CUSTOM_AUDIENCES[id].fit * (0.5 + 0.5 * locationFit));
  if (a.lookalike) fit = Math.max(fit, (LOOKALIKES[a.lookalike]?.fit ?? 0.6) * (0.5 + 0.5 * locationFit));
  if (a.advantage) fit = Math.max(fit, 0.55);
  if (locationFit < 0.6) tips.push("Think about where this business can actually deliver or sell, and target those places.");
  if (ageOverlap < 0.6 && !a.custom.length) tips.push("Narrow the age range to the people most likely to buy.");
  if (!a.interests.length && !a.custom.length && !a.lookalike && !a.advantage)
    tips.push("Broad targeting can work, but interests, a lookalike or warm audiences help a new campaign find buyers.");
  return { fit: Math.max(0, Math.min(1, fit)), tips: tips.slice(0, 3) };
}

/** Rules fallback: overlap with the ideal audience and copy basics. */
function judgeWithRules(campaign: Campaign, config: AdsConfig) {
  const sets = campaign.adSets.map((set) => ({ set, ...rateAudience(set, config) }));
  const ads = allAds(campaign).map((ad) => ({ ad, ...rateAd(ad, config) }));
  const creative: string[] = [];
  const budget: string[] = [];
  const targeting: string[] = [];
  if (campaign.adSets.every((set) => set.ads.length === 1))
    creative.push("Try 2–3 genuinely different ads (a different image or angle) so the system can find the one that works.");
  if (objectiveFitFor(campaign.objective, config.conversionEvent) < 1)
    budget.push(`Your goal is ${config.conversionEvent === "SALES" ? "sales" : "leads"}, so choose that objective so the system optimizes for it.`);
  if (campaign.adSets.some((set) => set.days < 4))
    budget.push("Very short ad sets spend much of their time in the learning phase; run them for at least 4–7 days.");
  if (campaign.adSets.length > 2 && plannedSpend(campaign) / campaign.adSets.length < 25000)
    budget.push("Several ad sets on a small budget each struggle to exit learning; fewer, better-funded ad sets usually do better.");
  if (campaign.adSets.some((set) => set.placementMode === "MANUAL" && set.placements.length === 1))
    targeting.push("A single placement limits delivery; automatic placements usually find cheaper results.");
  const objectiveFit =
    (objectiveFitFor(campaign.objective, config.conversionEvent) +
      Math.min(...campaign.adSets.map((set) => (set.performanceGoal === "CONVERSIONS" || set.performanceGoal === "LEADS" || set.performanceGoal === "CONVERSATIONS" ? 1 : 0.6)))) /
    2;

  return {
    ratings: {
      audienceFit: sets.reduce((sum, s) => sum + s.fit, 0) / sets.length,
      creative: ads.reduce((sum, a) => sum + a.quality, 0) / ads.length,
      objectiveFit,
      source: "rules" as const,
      creatives: ads.map((a) => ({ id: a.ad.id, quality: a.quality })),
      adSets: sets.map((s) => ({ id: s.set.id, audienceFit: s.fit })),
    },
    feedback: {
      summary: "Here's rule-based feedback on your plan. (Detailed AI coaching, which also looks at your images, isn't available right now.)",
      targeting,
      creative,
      budget,
      ads: ads.map((a) => ({ id: a.ad.id, name: a.ad.name, tips: a.tips })),
      adSets: sets.map((s) => ({ id: s.set.id, name: s.set.name, tips: s.tips })),
    },
  };
}

export async function judgeCampaign(campaign: Campaign, config: AdsConfig): Promise<{ ratings: Ratings; feedback: AdFeedback }> {
  // Only what's switched on is published and judged.
  campaign = liveCampaign(campaign);
  if (isAiEnabled()) {
    try {
      const judgement = await judgeWithAi(campaign, config);
      const scale = (value: number) => Math.max(0, Math.min(10, value)) / 10;
      const adsById = new Map(judgement.ads.map((ad) => [ad.id, ad]));
      const setsById = new Map(judgement.adSets.map((set) => [set.id, set]));
      // Anything the AI skipped gets the average of the others.
      const average = (values: number[], fallback: number) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : fallback);
      const adAverage = average(judgement.ads.map((ad) => scale(ad.quality)), 0.5);
      const setAverage = average(judgement.adSets.map((set) => scale(set.audienceFit)), 0.5);
      const ads = allAds(campaign);
      const creatives = ads.map((ad) => ({ id: ad.id, quality: adsById.has(ad.id) ? scale(adsById.get(ad.id)!.quality) : adAverage }));
      const adSets = campaign.adSets.map((set) => ({
        id: set.id,
        audienceFit: setsById.has(set.id) ? scale(setsById.get(set.id)!.audienceFit) : setAverage,
      }));
      return {
        ratings: {
          audienceFit: average(adSets.map((s) => s.audienceFit), setAverage),
          creative: average(creatives.map((c) => c.quality), adAverage),
          objectiveFit: scale(judgement.objectiveFit),
          source: "ai",
          creatives,
          adSets,
        },
        feedback: {
          summary: judgement.summary,
          targeting: judgement.targeting,
          creative: judgement.creative,
          budget: judgement.budget,
          ads: ads.map((ad) => ({ id: ad.id, name: ad.name, tips: adsById.get(ad.id)?.tips ?? [] })),
          adSets: campaign.adSets.map((set) => ({ id: set.id, name: set.name, tips: setsById.get(set.id)?.tips ?? [] })),
        },
      };
    } catch (error) {
      console.error("AI campaign judging failed; using rules.", error instanceof Error ? error.message : String(error));
    }
  }
  return judgeWithRules(campaign, config);
}
