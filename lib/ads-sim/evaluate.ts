import { z } from "zod";
import { generateObject, isAiEnabled, type AiImage } from "@/lib/ai";
import { readLabImage } from "@/lib/lab-media";
import {
  BIDDING,
  DESTINATIONS,
  FORMATS,
  LOCATIONS,
  OBJECTIVES,
  PLACEMENTS,
  objectiveFitFor,
  type AdsConfig,
  type Campaign,
  type Creative,
  type Ratings,
} from "@/lib/ads-sim/model";

// Judges an ad campaign's plan before it's simulated: how well the audience
// fits the product, each ad's quality (looking at its uploaded images), and
// whether the objective suits the goal. AI when a key is set (Claude, or
// free Gemini, OpenRouter or Groq; see lib/ai.ts); otherwise simple rules
// against the exercise's ideal audience.

export type AdFeedback = {
  summary: string;
  targeting: string[];
  /** Advice on the ads overall. */
  creative: string[];
  budget: string[];
  /** Advice per ad (missing on runs from before multiple ads). */
  ads?: Array<{ id: string; name: string; tips: string[] }>;
};

/** Images shown to the AI per campaign: enough to judge, few enough to stay cheap. */
const MAX_AI_IMAGES = 8;

const JudgementSchema = z.object({
  audienceFit: z.number().int().describe("0-10: how well the targeting fits the product's real buyers"),
  objectiveFit: z.number().int().describe("0-10: how well the chosen objective and destination serve the goal"),
  ads: z
    .array(
      z.object({
        id: z.string().describe("The ad's id, exactly as given"),
        quality: z
          .number()
          .int()
          .describe("0-10: how well this ad would stop the scroll and get the result, image and words together"),
        tips: z.array(z.string()).describe("1-3 specific improvements for this ad, mentioning the image if there is one"),
      }),
    )
    .describe("One entry per ad, in the order given"),
  summary: z.string().describe("Two sentences for the intern"),
  targeting: z.array(z.string()).describe("Specific advice on the audience and placements"),
  creative: z.array(z.string()).describe("Advice on the ads as a set: variety, testing, formats for the placements"),
  budget: z.array(z.string()).describe("Advice on objective, destination, budget, duration and bidding"),
});

const SYSTEM_PROMPT = `You are a senior performance marketer coaching digital-marketing interns at Grouh Academy, a Nigerian internship programme. An intern has planned a paid social ad campaign for a business in a training simulator. Judge the plan as an experienced media buyer would for the Nigerian market.

Rate honestly: an average first attempt is around 5. Reserve 8+ for work a professional would run as-is. Base audience fit on who realistically buys this product (location, age, gender, interests) — the business's own audience research is provided for reference.

The campaign can have several ads; rate each one. Judge an ad on its image (when one is attached: is it clear, eye-catching, well lit, uncluttered, relevant to the product, readable text if any, suitable for the placements' shapes) and its words: clarity, a specific benefit or offer, relevance to the audience, local relevance, and a call to action that matches the goal. For a video, judge the cover image and the script: does it hook in the first 3 seconds, show the product, and end with a clear action; is the length right for the placements. For a carousel, judge whether the cards tell a story or show a range. If an ad has no image, judge from the description but rate the visual lower, since real ads need real images. Several genuinely different ads (different angles, not small wording changes) are good testing practice.

Write advice directly to the intern ("you"), specific to their choices, short and practical. Don't invent results or numbers; the simulator calculates those.`;

function describeAd(ad: Creative) {
  const lines = [`[${ad.id}] ${ad.name} · ${FORMATS[ad.format]}`];
  lines.push(`Primary text: ${ad.primaryText}`);
  if (ad.format === "CAROUSEL")
    ad.cards.forEach((card, i) =>
      lines.push(`Card ${i + 1}: headline "${card.headline}"${card.image ? " (image attached)" : " (no image)"}`),
    );
  else {
    lines.push(`Headline: ${ad.headline}`);
    lines.push(ad.image ? `${ad.format === "VIDEO" ? "Cover image" : "Image"}: attached` : `${ad.format === "VIDEO" ? "Cover image" : "Image"}: none uploaded`);
  }
  if (ad.description) lines.push(`Description: ${ad.description}`);
  lines.push(`Button: ${ad.cta}`);
  if (ad.visual) lines.push(`What the visual shows (intern's words): ${ad.visual}`);
  if (ad.format === "VIDEO") lines.push(`Video length: ${ad.seconds} seconds`, `Script: ${ad.script}`);
  return lines.join("\n");
}

function describe(campaign: Campaign) {
  const locations = LOCATIONS.filter((l) => campaign.locations.includes(l.id))
    .map((l) => l.name)
    .join(", ");
  return `Campaign: ${campaign.name}
Objective: ${OBJECTIVES[campaign.objective].label}
Sends people to: ${DESTINATIONS[campaign.destination].label}
Budget: ₦${campaign.dailyBudget.toLocaleString("en-NG")} per day for ${campaign.days} days
Bidding: ${BIDDING[campaign.bidding].label}${campaign.bidAmount ? ` (₦${campaign.bidAmount.toLocaleString("en-NG")})` : ""}
Locations: ${locations || "none"}
Age: ${campaign.ageMin}-${campaign.ageMax}; Gender: ${campaign.gender.toLowerCase()}
Interests: ${campaign.interests.join(", ") || "none (broad)"}
Placements: ${campaign.placements.map((p) => PLACEMENTS[p].label).join(", ")}

Ads (${campaign.creatives.length}):
${campaign.creatives.map(describeAd).join("\n\n")}`;
}

/** The images to show the AI: each ad's main one first, then more cards. */
async function imagesFor(campaign: Campaign): Promise<AiImage[]> {
  const wanted: Array<{ ref: string; label: string }> = [];
  for (const ad of campaign.creatives) {
    const main = ad.format === "CAROUSEL" ? ad.cards[0]?.image : ad.image;
    if (main)
      wanted.push({
        ref: main,
        label: `${ad.name} [${ad.id}]: ${ad.format === "VIDEO" ? "video cover image" : ad.format === "CAROUSEL" ? "carousel card 1" : "image"}`,
      });
  }
  for (const ad of campaign.creatives)
    ad.cards.slice(1).forEach((card, i) => {
      if (card.image) wanted.push({ ref: card.image, label: `${ad.name} [${ad.id}]: carousel card ${i + 2}` });
    });
  const loaded = await Promise.all(
    wanted.slice(0, MAX_AI_IMAGES).map(async ({ ref, label }): Promise<AiImage | null> => {
      const image = await readLabImage(ref).catch(() => null);
      return image
        ? { label, mediaType: image.contentType, data: Buffer.from(image.bytes).toString("base64") }
        : null;
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
Goal: ${config.conversionEvent === "SALES" ? "sales" : "leads"}

The business's audience research (for reference): ${LOCATIONS.filter((l) => ideal.locations.includes(l.id)).map((l) => l.name).join(", ") || "anywhere"}; age ${ideal.ageMin}-${ideal.ageMax}; ${ideal.gender.toLowerCase()}; interests: ${ideal.interests.join(", ") || "broad"}.

The intern's plan:
${describe(campaign)}${campaign.creatives.some((ad) => ad.image || ad.cards.some((c) => c.image)) ? "\n\nThe ads' images follow, each labelled with its ad." : ""}`,
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
  const headlineOk = ad.format === "CAROUSEL" ? ad.cards.every((c) => c.headline.length >= 3) : ad.headline.length >= 5 && ad.headline.length <= 45;
  if (headlineOk) quality += 0.1;
  if (ad.primaryText.length >= 40 && ad.primaryText.length <= 350) quality += 0.1;
  else tips.push(ad.primaryText.length < 40 ? "Your primary text is very short; say what the product does for the customer." : "Shorten the primary text; most people read only the first two lines.");
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
  const salesCta = ["Shop now", "Order now", "Get offer", "Book now"];
  if (config.conversionEvent === "SALES" ? salesCta.includes(ad.cta) : ["Sign up", "Apply now", "Send message", "Contact us"].includes(ad.cta))
    quality += 0.08;
  else tips.push("Choose a button that matches what you want people to do.");
  return { quality: Math.max(0, Math.min(1, quality)), tips: tips.slice(0, 3) };
}

/** Rules fallback: overlap with the ideal audience and copy basics. */
function judgeWithRules(campaign: Campaign, config: AdsConfig) {
  const ideal = config.idealAudience;
  const overlap = (chosen: string[], wanted: string[]) =>
    !wanted.length
      ? 0.6
      : !chosen.length
        ? 0.4
        : (chosen.filter((x) => wanted.includes(x)).length / chosen.length) * 0.5 +
          (wanted.filter((x) => chosen.includes(x)).length / wanted.length) * 0.5;
  const ageOverlap =
    Math.max(0, Math.min(campaign.ageMax, ideal.ageMax) - Math.max(campaign.ageMin, ideal.ageMin)) /
    Math.max(1, Math.max(campaign.ageMax, ideal.ageMax) - Math.min(campaign.ageMin, ideal.ageMin));
  const genderFit =
    ideal.gender === "ALL" || campaign.gender === ideal.gender
      ? 1
      : campaign.gender === "ALL"
        ? 0.6
        : 0;
  const audienceFit =
    0.3 * overlap(campaign.locations, ideal.locations) +
    0.3 * ageOverlap +
    0.15 * genderFit +
    0.25 * overlap(campaign.interests, ideal.interests);

  const ads = campaign.creatives.map((ad) => ({ ad, ...rateAd(ad, config) }));
  const targeting: string[] = [];
  const creative: string[] = [];
  const budget: string[] = [];
  if (overlap(campaign.locations, ideal.locations) < 0.6)
    targeting.push("Think about where this business can actually deliver or sell, and target those places.");
  if (ageOverlap < 0.6) targeting.push("Narrow the age range to the people most likely to buy.");
  if (!campaign.interests.length)
    targeting.push("Broad targeting can work, but adding relevant interests helps a new account find buyers.");
  if (campaign.creatives.length === 1)
    creative.push("Try 2–3 genuinely different ads (a different image or angle) so the platform can find the one that works.");
  if (objectiveFitFor(campaign.objective, config.conversionEvent) < 1)
    budget.push(`Your goal is ${config.conversionEvent === "SALES" ? "sales" : "leads"}, so choose that objective so the platform optimizes for it.`);
  if (campaign.days < 4) budget.push("Very short campaigns spend much of their time in the learning phase; run for at least 4–7 days.");

  return {
    ratings: {
      audienceFit: Math.max(0, Math.min(1, audienceFit)),
      creative: ads.reduce((sum, a) => sum + a.quality, 0) / ads.length,
      objectiveFit: objectiveFitFor(campaign.objective, config.conversionEvent),
      source: "rules" as const,
      creatives: ads.map((a) => ({ id: a.ad.id, quality: a.quality })),
    },
    feedback: {
      summary:
        "Here's rule-based feedback on your plan. (Detailed AI coaching, which also looks at your images, isn't available right now.)",
      targeting,
      creative,
      budget,
      ads: ads.map((a) => ({ id: a.ad.id, name: a.ad.name, tips: a.tips })),
    },
  };
}

export async function judgeCampaign(
  campaign: Campaign,
  config: AdsConfig,
): Promise<{ ratings: Ratings; feedback: AdFeedback }> {
  if (isAiEnabled()) {
    try {
      const judgement = await judgeWithAi(campaign, config);
      const scale = (value: number) => Math.max(0, Math.min(10, value)) / 10;
      const byId = new Map(judgement.ads.map((ad) => [ad.id, ad]));
      // An ad the AI skipped gets the average of the others.
      const rated = judgement.ads.map((ad) => scale(ad.quality));
      const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0.5;
      const creatives = campaign.creatives.map((ad) => ({
        id: ad.id,
        quality: byId.has(ad.id) ? scale(byId.get(ad.id)!.quality) : average,
      }));
      return {
        ratings: {
          audienceFit: scale(judgement.audienceFit),
          creative: creatives.reduce((sum, c) => sum + c.quality, 0) / creatives.length,
          objectiveFit: scale(judgement.objectiveFit),
          source: "ai",
          creatives,
        },
        feedback: {
          summary: judgement.summary,
          targeting: judgement.targeting,
          creative: judgement.creative,
          budget: judgement.budget,
          ads: campaign.creatives.map((ad) => ({
            id: ad.id,
            name: ad.name,
            tips: byId.get(ad.id)?.tips ?? [],
          })),
        },
      };
    } catch (error) {
      console.error(
        "AI campaign judging failed; using rules.",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  return judgeWithRules(campaign, config);
}
