// Ad Campaign Simulator: options, input validation, the market model and
// goal scoring. Pure functions with no database or network access, so the
// same code runs on the server and in the admin preview.
//
// It's a teaching model, not a forecast: numbers respond to the decisions
// that matter on real ad platforms (objective, audience size and fit,
// placements, bidding, budget, creative quality, ad fatigue, the learning
// phase) with plausible Nigerian-market prices.
//
// A campaign can have several ads (up to 5), like an ad set: the platform
// spends some budget testing each, then favours the strongest, and more
// ads also slow down ad fatigue. Too many ads on a small budget waste money
// on testing. Results are broken down per ad.

import { isMediaRef, mediaOwner } from "@/lib/lab-media-shared";

export type Objective = "AWARENESS" | "TRAFFIC" | "LEADS" | "SALES";
export type Placement = "FEED" | "STORIES" | "REELS" | "PARTNER_APPS";
export type Bidding = "LOWEST_COST" | "COST_CAP" | "BID_CAP";
export type AdFormat = "IMAGE" | "VIDEO" | "CAROUSEL";
export type Gender = "ALL" | "MEN" | "WOMEN";
export type GoalMetric =
  | "CONVERSIONS"
  | "COST_PER_CONVERSION"
  | "ROAS"
  | "CTR"
  | "REACH"
  | "CLICKS"
  | "CPC";

export const OBJECTIVES: Record<
  Objective,
  { label: string; help: string; result: string }
> = {
  AWARENESS: {
    label: "Awareness",
    help: "Show the ad to as many people as possible.",
    result: "People reached",
  },
  TRAFFIC: {
    label: "Traffic",
    help: "Send people to a website or WhatsApp.",
    result: "Link clicks",
  },
  LEADS: {
    label: "Leads",
    help: "Collect sign-ups, enquiries or phone numbers.",
    result: "Leads",
  },
  SALES: {
    label: "Sales",
    help: "Get people to buy.",
    result: "Purchases",
  },
};

export const PLACEMENTS: Record<
  Placement,
  { label: string; cpm: number; ctr: number }
> = {
  FEED: { label: "Feed", cpm: 1, ctr: 1 },
  STORIES: { label: "Stories", cpm: 0.85, ctr: 0.8 },
  REELS: { label: "Reels", cpm: 0.75, ctr: 0.9 },
  PARTNER_APPS: { label: "Partner apps & sites", cpm: 0.5, ctr: 0.55 },
};

export const BIDDING: Record<Bidding, { label: string; help: string }> = {
  LOWEST_COST: {
    label: "Lowest cost",
    help: "Spend the whole budget for as many results as possible.",
  },
  COST_CAP: {
    label: "Cost per result cap",
    help: "Keep the average cost per result at or below your cap; may spend less.",
  },
  BID_CAP: {
    label: "Bid cap",
    help: "Never bid above your cap in each auction; cheaper, but may not spend.",
  },
};

export const FORMATS: Record<AdFormat, string> = {
  IMAGE: "Single image",
  VIDEO: "Video",
  CAROUSEL: "Carousel",
};

export const CALLS_TO_ACTION = [
  "Shop now",
  "Order now",
  "Learn more",
  "Sign up",
  "Send message",
  "Book now",
  "Get offer",
  "Contact us",
  "Download",
  "Apply now",
] as const;

/** States, with a rough count of adults on social media (thousands). */
export const LOCATIONS: Array<{ id: string; name: string; online: number }> = [
  { id: "lagos", name: "Lagos", online: 9500 },
  { id: "fct", name: "Abuja (FCT)", online: 2400 },
  { id: "rivers", name: "Rivers", online: 2600 },
  { id: "oyo", name: "Oyo", online: 2900 },
  { id: "kano", name: "Kano", online: 3100 },
  { id: "kaduna", name: "Kaduna", online: 2300 },
  { id: "ogun", name: "Ogun", online: 2100 },
  { id: "anambra", name: "Anambra", online: 1900 },
  { id: "enugu", name: "Enugu", online: 1500 },
  { id: "delta", name: "Delta", online: 1800 },
  { id: "edo", name: "Edo", online: 1500 },
  { id: "imo", name: "Imo", online: 1600 },
  { id: "akwa-ibom", name: "Akwa Ibom", online: 1400 },
  { id: "kwara", name: "Kwara", online: 1100 },
  { id: "osun", name: "Osun", online: 1300 },
  { id: "ondo", name: "Ondo", online: 1300 },
  { id: "abia", name: "Abia", online: 1100 },
  { id: "cross-river", name: "Cross River", online: 1000 },
  { id: "plateau", name: "Plateau", online: 1000 },
  { id: "rest", name: "Rest of Nigeria", online: 12000 },
];

export const INTERESTS = [
  "Fashion",
  "Beauty & skincare",
  "Hair care",
  "Fitness",
  "Health & wellness",
  "Food & dining",
  "Cooking",
  "Fast food",
  "Online shopping",
  "Technology",
  "Smartphones",
  "Gaming",
  "Football",
  "Music",
  "Movies & Nollywood",
  "Travel",
  "Business",
  "Entrepreneurship",
  "Small business",
  "Personal finance",
  "Cryptocurrency",
  "Education",
  "Jobs & careers",
  "Students",
  "Parenting",
  "Weddings",
  "Real estate",
  "Home decor",
  "Cars",
  "Agriculture",
  "Software development",
  "Digital marketing",
  "Photography",
  "Art & design",
  "Events & nightlife",
  "Luxury goods",
  "Religion",
  "Pets",
] as const;

/** Starting prices for common industries (₦ per 1,000 views, %, %). */
export const INDUSTRY_PRESETS: Record<
  string,
  { cpm: number; ctr: number; cvr: number }
> = {
  "Fashion & clothing": { cpm: 900, ctr: 1.1, cvr: 2.0 },
  "Food & restaurants": { cpm: 700, ctr: 1.4, cvr: 3.0 },
  "Beauty & skincare": { cpm: 950, ctr: 1.2, cvr: 2.4 },
  "Education & courses": { cpm: 1100, ctr: 0.9, cvr: 4.0 },
  "Tech & gadgets": { cpm: 1200, ctr: 0.8, cvr: 1.5 },
  "Services (salon, repairs…)": { cpm: 800, ctr: 1.0, cvr: 5.0 },
  "Real estate": { cpm: 1500, ctr: 0.6, cvr: 0.8 },
};

export const GOAL_METRICS: Record<
  GoalMetric,
  { label: string; op: "gte" | "lte"; unit: "count" | "naira" | "ratio" | "percent" }
> = {
  CONVERSIONS: { label: "Conversions", op: "gte", unit: "count" },
  COST_PER_CONVERSION: { label: "Cost per conversion", op: "lte", unit: "naira" },
  ROAS: { label: "Return on ad spend (ROAS)", op: "gte", unit: "ratio" },
  CTR: { label: "Click-through rate", op: "gte", unit: "percent" },
  REACH: { label: "People reached", op: "gte", unit: "count" },
  CLICKS: { label: "Link clicks", op: "gte", unit: "count" },
  CPC: { label: "Cost per click", op: "lte", unit: "naira" },
};

export type Audience = {
  locations: string[];
  ageMin: number;
  ageMax: number;
  gender: Gender;
  interests: string[];
};

/** What the intern builds. */
/** Where the ad sends people. */
export type Destination = "WEBSITE" | "WHATSAPP" | "INSTAGRAM_DM" | "CALL";

export const DESTINATIONS: Record<
  Destination,
  { label: string; help: string; ctr: number; cvr: Record<"SALES" | "LEADS", number> }
> = {
  WEBSITE: {
    label: "Website",
    help: "A product page or form on the business's site.",
    ctr: 1,
    cvr: { SALES: 1, LEADS: 0.9 },
  },
  WHATSAPP: {
    label: "WhatsApp chat",
    help: "Opens a chat with the business; many Nigerian customers prefer to ask and order this way.",
    ctr: 1,
    cvr: { SALES: 1.05, LEADS: 1.15 },
  },
  INSTAGRAM_DM: {
    label: "Instagram message",
    help: "Opens a direct message to the business's Instagram.",
    ctr: 1,
    cvr: { SALES: 0.95, LEADS: 1 },
  },
  CALL: {
    label: "Phone call",
    help: "Calls the business. Fewer people tap, but callers are ready.",
    ctr: 0.85,
    cvr: { SALES: 0.85, LEADS: 1.05 },
  },
};

/** One ad in the campaign; the platform tests them and favours the best. */
export type Creative = {
  id: string;
  /** "Ad A", "Ad B"… or the intern's own name for it. */
  name: string;
  format: AdFormat;
  /** Image ad: the image. Video ad: the cover (first frame). "" = none. */
  image: string;
  /** Carousel: 2–5 cards, each an image (or "") and a headline. */
  cards: Array<{ image: string; headline: string }>;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  /** What the image or video shows (also its alt text without an upload). */
  visual: string;
  /** Video: the script or storyboard, scene by scene. */
  script: string;
  /** Video length in seconds. */
  seconds: number;
};

export const MAX_CREATIVES = 5;
export const MAX_CARDS = 5;

export type Campaign = Audience & {
  name: string;
  objective: Objective;
  dailyBudget: number;
  days: number;
  placements: Placement[];
  bidding: Bidding;
  /** ₦ cap for COST_CAP (per result) or BID_CAP (per 1,000 views). */
  bidAmount: number | null;
  destination: Destination;
  creatives: Creative[];
};

export type GoalTarget = { metric: GoalMetric; value: number };

/** What the admin sets for an exercise. */
export type AdsConfig = {
  business: { name: string; description: string };
  product: { name: string; description: string; price: number };
  /** The event that counts as a conversion (a sale or a lead). */
  conversionEvent: "SALES" | "LEADS";
  idealAudience: Audience;
  benchmarks: { cpm: number; ctr: number; cvr: number };
  goals: GoalTarget[];
  maxRuns: number;
  maxTotalBudget: number;
};

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  business: {
    name: "Mama Put Express",
    description:
      "A Lagos food-delivery kitchen selling home-style jollof rice, fried rice and small chops, delivered within 45 minutes across Lekki, Victoria Island and Ikoyi.",
  },
  product: {
    name: "Jollof combo (rice, chicken, plantain, drink)",
    description: "Lunch combo delivered hot within 45 minutes.",
    price: 4500,
  },
  conversionEvent: "SALES",
  idealAudience: {
    locations: ["lagos"],
    ageMin: 22,
    ageMax: 40,
    gender: "ALL",
    interests: ["Food & dining", "Fast food", "Online shopping"],
  },
  benchmarks: INDUSTRY_PRESETS["Food & restaurants"],
  goals: [
    { metric: "CONVERSIONS", value: 40 },
    { metric: "COST_PER_CONVERSION", value: 2500 },
    { metric: "ROAS", value: 1.8 },
  ],
  maxRuns: 5,
  maxTotalBudget: 100000,
};

export const BLANK_CAMPAIGN: Campaign = {
  name: "My first campaign",
  objective: "TRAFFIC",
  dailyBudget: 5000,
  days: 7,
  locations: [],
  ageMin: 18,
  ageMax: 65,
  gender: "ALL",
  interests: [],
  placements: ["FEED", "STORIES", "REELS", "PARTNER_APPS"],
  bidding: "LOWEST_COST",
  bidAmount: null,
  destination: "WEBSITE",
  creatives: [blankCreative(0)],
};

/** A new empty ad; `index` names it Ad A, Ad B… */
export function blankCreative(index: number, format: AdFormat = "IMAGE"): Creative {
  return {
    id: `ad${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    name: `Ad ${String.fromCharCode(65 + index)}`,
    format,
    image: "",
    cards: format === "CAROUSEL" ? [{ image: "", headline: "" }, { image: "", headline: "" }] : [],
    primaryText: "",
    headline: "",
    description: "",
    cta: "Learn more",
    visual: "",
    script: "",
    seconds: 15,
  };
}

/** Every image a campaign uses. */
export function campaignMedia(campaign: Campaign) {
  return campaign.creatives.flatMap((creative) =>
    [creative.image, ...creative.cards.map((card) => card.image)].filter(Boolean),
  );
}

/** The campaign with images that aren't `userId`'s removed (they can't use others'). */
export function keepOwnMedia(campaign: Campaign, userId: string): Campaign {
  const own = (ref: string) => (ref && mediaOwner(ref) === userId ? ref : "");
  return {
    ...campaign,
    creatives: campaign.creatives.map((creative) => ({
      ...creative,
      image: own(creative.image),
      cards: creative.cards.map((card) => ({ ...card, image: own(card.image) })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T) =>
  options.includes(value as T) ? (value as T) : fallback;
const locationIds = LOCATIONS.map((location) => location.id);

function parseAudience(raw: Record<string, unknown>, fallback: Audience): Audience {
  const ageMin = clampInt(raw.ageMin, 13, 65, fallback.ageMin);
  return {
    locations: Array.isArray(raw.locations)
      ? [...new Set(raw.locations.filter((id): id is string => locationIds.includes(id as string)))]
      : fallback.locations,
    ageMin,
    ageMax: Math.max(ageMin, clampInt(raw.ageMax, 13, 65, fallback.ageMax)),
    gender: oneOf(raw.gender, ["ALL", "MEN", "WOMEN"] as const, fallback.gender),
    interests: Array.isArray(raw.interests)
      ? [
          ...new Set(
            raw.interests.filter((item): item is string =>
              (INTERESTS as readonly string[]).includes(item as string),
            ),
          ),
        ].slice(0, 10)
      : fallback.interests,
  };
}

const imageRef = (value: unknown) => (isMediaRef(value) ? value : "");

function parseCreative(value: unknown, index: number): Creative {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const format = oneOf(raw.format, Object.keys(FORMATS) as AdFormat[], "IMAGE");
  const cards = Array.isArray(raw.cards)
    ? raw.cards.slice(0, MAX_CARDS).map((card) => {
        const c = card && typeof card === "object" ? (card as Record<string, unknown>) : {};
        return { image: imageRef(c.image), headline: text(c.headline, 60) };
      })
    : [];
  const blank = blankCreative(index, format);
  return {
    id: (typeof raw.id === "string" && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : null) ?? blank.id,
    name: text(raw.name, 40) || blank.name,
    format,
    image: format === "CAROUSEL" ? "" : imageRef(raw.image),
    cards: format === "CAROUSEL" ? (cards.length ? cards : blank.cards) : [],
    primaryText: text(raw.primaryText, 600),
    headline: text(raw.headline, 80),
    description: text(raw.description, 120),
    cta: oneOf(raw.cta, CALLS_TO_ACTION, "Learn more"),
    visual: text(raw.visual, 400),
    script: format === "VIDEO" ? text(raw.script, 1200) : "",
    seconds: clampInt(raw.seconds, 5, 120, 15),
  };
}

/** A campaign from untrusted input, with safe defaults. */
export function parseCampaign(value: unknown): Campaign {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  // Campaigns saved before multiple ads had one ad's fields on the campaign.
  const creatives = Array.isArray(raw.creatives)
    ? raw.creatives.slice(0, MAX_CREATIVES).map(parseCreative)
    : [parseCreative({ ...raw, id: "ad1", name: "Ad A" }, 0)];
  const ids = new Set<string>();
  for (const creative of creatives) {
    if (ids.has(creative.id)) creative.id = `${creative.id}-${ids.size}`;
    ids.add(creative.id);
  }
  const placements = Array.isArray(raw.placements)
    ? [
        ...new Set(
          raw.placements.filter((item): item is Placement =>
            Object.keys(PLACEMENTS).includes(item as string),
          ),
        ),
      ]
    : BLANK_CAMPAIGN.placements;
  const bidding = oneOf(raw.bidding, Object.keys(BIDDING) as Bidding[], "LOWEST_COST");
  return {
    ...parseAudience(raw, BLANK_CAMPAIGN),
    name: text(raw.name, 80) || "Untitled campaign",
    objective: oneOf(raw.objective, Object.keys(OBJECTIVES) as Objective[], "TRAFFIC"),
    dailyBudget: clampInt(raw.dailyBudget, 0, 10_000_000, BLANK_CAMPAIGN.dailyBudget),
    days: clampInt(raw.days, 1, 30, BLANK_CAMPAIGN.days),
    placements: placements.length ? placements : ["FEED"],
    bidding,
    bidAmount:
      bidding === "LOWEST_COST" ? null : clampInt(raw.bidAmount, 1, 10_000_000, 1000),
    destination: oneOf(raw.destination, Object.keys(DESTINATIONS) as Destination[], "WEBSITE"),
    creatives: creatives.length ? creatives : [blankCreative(0)],
  };
}

/** Problems that stop a campaign from running (shown to the intern). */
export function campaignProblems(
  campaign: Campaign,
  config: Pick<AdsConfig, "maxTotalBudget">,
) {
  const problems: string[] = [];
  const total = campaign.dailyBudget * campaign.days;
  if (campaign.dailyBudget < 1000) problems.push("Set a daily budget of at least ₦1,000.");
  if (total > config.maxTotalBudget)
    problems.push(
      `Your total budget (₦${total.toLocaleString("en-NG")}) is over this exercise's limit of ₦${config.maxTotalBudget.toLocaleString("en-NG")}.`,
    );
  if (!campaign.locations.length) problems.push("Choose at least one location.");
  for (const ad of campaign.creatives) {
    if (!ad.primaryText) problems.push(`${ad.name}: write the primary text.`);
    if (ad.format === "CAROUSEL") {
      if (ad.cards.length < 2) problems.push(`${ad.name}: a carousel needs at least 2 cards.`);
      if (ad.cards.some((card) => !card.headline)) problems.push(`${ad.name}: give every card a headline.`);
    } else {
      if (!ad.headline) problems.push(`${ad.name}: write a headline.`);
      if (!ad.image && ad.visual.length < 10)
        problems.push(`${ad.name}: add ${ad.format === "VIDEO" ? "a cover image" : "an image"} or describe it.`);
    }
    if (ad.format === "VIDEO" && ad.script.length < 20)
      problems.push(`${ad.name}: write the video's script (what happens, scene by scene).`);
  }
  return problems;
}

/** Exercise settings from untrusted (admin) input. */
export function parseAdsConfig(value: unknown): AdsConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const obj = (key: string) =>
    raw[key] && typeof raw[key] === "object" ? (raw[key] as Record<string, unknown>) : {};
  const business = obj("business");
  const product = obj("product");
  const benchmarks = obj("benchmarks");
  const goals = Array.isArray(raw.goals)
    ? raw.goals
        .filter(
          (goal): goal is { metric: GoalMetric; value: unknown } =>
            Boolean(goal) &&
            Object.keys(GOAL_METRICS).includes((goal as { metric?: string }).metric ?? ""),
        )
        .map((goal) => ({ metric: goal.metric, value: Math.max(0, Number(goal.value) || 0) }))
        .slice(0, 6)
    : DEFAULT_ADS_CONFIG.goals;
  const ratio = (v: unknown, fallback: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
  };
  return {
    business: {
      name: text(business.name, 80) || DEFAULT_ADS_CONFIG.business.name,
      description: text(business.description, 1000),
    },
    product: {
      name: text(product.name, 120) || "Product",
      description: text(product.description, 500),
      price: clampInt(product.price, 0, 100_000_000, DEFAULT_ADS_CONFIG.product.price),
    },
    conversionEvent: oneOf(raw.conversionEvent, ["SALES", "LEADS"] as const, "SALES"),
    idealAudience: parseAudience(obj("idealAudience"), DEFAULT_ADS_CONFIG.idealAudience),
    benchmarks: {
      cpm: ratio(benchmarks.cpm, DEFAULT_ADS_CONFIG.benchmarks.cpm, 20000),
      ctr: ratio(benchmarks.ctr, DEFAULT_ADS_CONFIG.benchmarks.ctr, 20),
      cvr: ratio(benchmarks.cvr, DEFAULT_ADS_CONFIG.benchmarks.cvr, 50),
    },
    goals,
    maxRuns: clampInt(raw.maxRuns, 1, 20, DEFAULT_ADS_CONFIG.maxRuns),
    maxTotalBudget: clampInt(raw.maxTotalBudget, 1000, 100_000_000, DEFAULT_ADS_CONFIG.maxTotalBudget),
  };
}

/** What interns may see of an exercise (no ideal audience or prices). */
export function publicAdsConfig(config: AdsConfig) {
  return {
    business: config.business,
    product: config.product,
    conversionEvent: config.conversionEvent,
    goals: config.goals,
    maxRuns: config.maxRuns,
    maxTotalBudget: config.maxTotalBudget,
  };
}
export type PublicAdsConfig = ReturnType<typeof publicAdsConfig>;

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** How well the plan fits, 0–1, from the AI judge (or the rules fallback). */
export type Ratings = {
  audienceFit: number;
  /** The ads' quality overall (the average of `creatives`). */
  creative: number;
  objectiveFit: number;
  source: "ai" | "rules";
  /** Each ad's quality, 0–1 (missing on runs from before multiple ads). */
  creatives?: Array<{ id: string; quality: number }>;
};

/** How one ad did within the campaign. */
export type CreativeResult = {
  id: string;
  name: string;
  format: AdFormat;
  /** Share of the budget the platform gave it, 0–1. */
  share: number;
  quality: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerConversion: number;
};

/** How well each format suits each placement (a CTR multiplier). */
const FORMAT_FIT: Record<AdFormat, Record<Placement, number>> = {
  IMAGE: { FEED: 1, STORIES: 0.9, REELS: 0.8, PARTNER_APPS: 1 },
  VIDEO: { FEED: 1.05, STORIES: 1.12, REELS: 1.2, PARTNER_APPS: 0.9 },
  CAROUSEL: { FEED: 1.1, STORIES: 0.85, REELS: 0.75, PARTNER_APPS: 0.95 },
};

export type RunTotals = {
  plannedBudget: number;
  spend: number;
  audienceSize: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  costPerConversion: number;
  revenue: number;
  roas: number;
};

export type GoalResult = {
  metric: GoalMetric;
  label: string;
  target: number;
  actual: number;
  met: boolean;
};

export type RunResult = {
  totals: RunTotals;
  daily: Array<{ day: number; spend: number; impressions: number; clicks: number; conversions: number }>;
  ratings: Ratings;
  goals: GoalResult[];
  /** 0–100: how close the run came to every goal. */
  score: number;
  notes: string[];
  /** Per ad (missing on runs from before multiple ads). */
  creatives?: CreativeResult[];
};

/** Deterministic random numbers (mulberry32) from a text seed. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ageShare(ageMin: number, ageMax: number) {
  // Nigeria's online audience skews young.
  const weight = (age: number) => (age < 35 ? 1.4 : age < 50 ? 1 : 0.45);
  let inRange = 0;
  let all = 0;
  for (let age = 18; age <= 65; age++) {
    all += weight(age);
    if (age >= ageMin && age <= ageMax) inRange += weight(age);
  }
  return all ? inRange / all : 0;
}

/** Estimated people who match the targeting. */
export function audienceSize(audience: Audience) {
  const online =
    LOCATIONS.filter((location) => audience.locations.includes(location.id)).reduce(
      (sum, location) => sum + location.online,
      0,
    ) * 1000;
  const gender = audience.gender === "ALL" ? 1 : 0.5;
  // Interests widen within the pool (people matching any of them).
  const interests = audience.interests.length
    ? 1 - Math.pow(0.88, audience.interests.length)
    : 1;
  return Math.round(online * ageShare(audience.ageMin, audience.ageMax) * gender * interests);
}

const OBJECTIVE_CPM: Record<Objective, number> = {
  AWARENESS: 0.75,
  TRAFFIC: 1,
  LEADS: 1.2,
  SALES: 1.35,
};
const OBJECTIVE_CTR: Record<Objective, number> = {
  AWARENESS: 0.7,
  TRAFFIC: 1.2,
  LEADS: 1,
  SALES: 1,
};

/** Conversion efficiency when optimizing for `chosen` but measuring `wanted`. */
export function objectiveFitFor(chosen: Objective, wanted: "SALES" | "LEADS") {
  if (chosen === wanted) return 1;
  if (chosen === "SALES" || chosen === "LEADS") return 0.7;
  return chosen === "TRAFFIC" ? 0.5 : 0.25;
}

export function simulateCampaign(input: {
  campaign: Campaign;
  config: AdsConfig;
  ratings: Ratings;
  seed: string;
}): RunResult {
  const { campaign, config, ratings } = input;
  const random = seededRandom(input.seed);
  const noise = (spread: number) => 1 + (random() * 2 - 1) * spread;
  const notes: string[] = [];

  const size = Math.max(1000, audienceSize(campaign));
  const plannedBudget = campaign.dailyBudget * campaign.days;

  // Price of 1,000 views: placements, objective, how narrow the audience is.
  const placementCpm =
    campaign.placements.reduce((sum, key) => sum + PLACEMENTS[key].cpm, 0) /
    campaign.placements.length;
  const placementCtr =
    campaign.placements.reduce((sum, key) => sum + PLACEMENTS[key].ctr, 0) /
    campaign.placements.length;
  const narrow = size < 50_000 ? 1.6 : size < 200_000 ? 1.3 : size < 1_000_000 ? 1.1 : 1;
  let cpm =
    config.benchmarks.cpm *
    placementCpm *
    OBJECTIVE_CPM[campaign.objective] *
    narrow *
    noise(0.08);
  if (narrow > 1.2)
    notes.push("Your audience is small, so views cost more and the same people see the ad repeatedly.");

  // The ads: each one's strength is its quality and how well its format
  // suits the placements. The platform spends part of the budget testing
  // every ad, then gives the rest mostly to the strongest.
  const ads = campaign.creatives;
  const strength = ads.map((ad) => {
    const quality = ratings.creatives?.find((r) => r.id === ad.id)?.quality ?? ratings.creative;
    const fit =
      campaign.placements.reduce((sum, key) => sum + FORMAT_FIT[ad.format][key], 0) /
      campaign.placements.length;
    return { quality, value: Math.max(0.02, Math.min(1, quality * fit)) };
  });
  const perAdDaily = campaign.dailyBudget / ads.length;
  const tooThin = ads.length > 1 && perAdDaily < 1500;
  const explore = ads.length === 1 ? 0 : Math.min(0.6, 0.1 * ads.length * (tooThin ? 1.6 : 1));
  const weight = strength.map((s) => s.value ** 3);
  const weightSum = weight.reduce((a, b) => a + b, 0) || 1;
  const shares = weight.map((w) => explore / ads.length + (1 - explore) * (w / weightSum));
  const creativeQuality = shares.reduce((sum, share, i) => sum + share * strength[i].value, 0);
  const creativeMult = (0.45 + 1.1 * creativeQuality) * (tooThin ? 0.92 : 1);
  if (tooThin)
    notes.push(
      `Each of your ${ads.length} ads got about ₦${Math.round(perAdDaily).toLocaleString("en-NG")} a day: too little for the platform to learn which works. Use fewer ads or a bigger budget.`,
    );
  else if (ads.length > 1) {
    const best = shares.indexOf(Math.max(...shares));
    if (Math.max(...shares) - Math.min(...shares) < 0.05)
      notes.push(
        `Your ${ads.length} ads performed about the same, so the budget was split evenly. Make them more different (another image, angle or offer) to learn what works.`,
      );
    else
      notes.push(
        `The platform tested your ${ads.length} ads and gave ${ads[best].name} ${Math.round(shares[best] * 100)}% of the budget because it performed best.`,
      );
  }
  const destination = DESTINATIONS[campaign.destination];
  const audienceMult = 0.4 + 1.2 * ratings.audienceFit;
  const objectiveMult = Math.max(
    0.2,
    Math.min(1, (ratings.objectiveFit + objectiveFitFor(campaign.objective, config.conversionEvent)) / 2),
  );

  // Bidding: caps that are too low leave budget unspent.
  let spendShare = 0.97 + random() * 0.03;
  if (campaign.bidding === "BID_CAP" && campaign.bidAmount) {
    const ratio = campaign.bidAmount / cpm;
    spendShare *= Math.min(1, Math.max(0.05, ratio ** 2));
    if (ratio < 1) notes.push("Your bid cap was below the going price, so the campaign couldn't spend its budget.");
    cpm = Math.min(cpm, campaign.bidAmount * 1.05);
  }

  // People seen and how often: reach flattens as the audience is used up.
  let impressions = ((plannedBudget * spendShare) / cpm) * 1000;
  const maxImpressions = size * Math.min(12, 1.5 + campaign.days * 0.7);
  if (impressions > maxImpressions) {
    impressions = maxImpressions;
    notes.push("The budget was bigger than the audience could absorb; widen the audience or lower the budget.");
  }
  const reachFor = (views: number) =>
    Math.min(size, Math.round(size * (1 - Math.exp(-views / size))));
  let reach = reachFor(impressions);
  let frequency = reach ? impressions / reach : 0;
  // Rotating several ads keeps them fresh for longer.
  const fatigueStart = 3 + 0.6 * Math.min(3, ads.length - 1);
  const fatigue = frequency > fatigueStart ? 1 / (1 + 0.12 * (frequency - fatigueStart)) : 1;
  if (frequency > fatigueStart + 1) notes.push(`People saw the ad ${frequency.toFixed(1)} times on average, so it wore out and clicks dropped.`);

  const ctr =
    (config.benchmarks.ctr / 100) *
    creativeMult *
    (0.6 + 0.4 * audienceMult) *
    placementCtr *
    OBJECTIVE_CTR[campaign.objective] *
    destination.ctr *
    fatigue *
    noise(0.1);
  let clicks = impressions * ctr;
  const cvr =
    (config.benchmarks.cvr / 100) *
    audienceMult *
    objectiveMult *
    destination.cvr[config.conversionEvent] *
    noise(0.12);
  let conversions = clicks * 0.8 * cvr;
  let spend = (impressions / 1000) * cpm;

  // A cost-per-result cap only buys results it can afford.
  if (campaign.bidding === "COST_CAP" && campaign.bidAmount && conversions > 0) {
    const costPerResult = spend / conversions;
    if (costPerResult > campaign.bidAmount) {
      const share = Math.max(0.05, (campaign.bidAmount / costPerResult) ** 2);
      impressions *= share;
      clicks *= share;
      conversions *= share;
      spend *= share;
      reach = reachFor(impressions);
      frequency = reach ? impressions / reach : 0;
      notes.push("Your cost cap was lower than results really cost, so the campaign under-spent.");
    }
  }

  // Day by day, with a weaker learning phase at the start.
  const efficiency = Array.from({ length: campaign.days }, (_, i) =>
    i === 0 ? 0.7 : i === 1 ? 0.82 : i === 2 ? 0.92 : 1,
  );
  const efficiencySum = efficiency.reduce((a, b) => a + b, 0);
  const daily = efficiency.map((weight, i) => ({
    day: i + 1,
    spend: Math.round(spend / campaign.days),
    impressions: Math.round(impressions / campaign.days),
    clicks: Math.round((clicks * weight) / efficiencySum),
    conversions: Math.round(((conversions * weight) / efficiencySum) * 10) / 10,
  }));

  const roundedConversions = Math.round(conversions);
  const revenue = roundedConversions * config.product.price;
  const totals: RunTotals = {
    plannedBudget,
    spend: Math.round(spend),
    audienceSize: size,
    impressions: Math.round(impressions),
    reach,
    frequency: Math.round(frequency * 100) / 100,
    clicks: Math.round(clicks),
    ctr: Math.round((clicks / Math.max(1, impressions)) * 10000) / 100,
    cpc: Math.round(spend / Math.max(1, clicks)),
    cpm: Math.round(cpm),
    conversions: roundedConversions,
    costPerConversion: roundedConversions ? Math.round(spend / roundedConversions) : 0,
    revenue,
    roas: spend ? Math.round((revenue / spend) * 100) / 100 : 0,
  };

  // Per ad: its share of the spend, and clicks by how strong it is.
  const pull = shares.map((share, i) => share * (0.45 + 1.1 * strength[i].value));
  const pullSum = pull.reduce((a, b) => a + b, 0) || 1;
  const creatives: CreativeResult[] = ads.map((ad, i) => {
    const adImpressions = totals.impressions * shares[i];
    const adClicks = totals.clicks * (pull[i] / pullSum);
    const adConversions = Math.round(totals.conversions * (pull[i] / pullSum) * 10) / 10;
    const adSpend = Math.round(totals.spend * shares[i]);
    return {
      id: ad.id,
      name: ad.name,
      format: ad.format,
      share: Math.round(shares[i] * 1000) / 1000,
      quality: Math.round(strength[i].quality * 100) / 100,
      spend: adSpend,
      impressions: Math.round(adImpressions),
      clicks: Math.round(adClicks),
      ctr: Math.round((adClicks / Math.max(1, adImpressions)) * 10000) / 100,
      conversions: adConversions,
      costPerConversion: adConversions >= 1 ? Math.round(adSpend / adConversions) : 0,
    };
  });

  const goals = config.goals.map((goal) => evaluateGoal(goal, totals));
  const score = goals.length
    ? Math.round((goals.reduce((sum, goal) => sum + goalCredit(goal), 0) / goals.length) * 100)
    : 0;
  return { totals, daily, ratings, goals, score, notes, creatives };
}

function metricValue(metric: GoalMetric, totals: RunTotals) {
  switch (metric) {
    case "CONVERSIONS":
      return totals.conversions;
    case "COST_PER_CONVERSION":
      return totals.costPerConversion;
    case "ROAS":
      return totals.roas;
    case "CTR":
      return totals.ctr;
    case "REACH":
      return totals.reach;
    case "CLICKS":
      return totals.clicks;
    case "CPC":
      return totals.cpc;
  }
}

function evaluateGoal(goal: GoalTarget, totals: RunTotals): GoalResult {
  const info = GOAL_METRICS[goal.metric];
  const actual = metricValue(goal.metric, totals);
  // A cost of 0 means nothing was bought, which never meets a cost goal.
  const met =
    info.op === "gte" ? actual >= goal.value : actual > 0 && actual <= goal.value;
  return { metric: goal.metric, label: info.label, target: goal.value, actual, met };
}

/** Partial credit for getting close to a goal. */
function goalCredit(goal: GoalResult) {
  if (goal.met) return 1;
  if (!goal.actual || !goal.target) return 0;
  const op = GOAL_METRICS[goal.metric].op;
  const ratio = op === "gte" ? goal.actual / goal.target : goal.target / goal.actual;
  return Math.max(0, Math.min(1, ratio)) * 0.8;
}

export function formatGoalValue(metric: GoalMetric, value: number) {
  const unit = GOAL_METRICS[metric].unit;
  if (unit === "naira") return `₦${Math.round(value).toLocaleString("en-NG")}`;
  if (unit === "percent") return `${value}%`;
  if (unit === "ratio") return `${value}×`;
  return Math.round(value).toLocaleString("en-NG");
}
