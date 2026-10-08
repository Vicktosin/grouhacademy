import { z } from "zod";
import { generateObject, isAiEnabled } from "@/lib/ai";
import {
  BIDDING,
  FORMATS,
  LOCATIONS,
  OBJECTIVES,
  PLACEMENTS,
  objectiveFitFor,
  type AdsConfig,
  type Campaign,
  type Ratings,
} from "@/lib/ads-sim/model";

// Judges an ad campaign's plan before it's simulated: how well the audience
// fits the product, the quality of the ad, and whether the objective suits
// the goal. AI when a key is set (Claude, or free Gemini, OpenRouter or
// Groq; see lib/ai.ts); otherwise simple rules against the exercise's ideal
// audience.

export type AdFeedback = {
  summary: string;
  targeting: string[];
  creative: string[];
  budget: string[];
};

const JudgementSchema = z.object({
  audienceFit: z.number().int().describe("0-10: how well the targeting fits the product's real buyers"),
  creativeQuality: z.number().int().describe("0-10: how compelling and clear the ad is for this audience"),
  objectiveFit: z.number().int().describe("0-10: how well the chosen objective serves the goal"),
  summary: z.string().describe("Two sentences for the intern"),
  targeting: z.array(z.string()).describe("Specific advice on the audience and placements"),
  creative: z.array(z.string()).describe("Specific advice on the headline, text, visual and call to action"),
  budget: z.array(z.string()).describe("Advice on objective, budget, duration and bidding"),
});

const SYSTEM_PROMPT = `You are a senior performance marketer coaching digital-marketing interns at Grouh Academy, a Nigerian internship programme. An intern has planned a paid social ad campaign for a business in a training simulator. Judge the plan as an experienced media buyer would for the Nigerian market.

Rate honestly: an average first attempt is around 5. Reserve 8+ for plans a professional would run as-is. Base audience fit on who realistically buys this product (location, age, gender, interests) — the business's own audience research is provided for reference. Judge the ad on clarity, a specific benefit or offer, relevance to the audience, local relevance, and a call to action that matches the goal.

Write advice directly to the intern ("you"), specific to their choices, short and practical. Don't invent results or numbers; the simulator calculates those.`;

function describe(campaign: Campaign) {
  const locations = LOCATIONS.filter((l) => campaign.locations.includes(l.id))
    .map((l) => l.name)
    .join(", ");
  return `Campaign: ${campaign.name}
Objective: ${OBJECTIVES[campaign.objective].label}
Budget: ₦${campaign.dailyBudget.toLocaleString("en-NG")} per day for ${campaign.days} days
Bidding: ${BIDDING[campaign.bidding].label}${campaign.bidAmount ? ` (₦${campaign.bidAmount.toLocaleString("en-NG")})` : ""}
Locations: ${locations || "none"}
Age: ${campaign.ageMin}-${campaign.ageMax}; Gender: ${campaign.gender.toLowerCase()}
Interests: ${campaign.interests.join(", ") || "none (broad)"}
Placements: ${campaign.placements.map((p) => PLACEMENTS[p].label).join(", ")}
Ad format: ${FORMATS[campaign.format]}
Headline: ${campaign.headline}
Primary text: ${campaign.primaryText}
Description: ${campaign.description || "(none)"}
Call-to-action button: ${campaign.cta}
Image/video: ${campaign.visual || "(not described)"}`;
}

async function judgeWithAi(campaign: Campaign, config: AdsConfig) {
  const ideal = config.idealAudience;
  const output = await generateObject({
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
${describe(campaign)}`,
    maxTokens: 16000,
    effort: "medium",
  });
  return output;
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

  const copy = `${campaign.headline} ${campaign.primaryText} ${campaign.description}`.toLowerCase();
  let creative = 0.2;
  if (campaign.headline.length >= 5 && campaign.headline.length <= 45) creative += 0.12;
  if (campaign.primaryText.length >= 40 && campaign.primaryText.length <= 350) creative += 0.12;
  if (copy.includes(config.product.name.toLowerCase().split(" ")[0])) creative += 0.08;
  if (/₦|\bnaira\b|\d/.test(copy)) creative += 0.1;
  if (/free|off|discount|today|now|limited|order|book|get/.test(copy)) creative += 0.1;
  if (campaign.visual.length >= 20) creative += 0.1;
  const salesCta = ["Shop now", "Order now", "Get offer", "Book now"];
  if (config.conversionEvent === "SALES" ? salesCta.includes(campaign.cta) : ["Sign up", "Apply now", "Send message", "Contact us"].includes(campaign.cta))
    creative += 0.08;

  const targeting: string[] = [];
  const creativeTips: string[] = [];
  const budget: string[] = [];
  if (overlap(campaign.locations, ideal.locations) < 0.6)
    targeting.push("Think about where this business can actually deliver or sell, and target those places.");
  if (ageOverlap < 0.6) targeting.push("Narrow the age range to the people most likely to buy.");
  if (!campaign.interests.length)
    targeting.push("Broad targeting can work, but adding relevant interests helps a new account find buyers.");
  if (!/₦|\d/.test(copy)) creativeTips.push("Mention the price or a specific offer; numbers make ads concrete.");
  if (campaign.visual.length < 20) creativeTips.push("Describe the image or video: what the viewer sees matters as much as the words.");
  if (campaign.primaryText.length < 40) creativeTips.push("Your primary text is very short; say what the product does for the customer.");
  if (objectiveFitFor(campaign.objective, config.conversionEvent) < 1)
    budget.push(`Your goal is ${config.conversionEvent === "SALES" ? "sales" : "leads"}, so choose that objective so the platform optimizes for it.`);
  if (campaign.days < 4) budget.push("Very short campaigns spend much of their time in the learning phase; run for at least 4–7 days.");

  return {
    ratings: {
      audienceFit: Math.max(0, Math.min(1, audienceFit)),
      creative: Math.max(0, Math.min(1, creative)),
      objectiveFit: objectiveFitFor(campaign.objective, config.conversionEvent),
      source: "rules" as const,
    },
    feedback: {
      summary:
        "Here's rule-based feedback on your plan. (Detailed AI coaching is switched off for this academy.)",
      targeting,
      creative: creativeTips,
      budget,
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
      return {
        ratings: {
          audienceFit: scale(judgement.audienceFit),
          creative: scale(judgement.creativeQuality),
          objectiveFit: scale(judgement.objectiveFit),
          source: "ai",
        },
        feedback: {
          summary: judgement.summary,
          targeting: judgement.targeting,
          creative: judgement.creative,
          budget: judgement.budget,
        },
      };
    } catch (error) {
      console.error("AI campaign judging failed; using rules.", error);
    }
  }
  return judgeWithRules(campaign, config);
}
