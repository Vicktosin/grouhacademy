// Ad Campaign Simulator ("Grouh Ads Studio"): options, input validation, the
// market model and goal scoring. Pure functions with no database or network
// access, so the same code runs on the server and in the admin preview.
//
// It's a teaching model, not a forecast. It follows how the big social ad
// platforms work (a campaign with an objective, ad sets with their own
// audience, placements, budget and schedule, and ads), using the industry's
// usual terms, so interns can find their way around a real ads manager.
// It's our own design and names, and isn't affiliated with any platform.
//
// Numbers respond to the decisions that matter: objective and performance
// goal, audience size and fit (including warm custom audiences and
// lookalikes), placements, budget level and bidding, creative quality, ad
// fatigue, the learning phase, ad sets competing for the same people, and
// special ad category rules. Prices are plausible for the Nigerian market.

import { isMediaRef, mediaOwner } from "@/lib/lab-media-shared";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type Objective = "AWARENESS" | "TRAFFIC" | "ENGAGEMENT" | "LEADS" | "APP_PROMOTION" | "SALES";
export type SpecialCategory = "NONE" | "CREDIT" | "EMPLOYMENT" | "HOUSING" | "POLITICS";
export type BudgetType = "DAILY" | "LIFETIME";
export type BudgetMode = "CAMPAIGN" | "AD_SET";
export type BidStrategy = "HIGHEST_VOLUME" | "COST_PER_RESULT" | "BID_CAP" | "ROAS_GOAL";
export type Destination = "WEBSITE" | "WHATSAPP" | "INSTAGRAM_DM" | "CALL" | "INSTANT_FORM" | "APP" | "ON_AD";
export type PerformanceGoal =
  | "REACH"
  | "IMPRESSIONS"
  | "AD_RECALL"
  | "LINK_CLICKS"
  | "LANDING_PAGE_VIEWS"
  | "POST_ENGAGEMENT"
  | "VIDEO_VIEWS"
  | "CONVERSATIONS"
  | "LEADS"
  | "APP_INSTALLS"
  | "CONVERSIONS"
  | "CONVERSION_VALUE";
export type Placement = "FEEDS" | "STORIES" | "REELS" | "IN_STREAM" | "SEARCH" | "MESSAGES" | "PARTNER_APPS";
export type PlacementMode = "AUTO" | "MANUAL";
export type CustomAudience = "WEBSITE_VISITORS" | "ENGAGERS" | "CUSTOMERS";
export type AdFormat = "IMAGE" | "VIDEO" | "CAROUSEL";
export type Gender = "ALL" | "MEN" | "WOMEN";
export type GoalMetric = "CONVERSIONS" | "COST_PER_CONVERSION" | "ROAS" | "CTR" | "REACH" | "CLICKS" | "CPC";

export const OBJECTIVES: Record<Objective, { label: string; help: string; cpm: number; ctr: number }> = {
  AWARENESS: { label: "Awareness", help: "Show your ads to as many people as possible who are likely to remember them.", cpm: 0.75, ctr: 0.7 },
  TRAFFIC: { label: "Traffic", help: "Send people to a website, app or chat.", cpm: 1, ctr: 1.2 },
  ENGAGEMENT: { label: "Engagement", help: "Get more messages, video views, likes, comments or shares.", cpm: 0.9, ctr: 1 },
  LEADS: { label: "Leads", help: "Collect sign-ups, enquiries or phone numbers.", cpm: 1.2, ctr: 1 },
  APP_PROMOTION: { label: "App promotion", help: "Get people to install and use your app.", cpm: 1.15, ctr: 1 },
  SALES: { label: "Sales", help: "Find people likely to buy.", cpm: 1.35, ctr: 1 },
};

export const SPECIAL_CATEGORIES: Record<SpecialCategory, { label: string; help: string }> = {
  NONE: { label: "None", help: "Most businesses." },
  CREDIT: { label: "Financial products and services", help: "Loans, credit cards, insurance and similar." },
  EMPLOYMENT: { label: "Employment", help: "Job offers, internships and recruitment." },
  HOUSING: { label: "Housing", help: "Homes for sale or rent, mortgages and similar." },
  POLITICS: { label: "Social issues, elections or politics", help: "Ads about politics, elections or social issues." },
};

export const BID_STRATEGIES: Record<BidStrategy, { label: string; help: string; amount?: string }> = {
  HIGHEST_VOLUME: { label: "Highest volume", help: "Spend the whole budget to get as many results as possible." },
  COST_PER_RESULT: {
    label: "Cost per result goal",
    help: "Keep the average cost per result around your goal; may spend less.",
    amount: "Cost per result goal (₦)",
  },
  BID_CAP: {
    label: "Bid cap",
    help: "Never bid above your cap (per 1,000 views) in an auction; cheaper, but may not spend.",
    amount: "Bid cap per 1,000 views (₦)",
  },
  ROAS_GOAL: {
    label: "ROAS goal",
    help: "Aim for a minimum return on ad spend (sales only); spends less when it can't find it.",
    amount: "Minimum ROAS (e.g. 2 = ₦2 back per ₦1)",
  },
};

/** Where people go when they act on the ad ("conversion location"). */
export const DESTINATIONS: Record<
  Destination,
  { label: string; help: string; ctr: number; cvr: Record<"SALES" | "LEADS", number> }
> = {
  WEBSITE: { label: "Website", help: "A product page or form on the business's site.", ctr: 1, cvr: { SALES: 1, LEADS: 0.9 } },
  WHATSAPP: {
    label: "Messaging apps (WhatsApp)",
    help: "Opens a chat with the business; many Nigerian customers prefer to ask and order this way.",
    ctr: 1,
    cvr: { SALES: 1.05, LEADS: 1.15 },
  },
  INSTAGRAM_DM: { label: "Direct messages", help: "Opens a direct message to the business's profile.", ctr: 1, cvr: { SALES: 0.95, LEADS: 1 } },
  CALL: { label: "Calls", help: "Calls the business. Fewer people tap, but callers are ready.", ctr: 0.85, cvr: { SALES: 0.85, LEADS: 1.05 } },
  INSTANT_FORM: {
    label: "Instant forms",
    help: "A form that opens inside the app, already filled in. More leads, but often less serious ones.",
    ctr: 1.1,
    cvr: { SALES: 0.6, LEADS: 1.35 },
  },
  APP: { label: "App", help: "Opens the business's app or its app-store page.", ctr: 0.9, cvr: { SALES: 0.9, LEADS: 0.8 } },
  ON_AD: { label: "On your ad", help: "People react, comment, share or watch on the ad itself.", ctr: 0.6, cvr: { SALES: 0.4, LEADS: 0.4 } },
};

/** Which conversion locations each objective offers (none for awareness). */
export const OBJECTIVE_DESTINATIONS: Record<Objective, Destination[]> = {
  AWARENESS: [],
  TRAFFIC: ["WEBSITE", "WHATSAPP", "INSTAGRAM_DM", "CALL", "APP"],
  ENGAGEMENT: ["ON_AD", "WHATSAPP", "INSTAGRAM_DM"],
  LEADS: ["INSTANT_FORM", "WEBSITE", "WHATSAPP", "INSTAGRAM_DM", "CALL"],
  APP_PROMOTION: ["APP"],
  SALES: ["WEBSITE", "WHATSAPP", "INSTAGRAM_DM", "CALL", "APP"],
};

/**
 * What the ad set optimizes for ("performance goal"). `result` names what the
 * Results column counts; cpm/ctr/cvr are how it shifts prices and behaviour.
 */
export const PERFORMANCE_GOALS: Record<
  PerformanceGoal,
  { label: string; result: string; cpm: number; ctr: number; cvr: number; for: Objective[]; destinations?: Destination[] }
> = {
  REACH: { label: "Maximise reach", result: "Reach", cpm: 0.85, ctr: 0.7, cvr: 0.3, for: ["AWARENESS"] },
  IMPRESSIONS: { label: "Maximise impressions", result: "Impressions", cpm: 0.8, ctr: 0.65, cvr: 0.3, for: ["AWARENESS"] },
  AD_RECALL: { label: "Maximise ad recall lift", result: "Est. ad recall lift (people)", cpm: 0.9, ctr: 0.7, cvr: 0.3, for: ["AWARENESS"] },
  // Clicks bought cheaply come from people who click, not people who buy.
  LINK_CLICKS: { label: "Link clicks", result: "Link clicks", cpm: 1, ctr: 1.2, cvr: 0.4, for: ["TRAFFIC"] },
  LANDING_PAGE_VIEWS: {
    label: "Landing page views",
    result: "Landing page views",
    cpm: 1.05,
    ctr: 1.1,
    cvr: 0.45,
    for: ["TRAFFIC"],
    destinations: ["WEBSITE"],
  },
  POST_ENGAGEMENT: { label: "Post engagement", result: "Post engagements", cpm: 0.85, ctr: 0.9, cvr: 0.3, for: ["ENGAGEMENT"], destinations: ["ON_AD"] },
  VIDEO_VIEWS: { label: "Video views (ThruPlays)", result: "ThruPlays", cpm: 0.8, ctr: 0.8, cvr: 0.35, for: ["ENGAGEMENT", "AWARENESS"], destinations: ["ON_AD"] },
  CONVERSATIONS: {
    label: "Conversations",
    result: "Conversations started",
    cpm: 1.1,
    ctr: 1,
    cvr: 0.85,
    for: ["ENGAGEMENT", "LEADS", "SALES", "TRAFFIC"],
    destinations: ["WHATSAPP", "INSTAGRAM_DM"],
  },
  LEADS: { label: "Leads", result: "Leads", cpm: 1.2, ctr: 1, cvr: 1, for: ["LEADS"] },
  APP_INSTALLS: { label: "App installs", result: "App installs", cpm: 1.15, ctr: 1, cvr: 1, for: ["APP_PROMOTION"] },
  CONVERSIONS: { label: "Conversions (purchases)", result: "Purchases", cpm: 1.35, ctr: 1, cvr: 1, for: ["SALES"] },
  CONVERSION_VALUE: { label: "Value of conversions", result: "Purchases", cpm: 1.45, ctr: 1, cvr: 1.05, for: ["SALES"] },
};

/** The performance goals an ad set can choose, for its objective and conversion location. */
export function goalsFor(objective: Objective, destination: Destination | null): PerformanceGoal[] {
  return (Object.keys(PERFORMANCE_GOALS) as PerformanceGoal[]).filter((goal) => {
    const info = PERFORMANCE_GOALS[goal];
    if (!info.for.includes(objective)) return false;
    return !info.destinations || (destination !== null && info.destinations.includes(destination)) || objective === "AWARENESS";
  });
}

export const PLACEMENTS: Record<Placement, { label: string; cpm: number; ctr: number; help: string }> = {
  FEEDS: { label: "Feeds", cpm: 1, ctr: 1, help: "Scrolling feeds: the most common placement." },
  STORIES: { label: "Stories", cpm: 0.85, ctr: 0.8, help: "Full-screen, tall (9:16), between stories." },
  REELS: { label: "Reels", cpm: 0.75, ctr: 0.9, help: "Full-screen short videos." },
  IN_STREAM: { label: "In-stream videos", cpm: 0.7, ctr: 0.6, help: "Short ads during other people's videos." },
  SEARCH: { label: "Search results", cpm: 1.3, ctr: 1.3, help: "Next to search results: people looking for something." },
  MESSAGES: { label: "Inbox (messages)", cpm: 1.1, ctr: 0.85, help: "Between chats in the inbox." },
  PARTNER_APPS: { label: "Partner apps & sites", cpm: 0.5, ctr: 0.55, help: "Other apps and websites: cheap views, fewer real clicks." },
};

export const ADVANTAGE_PLACEMENTS: Placement[] = ["FEEDS", "STORIES", "REELS", "IN_STREAM", "SEARCH", "MESSAGES", "PARTNER_APPS"];

/** The business's warm audiences, built from its own data. */
export const CUSTOM_AUDIENCES: Record<
  CustomAudience,
  { label: string; help: string; size: number; fit: number; ctr: number; cvr: number }
> = {
  WEBSITE_VISITORS: { label: "Website visitors (last 30 days)", help: "People who visited the business's website.", size: 6000, fit: 0.85, ctr: 1.6, cvr: 2.4 },
  ENGAGERS: { label: "Engaged with the business's page (90 days)", help: "People who liked, commented, messaged or watched.", size: 25000, fit: 0.75, ctr: 1.4, cvr: 1.6 },
  CUSTOMERS: { label: "Customer list (past buyers)", help: "Phone numbers and emails of past customers.", size: 3000, fit: 0.9, ctr: 1.5, cvr: 2.8 },
};

/** Lookalikes of the customer list: smaller % = closer match. */
export const LOOKALIKES: Record<number, { label: string; fit: number }> = {
  1: { label: "1% (closest match)", fit: 0.82 },
  3: { label: "3%", fit: 0.72 },
  5: { label: "5% (broadest)", fit: 0.63 },
};

export const FORMATS: Record<AdFormat, string> = { IMAGE: "Single image", VIDEO: "Video", CAROUSEL: "Carousel" };

export const CALLS_TO_ACTION = [
  "Shop now",
  "Order now",
  "Learn more",
  "Sign up",
  "Send message",
  "Send WhatsApp message",
  "Book now",
  "Get offer",
  "Get quote",
  "Contact us",
  "Call now",
  "Download",
  "Install now",
  "Apply now",
  "Watch more",
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
export const INDUSTRY_PRESETS: Record<string, { cpm: number; ctr: number; cvr: number }> = {
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

// ---------------------------------------------------------------------------
// What the intern builds
// ---------------------------------------------------------------------------

export type Audience = {
  locations: string[];
  ageMin: number;
  ageMax: number;
  gender: Gender;
  interests: string[];
};

/** An ad set's audience: the targeting, plus warm audiences and automation. */
export type AdSetAudience = Audience & {
  /** Let the platform look beyond the targeting for people likely to act. */
  advantage: boolean;
  /** Warm audiences to include (narrows to them). */
  custom: CustomAudience[];
  /** Lookalike of the customer list: 0 (none), 1, 3 or 5 %. */
  lookalike: number;
  /** Leave out people who already bought. */
  excludeCustomers: boolean;
};

/** One ad: the platform tests the ads in an ad set and favours the best. */
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
  /** Switched off: kept, but not published. */
  paused?: boolean;
};

export type Budget = { type: BudgetType; amount: number };

export type AdSet = {
  id: string;
  name: string;
  /** Conversion location ("" for awareness, which has none). */
  destination: Destination | null;
  performanceGoal: PerformanceGoal;
  /** Used with ad set budgets (not with a campaign budget). */
  budget: Budget;
  /** How long the ad set runs, in days. */
  days: number;
  /** Used with ad set budgets (a campaign budget sets one strategy for all). */
  bidStrategy: BidStrategy;
  bidAmount: number | null;
  audience: AdSetAudience;
  placementMode: PlacementMode;
  /** Manual placements (ignored when automatic). */
  placements: Placement[];
  ads: Creative[];
  /** Switched off: kept, but not published. */
  paused?: boolean;
};

export type Campaign = {
  name: string;
  objective: Objective;
  specialCategory: SpecialCategory;
  /** CAMPAIGN: one budget shared by the ad sets ("campaign budget"); AD_SET: each has its own. */
  budgetMode: BudgetMode;
  budget: Budget;
  bidStrategy: BidStrategy;
  bidAmount: number | null;
  /** Split-test the ad sets against each other (even budget, no audience overlap). */
  abTest: boolean;
  adSets: AdSet[];
};

export const MAX_AD_SETS = 5;
export const MAX_CREATIVES = 5;
export const MAX_TOTAL_ADS = 12;
export const MAX_CARDS = 5;
export const MIN_DAILY_BUDGET = 1000;

export type GoalTarget = { metric: GoalMetric; value: number };

/** What the admin sets for an exercise. */
export type AdsConfig = {
  business: { name: string; description: string };
  product: { name: string; description: string; price: number };
  /** The event that counts as a conversion (a sale or a lead). */
  conversionEvent: "SALES" | "LEADS";
  /** A special ad category the business falls in (ads are rejected without it). */
  specialCategory: SpecialCategory;
  /** Whether the business has an app (for app promotion). */
  hasApp: boolean;
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
  specialCategory: "NONE",
  hasApp: false,
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

const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** A new empty ad; `index` names it Ad A, Ad B… */
export function blankCreative(index: number, format: AdFormat = "IMAGE"): Creative {
  return {
    id: randomId(`ad${index + 1}`),
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

export const BLANK_AUDIENCE: AdSetAudience = {
  locations: [],
  ageMin: 18,
  ageMax: 65,
  gender: "ALL",
  interests: [],
  advantage: false,
  custom: [],
  lookalike: 0,
  excludeCustomers: false,
};

/** The default performance goal and conversion location for an objective. */
export function defaultsFor(objective: Objective): { destination: Destination | null; performanceGoal: PerformanceGoal } {
  const destination = OBJECTIVE_DESTINATIONS[objective][0] ?? null;
  return { destination, performanceGoal: goalsFor(objective, destination)[0] };
}

/** A new ad set; `index` names it Ad set 1, 2… */
export function blankAdSet(index: number, objective: Objective = "TRAFFIC"): AdSet {
  return {
    id: randomId(`set${index + 1}`),
    name: `Ad set ${index + 1}`,
    ...defaultsFor(objective),
    budget: { type: "DAILY", amount: 5000 },
    days: 7,
    bidStrategy: "HIGHEST_VOLUME",
    bidAmount: null,
    audience: { ...BLANK_AUDIENCE },
    placementMode: "AUTO",
    placements: ["FEEDS", "STORIES", "REELS"],
    ads: [blankCreative(0)],
  };
}

export const BLANK_CAMPAIGN: Campaign = {
  name: "My first campaign",
  objective: "TRAFFIC",
  specialCategory: "NONE",
  budgetMode: "AD_SET",
  budget: { type: "DAILY", amount: 5000 },
  bidStrategy: "HIGHEST_VOLUME",
  bidAmount: null,
  abTest: false,
  adSets: [
    {
      ...blankAdSet(0),
      id: "set1",
      ads: [{ ...blankCreative(0), id: "ad1" }],
    },
  ],
};

/**
 * The campaign with a new objective: ad sets keep their conversion location
 * and performance goal when they still fit, or get the objective's default.
 */
export function withObjective(campaign: Campaign, objective: Objective): Campaign {
  const allowed = OBJECTIVE_DESTINATIONS[objective];
  return {
    ...campaign,
    objective,
    // A ROAS goal is for sales only.
    ...(campaign.bidStrategy === "ROAS_GOAL" && objective !== "SALES" ? { bidStrategy: "HIGHEST_VOLUME" as const, bidAmount: null } : {}),
    adSets: campaign.adSets.map((set) => {
      const destination = !allowed.length ? null : set.destination && allowed.includes(set.destination) ? set.destination : allowed[0];
      const goals = goalsFor(objective, destination);
      return {
        ...set,
        destination,
        performanceGoal: goals.includes(set.performanceGoal) ? set.performanceGoal : goals[0],
        ...(set.bidStrategy === "ROAS_GOAL" && objective !== "SALES" ? { bidStrategy: "HIGHEST_VOLUME" as const, bidAmount: null } : {}),
      };
    }),
  };
}

/** A copy of an ad with a new id (and name). */
export function copyAd(ad: Creative, index: number): Creative {
  const fresh = blankCreative(index, ad.format);
  return { ...ad, id: fresh.id, name: fresh.name, cards: ad.cards.map((card) => ({ ...card })) };
}

/** A copy of an ad set and its ads, with new ids. */
export function copyAdSet(set: AdSet, index: number): AdSet {
  return {
    ...set,
    id: randomId(`set${index + 1}`),
    name: `${set.name} copy`.slice(0, 60),
    budget: { ...set.budget },
    audience: { ...set.audience, locations: [...set.audience.locations], interests: [...set.audience.interests], custom: [...set.audience.custom] },
    placements: [...set.placements],
    ads: set.ads.map((ad, i) => ({ ...copyAd(ad, i), name: ad.name })),
  };
}

/** Every ad in the campaign, across its ad sets. */
export function allAds(campaign: Campaign) {
  return campaign.adSets.flatMap((set) => set.ads);
}

/** Every image a campaign uses. */
export function campaignMedia(campaign: Campaign) {
  return allAds(campaign).flatMap((creative) =>
    [creative.image, ...creative.cards.map((card) => card.image)].filter(Boolean),
  );
}

/** The campaign with images that aren't `userId`'s removed (they can't use others'). */
export function keepOwnMedia(campaign: Campaign, userId: string): Campaign {
  const own = (ref: string) => (ref && mediaOwner(ref) === userId ? ref : "");
  return {
    ...campaign,
    adSets: campaign.adSets.map((set) => ({
      ...set,
      ads: set.ads.map((creative) => ({
        ...creative,
        image: own(creative.image),
        cards: creative.cards.map((card) => ({ ...card, image: own(card.image) })),
      })),
    })),
  };
}

/** Planned spend for an ad set (its own budget). */
export function adSetPlannedSpend(set: Pick<AdSet, "budget" | "days">) {
  return set.budget.type === "DAILY" ? set.budget.amount * set.days : set.budget.amount;
}

/** How many days the campaign runs (its longest ad set). */
export function campaignDays(campaign: Campaign) {
  return Math.max(1, ...campaign.adSets.map((set) => set.days));
}

/** The most the campaign can spend. */
export function plannedSpend(campaign: Campaign) {
  if (campaign.budgetMode === "CAMPAIGN")
    return campaign.budget.type === "DAILY" ? campaign.budget.amount * campaignDays(campaign) : campaign.budget.amount;
  return campaign.adSets.reduce((sum, set) => sum + adSetPlannedSpend(set), 0);
}

// ---------------------------------------------------------------------------
// Validation and parsing
// ---------------------------------------------------------------------------

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T) =>
  options.includes(value as T) ? (value as T) : fallback;
const obj = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const locationIds = LOCATIONS.map((location) => location.id);
const safeId = (value: unknown, fallback: string) =>
  typeof value === "string" && /^[\w-]{1,40}$/.test(value) ? value : fallback;

function parseBaseAudience(raw: Record<string, unknown>, fallback: Audience): Audience {
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
            raw.interests.filter((item): item is string => (INTERESTS as readonly string[]).includes(item as string)),
          ),
        ].slice(0, 10)
      : fallback.interests,
  };
}

function parseAudience(raw: Record<string, unknown>): AdSetAudience {
  return {
    ...parseBaseAudience(raw, BLANK_AUDIENCE),
    advantage: raw.advantage === true,
    custom: Array.isArray(raw.custom)
      ? [...new Set(raw.custom.filter((id): id is CustomAudience => Object.keys(CUSTOM_AUDIENCES).includes(id as string)))]
      : [],
    lookalike: [0, 1, 3, 5].includes(Number(raw.lookalike)) ? Number(raw.lookalike) : 0,
    excludeCustomers: raw.excludeCustomers === true,
  };
}

const imageRef = (value: unknown) => (isMediaRef(value) ? value : "");

function parseCreative(value: unknown, index: number): Creative {
  const raw = obj(value);
  const format = oneOf(raw.format, Object.keys(FORMATS) as AdFormat[], "IMAGE");
  const cards = Array.isArray(raw.cards)
    ? raw.cards.slice(0, MAX_CARDS).map((card) => {
        const c = obj(card);
        return { image: imageRef(c.image), headline: text(c.headline, 60) };
      })
    : [];
  const blank = blankCreative(index, format);
  return {
    id: safeId(raw.id, blank.id),
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
    ...(raw.paused === true ? { paused: true } : {}),
  };
}

function parseBudget(value: unknown, fallback: Budget): Budget {
  const raw = obj(value);
  return {
    type: oneOf(raw.type, ["DAILY", "LIFETIME"] as const, fallback.type),
    amount: clampInt(raw.amount, 0, 100_000_000, fallback.amount),
  };
}

function parseBid(strategy: unknown, amount: unknown, objective: Objective) {
  let bidStrategy = oneOf(strategy, Object.keys(BID_STRATEGIES) as BidStrategy[], "HIGHEST_VOLUME");
  if (bidStrategy === "ROAS_GOAL" && objective !== "SALES") bidStrategy = "HIGHEST_VOLUME";
  const bidAmount =
    bidStrategy === "HIGHEST_VOLUME"
      ? null
      : bidStrategy === "ROAS_GOAL"
        ? Math.min(20, Math.max(0.1, Math.round((Number(amount) || 1.5) * 10) / 10))
        : clampInt(amount, 1, 10_000_000, 1000);
  return { bidStrategy, bidAmount };
}

function parseAdSet(value: unknown, index: number, objective: Objective): AdSet {
  const raw = obj(value);
  const blank = blankAdSet(index, objective);
  const allowed = OBJECTIVE_DESTINATIONS[objective];
  const destination = allowed.length
    ? oneOf(raw.destination, allowed, allowed[0])
    : null;
  const goals = goalsFor(objective, destination);
  const placements = Array.isArray(raw.placements)
    ? [...new Set(raw.placements.filter((p): p is Placement => Object.keys(PLACEMENTS).includes(p as string)))]
    : blank.placements;
  const ads = Array.isArray(raw.ads) ? raw.ads.slice(0, MAX_CREATIVES).map(parseCreative) : [];
  return {
    id: safeId(raw.id, blank.id),
    name: text(raw.name, 60) || blank.name,
    destination,
    performanceGoal: oneOf(raw.performanceGoal, goals, goals[0]),
    budget: parseBudget(raw.budget, blank.budget),
    days: clampInt(raw.days, 1, 30, 7),
    ...parseBid(raw.bidStrategy, raw.bidAmount, objective),
    audience: parseAudience(obj(raw.audience)),
    placementMode: oneOf(raw.placementMode, ["AUTO", "MANUAL"] as const, "AUTO"),
    placements: placements.length ? placements : ["FEEDS"],
    ads: ads.length ? ads : [blankCreative(0)],
    ...(raw.paused === true ? { paused: true } : {}),
  };
}

/** The campaign as published: ad sets and ads that are switched on. */
export function liveCampaign(campaign: Campaign): Campaign {
  return {
    ...campaign,
    adSets: campaign.adSets.filter((set) => !set.paused).map((set) => ({ ...set, ads: set.ads.filter((ad) => !ad.paused) })),
  };
}

/** Campaigns saved before ad sets: one ad set holding everything. */
function fromVersionOne(raw: Record<string, unknown>): Record<string, unknown> {
  const placements = Array.isArray(raw.placements)
    ? raw.placements.map((p) => (p === "FEED" ? "FEEDS" : p))
    : undefined;
  const bidding = { LOWEST_COST: "HIGHEST_VOLUME", COST_CAP: "COST_PER_RESULT", BID_CAP: "BID_CAP" }[String(raw.bidding)];
  // Before multiple ads, one ad's fields sat on the campaign.
  const ads = Array.isArray(raw.creatives) ? raw.creatives : [{ ...raw, id: "ad1", name: "Ad A" }];
  return {
    name: raw.name,
    objective: raw.objective,
    budgetMode: "AD_SET",
    adSets: [
      {
        id: "set1",
        name: "Ad set 1",
        destination: raw.destination,
        budget: { type: "DAILY", amount: raw.dailyBudget },
        days: raw.days,
        bidStrategy: bidding,
        bidAmount: raw.bidAmount,
        audience: { locations: raw.locations, ageMin: raw.ageMin, ageMax: raw.ageMax, gender: raw.gender, interests: raw.interests },
        placementMode: "MANUAL",
        placements,
        ads,
      },
    ],
  };
}

/** A campaign from untrusted input, with safe defaults. */
export function parseCampaign(value: unknown): Campaign {
  let raw = obj(value);
  if (!Array.isArray(raw.adSets)) raw = fromVersionOne(raw);
  const objective = oneOf(raw.objective, Object.keys(OBJECTIVES) as Objective[], "TRAFFIC");
  const adSets = (raw.adSets as unknown[]).slice(0, MAX_AD_SETS).map((set, i) => parseAdSet(set, i, objective));
  // Ids must be unique (they key results and the AI's ratings).
  const ids = new Set<string>();
  const unique = (id: string) => {
    let next = id;
    while (ids.has(next)) next = `${id}-${ids.size}`;
    ids.add(next);
    return next;
  };
  for (const set of adSets) {
    set.id = unique(set.id);
    for (const ad of set.ads) ad.id = unique(ad.id);
  }
  return {
    name: text(raw.name, 80) || "Untitled campaign",
    objective,
    specialCategory: oneOf(raw.specialCategory, Object.keys(SPECIAL_CATEGORIES) as SpecialCategory[], "NONE"),
    budgetMode: oneOf(raw.budgetMode, ["CAMPAIGN", "AD_SET"] as const, "AD_SET"),
    budget: parseBudget(raw.budget, BLANK_CAMPAIGN.budget),
    ...parseBid(raw.bidStrategy, raw.bidAmount, objective),
    abTest: raw.abTest === true && adSets.length >= 2,
    adSets: adSets.length ? adSets : [blankAdSet(0, objective)],
  };
}

/** Problems that stop a campaign from being published (shown to the intern). */
export function campaignProblems(
  campaign: Campaign,
  config: Pick<AdsConfig, "maxTotalBudget"> & Partial<Pick<AdsConfig, "hasApp">>,
) {
  const problems: string[] = [];
  // Only what's switched on is published (and checked).
  const offSets = campaign.adSets.filter((set) => !set.paused && set.ads.every((ad) => ad.paused));
  for (const set of offSets) problems.push(`${set.name}: switch on at least one ad.`);
  campaign = liveCampaign(campaign);
  if (!campaign.adSets.length) return ["Switch on at least one ad set."];
  const total = plannedSpend(campaign);
  const days = campaignDays(campaign);
  const dailyEquivalent = (budget: Budget, length: number) => (budget.type === "DAILY" ? budget.amount : budget.amount / length);

  if (campaign.budgetMode === "CAMPAIGN") {
    if (campaign.abTest) problems.push("An A/B test gives each ad set its own budget: switch to ad set budgets.");
    if (dailyEquivalent(campaign.budget, days) < MIN_DAILY_BUDGET * campaign.adSets.length)
      problems.push(
        `A campaign budget needs at least ₦${MIN_DAILY_BUDGET.toLocaleString("en-NG")} a day for each ad set (₦${(MIN_DAILY_BUDGET * campaign.adSets.length).toLocaleString("en-NG")} a day for ${campaign.adSets.length}).`,
      );
  }
  if (total > config.maxTotalBudget)
    problems.push(
      `Your total budget (₦${total.toLocaleString("en-NG")}) is over this exercise's limit of ₦${config.maxTotalBudget.toLocaleString("en-NG")}.`,
    );
  if (allAds(campaign).length > MAX_TOTAL_ADS) problems.push(`Use at most ${MAX_TOTAL_ADS} ads in one campaign.`);
  if (campaign.abTest && campaign.adSets.length < 2) problems.push("An A/B test needs at least 2 ad sets to compare.");

  const special = campaign.specialCategory !== "NONE";
  for (const set of campaign.adSets) {
    const where = campaign.adSets.length > 1 ? `${set.name}: ` : "";
    if (campaign.budgetMode === "AD_SET" && dailyEquivalent(set.budget, set.days) < MIN_DAILY_BUDGET)
      problems.push(`${where}set a budget of at least ₦${MIN_DAILY_BUDGET.toLocaleString("en-NG")} a day.`);
    const a = set.audience;
    if (!a.locations.length) problems.push(`${where}choose at least one location.`);
    if (set.placementMode === "MANUAL" && !set.placements.length) problems.push(`${where}choose at least one placement.`);
    if ((set.destination === "APP" || campaign.objective === "APP_PROMOTION") && config.hasApp === false)
      problems.push(`${where}this business has no app; choose another conversion location or objective.`);
    if (set.performanceGoal === "VIDEO_VIEWS" && !set.ads.some((ad) => ad.format === "VIDEO"))
      problems.push(`${where}video views need at least one video ad.`);
    if (special) {
      if (a.ageMin !== 18 || a.ageMax !== 65)
        problems.push(`${where}special ad categories must target ages 18–65+.`);
      if (a.gender !== "ALL") problems.push(`${where}special ad categories can't target by gender.`);
      if (a.lookalike) problems.push(`${where}special ad categories can't use lookalike audiences.`);
      if (a.interests.length) problems.push(`${where}special ad categories can't use detailed targeting (interests).`);
    }
    if (a.custom.includes("CUSTOMERS") && a.excludeCustomers)
      problems.push(`${where}you can't include and exclude past customers at once.`);
    for (const ad of set.ads) {
      const name = `${where}${ad.name}`;
      if (!ad.primaryText) problems.push(`${name}: write the primary text.`);
      if (ad.format === "CAROUSEL") {
        if (ad.cards.length < 2) problems.push(`${name}: a carousel needs at least 2 cards.`);
        if (ad.cards.some((card) => !card.headline)) problems.push(`${name}: give every card a headline.`);
      } else {
        if (!ad.headline) problems.push(`${name}: write a headline.`);
        if (!ad.image && ad.visual.length < 10)
          problems.push(`${name}: add ${ad.format === "VIDEO" ? "a cover image" : "an image"} or describe it.`);
      }
      if (ad.format === "VIDEO" && ad.script.length < 20)
        problems.push(`${name}: write the video's script (what happens, scene by scene).`);
    }
  }
  return problems;
}

/** Exercise settings from untrusted (admin) input. */
export function parseAdsConfig(value: unknown): AdsConfig {
  const raw = obj(value);
  const business = obj(raw.business);
  const product = obj(raw.product);
  const benchmarks = obj(raw.benchmarks);
  const goals = Array.isArray(raw.goals)
    ? raw.goals
        .filter(
          (goal): goal is { metric: GoalMetric; value: unknown } =>
            Boolean(goal) && Object.keys(GOAL_METRICS).includes((goal as { metric?: string }).metric ?? ""),
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
    specialCategory: oneOf(raw.specialCategory, Object.keys(SPECIAL_CATEGORIES) as SpecialCategory[], "NONE"),
    hasApp: raw.hasApp === true,
    idealAudience: parseBaseAudience(obj(raw.idealAudience), DEFAULT_ADS_CONFIG.idealAudience),
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

/**
 * What interns may see of an exercise: no ideal audience or prices. Whether
 * the business needs a special ad category is for them to work out.
 */
export function publicAdsConfig(config: AdsConfig) {
  return {
    business: config.business,
    product: config.product,
    conversionEvent: config.conversionEvent,
    hasApp: config.hasApp,
    goals: config.goals,
    maxRuns: config.maxRuns,
    maxTotalBudget: config.maxTotalBudget,
  };
}
export type PublicAdsConfig = ReturnType<typeof publicAdsConfig>;

// ---------------------------------------------------------------------------
// Audience sizes
// ---------------------------------------------------------------------------

const AGE_BANDS = [
  { key: "18-24", min: 18, max: 24 },
  { key: "25-34", min: 25, max: 34 },
  { key: "35-44", min: 35, max: 44 },
  { key: "45-54", min: 45, max: 54 },
  { key: "55-64", min: 55, max: 64 },
  { key: "65+", min: 65, max: 65 },
] as const;

// Nigeria's online audience skews young.
const ageWeight = (age: number) => (age < 35 ? 1.4 : age < 50 ? 1 : 0.45);

function ageShare(ageMin: number, ageMax: number) {
  let inRange = 0;
  let all = 0;
  for (let age = 18; age <= 65; age++) {
    all += ageWeight(age);
    if (age >= ageMin && age <= ageMax) inRange += ageWeight(age);
  }
  return all ? inRange / all : 0;
}

/** People on social media in the chosen locations. */
function locationPool(locations: string[]) {
  return (
    LOCATIONS.filter((location) => locations.includes(location.id)).reduce((sum, location) => sum + location.online, 0) * 1000
  );
}

/** Estimated people who match the targeting (age, gender, interests). */
export function audienceSize(audience: Audience) {
  const gender = audience.gender === "ALL" ? 1 : 0.5;
  // Interests widen within the pool (people matching any of them).
  const interests = audience.interests.length ? 1 - Math.pow(0.88, audience.interests.length) : 1;
  return Math.round(locationPool(audience.locations) * ageShare(audience.ageMin, audience.ageMax) * gender * interests);
}

/** Estimated size of an ad set's audience, with warm audiences and automation. */
export function adSetAudienceSize(audience: AdSetAudience) {
  const pool = locationPool(audience.locations);
  const demographic = ageShare(audience.ageMin, audience.ageMax) * (audience.gender === "ALL" ? 1 : 0.5);
  let size: number;
  if (audience.custom.length) {
    // Warm audiences replace the cold targeting (only these people).
    size = audience.custom.reduce((sum, id) => sum + CUSTOM_AUDIENCES[id].size, 0) * Math.max(0.3, demographic);
    if (audience.lookalike) size += pool * (audience.lookalike / 100) * demographic;
  } else if (audience.lookalike) {
    size = pool * (audience.lookalike / 100) * demographic;
  } else {
    size = audienceSize(audience);
    // Automatic audiences search the whole location for likely buyers.
    if (audience.advantage) size = Math.max(size, pool * demographic * 0.8);
  }
  if (audience.excludeCustomers) size -= CUSTOM_AUDIENCES.CUSTOMERS.size * 0.6;
  return Math.max(0, Math.round(size));
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** How well the plan fits, 0–1, from the AI judge (or the rules fallback). */
export type Ratings = {
  /** The audiences overall (average of `adSets`). */
  audienceFit: number;
  /** The ads' quality overall (average of `creatives`). */
  creative: number;
  objectiveFit: number;
  source: "ai" | "rules";
  /** Each ad's quality, 0–1. */
  creatives?: Array<{ id: string; quality: number }>;
  /** Each ad set's audience fit, 0–1. */
  adSets?: Array<{ id: string; audienceFit: number }>;
};

/** Spend, delivery and results, shared by every level and breakdown row. */
export type Metrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  /** The performance goal's result (reach, clicks, leads…). */
  results: number;
};

export type BreakdownRow = Metrics & { key: string; label: string };

export type Breakdowns = {
  age: BreakdownRow[];
  gender: BreakdownRow[];
  placement: BreakdownRow[];
  day: BreakdownRow[];
};

/** How one ad did within its ad set. */
export type CreativeResult = Metrics & {
  id: string;
  name: string;
  format: AdFormat;
  adSetId?: string;
  /** Share of its ad set's budget the platform gave it, 0–1. */
  share: number;
  quality: number;
  ctr: number;
  costPerConversion: number;
};

export type Delivery = "COMPLETED" | "LEARNING_LIMITED" | "NOT_DELIVERING" | "REJECTED";

export const DELIVERY: Record<Delivery, { label: string; help: string }> = {
  COMPLETED: { label: "Completed", help: "Ran its full schedule." },
  LEARNING_LIMITED: {
    label: "Learning limited",
    help: "Didn't get enough results (about 50 a week) for the system to learn who responds, so it stayed less efficient.",
  },
  NOT_DELIVERING: { label: "Not delivering", help: "Spent little or nothing: check the bid strategy, budget and audience." },
  REJECTED: { label: "Rejected", help: "The ads weren't approved." },
};

export type AdSetResult = Metrics & {
  id: string;
  name: string;
  delivery: Delivery;
  plannedBudget: number;
  audienceSize: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerConversion: number;
  revenue: number;
  roas: number;
  resultLabel: string;
  costPerResult: number;
  ads: CreativeResult[];
  breakdowns: Breakdowns;
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
  /** The campaign's results (when every ad set counts the same thing). */
  results?: number;
  resultLabel?: string;
  costPerResult?: number;
};

export type GoalResult = { metric: GoalMetric; label: string; target: number; actual: number; met: boolean };

export type AbTestResult = {
  winnerId: string | null;
  /** 0–1: how sure we are the winner really is better. */
  confidence: number;
  /** What was compared (cost per result). */
  metric: string;
  summary: string;
};

export type RunResult = {
  /** 2 for campaigns with ad sets (missing on older runs). */
  version?: 2;
  delivery?: Delivery;
  totals: RunTotals;
  daily: Array<{ day: number; spend: number; impressions: number; clicks: number; conversions: number }>;
  ratings: Ratings;
  goals: GoalResult[];
  /** 0–100: how close the run came to every goal. */
  score: number;
  notes: string[];
  /** Every ad (flattened across ad sets). */
  creatives?: CreativeResult[];
  adSets?: AdSetResult[];
  breakdowns?: Breakdowns;
  abTest?: AbTestResult;
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

/** Conversion efficiency when optimizing for `chosen` but measuring `wanted`. */
export function objectiveFitFor(chosen: Objective, wanted: "SALES" | "LEADS") {
  if (chosen === wanted) return 1;
  if (chosen === "SALES" || chosen === "LEADS") return 0.7;
  if (chosen === "ENGAGEMENT") return 0.45;
  if (chosen === "TRAFFIC") return 0.5;
  return chosen === "APP_PROMOTION" ? 0.2 : 0.25;
}

/** How well a performance goal serves the business's real conversion. */
function goalFit(goal: PerformanceGoal, destination: Destination | null, wanted: "SALES" | "LEADS") {
  if ((goal === "CONVERSIONS" || goal === "CONVERSION_VALUE") && wanted === "SALES") return 1;
  if (goal === "LEADS" && wanted === "LEADS") return destination === "INSTANT_FORM" ? 0.9 : 1;
  // Chats sell well in Nigeria.
  if (goal === "CONVERSATIONS") return 0.92;
  if (goal === "LANDING_PAGE_VIEWS") return 0.65;
  if (goal === "LINK_CLICKS") return 0.55;
  if (goal === "CONVERSIONS" || goal === "LEADS") return 0.75;
  return 0.35;
}

/** How well each format suits each placement (a CTR multiplier). */
const FORMAT_FIT: Record<AdFormat, Record<Placement, number>> = {
  IMAGE: { FEEDS: 1, STORIES: 0.9, REELS: 0.8, IN_STREAM: 0.6, SEARCH: 1, MESSAGES: 1, PARTNER_APPS: 1 },
  VIDEO: { FEEDS: 1.05, STORIES: 1.12, REELS: 1.2, IN_STREAM: 1.2, SEARCH: 0.9, MESSAGES: 0.9, PARTNER_APPS: 0.9 },
  CAROUSEL: { FEEDS: 1.1, STORIES: 0.85, REELS: 0.75, IN_STREAM: 0.6, SEARCH: 1.05, MESSAGES: 1, PARTNER_APPS: 0.95 },
};

/** The placements an ad set actually uses. */
export function activePlacements(set: Pick<AdSet, "placementMode" | "placements">): Placement[] {
  return set.placementMode === "AUTO" ? ADVANTAGE_PLACEMENTS : set.placements.length ? set.placements : ["FEEDS"];
}

/** 0–1: how many of the same people two audiences reach. */
export function audienceOverlap(a: AdSetAudience, b: AdSetAudience) {
  const shared = a.locations.filter((id) => b.locations.includes(id));
  if (!shared.length) return 0;
  const locationShare = locationPool(shared) / Math.max(1, Math.min(locationPool(a.locations), locationPool(b.locations)));
  const ageOverlap =
    Math.max(0, Math.min(a.ageMax, b.ageMax) - Math.max(a.ageMin, b.ageMin) + 1) /
    Math.max(1, Math.min(a.ageMax - a.ageMin, b.ageMax - b.ageMin) + 1);
  const gender = a.gender === "ALL" || b.gender === "ALL" || a.gender === b.gender ? 1 : 0;
  const warm = (x: AdSetAudience) => x.custom.length > 0 || x.lookalike > 0;
  const interests =
    a.advantage || b.advantage
      ? 0.8
      : warm(a) !== warm(b)
        ? 0.3
        : !a.interests.length && !b.interests.length
          ? 1
          : !a.interests.length || !b.interests.length
            ? 0.7
            : a.interests.filter((i) => b.interests.includes(i)).length /
            Math.max(1, new Set([...a.interests, ...b.interests]).size);
  return Math.max(0, Math.min(1, locationShare * ageOverlap * gender * (0.3 + 0.7 * interests)));
}

const zero = (): Metrics => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0 });
const addInto = (target: Metrics, source: Metrics) => {
  target.spend += source.spend;
  target.impressions += source.impressions;
  target.reach += source.reach;
  target.clicks += source.clicks;
  target.conversions += source.conversions;
  target.results += source.results;
};
const roundMetrics = <T extends Metrics>(m: T): T => ({
  ...m,
  spend: Math.round(m.spend),
  impressions: Math.round(m.impressions),
  reach: Math.round(m.reach),
  clicks: Math.round(m.clicks),
  conversions: Math.round(m.conversions * 10) / 10,
  results: Math.round(m.results),
});

/** Splits `total` metrics across rows by weights (impressions, clicks, conversions). */
function split(
  total: Metrics,
  rows: Array<{ key: string; label: string; views: number; clicks: number; converts: number }>,
): BreakdownRow[] {
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0) || 1;
  const views = sum((r) => r.views);
  const clicks = sum((r) => r.clicks);
  const converts = sum((r) => r.converts);
  return rows.map((row) =>
    roundMetrics({
      key: row.key,
      label: row.label,
      spend: (total.spend * row.views) / views,
      impressions: (total.impressions * row.views) / views,
      reach: (total.reach * row.views) / views,
      clicks: (total.clicks * row.clicks) / clicks,
      conversions: (total.conversions * row.converts) / converts,
      results: (total.results * (row.clicks + row.converts)) / (clicks + converts),
    }),
  );
}

type AdSetPlan = {
  set: AdSet;
  /** ₦ the ad set can spend. */
  budget: number;
  bidStrategy: BidStrategy;
  bidAmount: number | null;
  /** Extra price from competing with the campaign's other ad sets. */
  overlapCpm: number;
};

function simulateAdSet(
  plan: AdSetPlan,
  campaign: Campaign,
  config: AdsConfig,
  ratings: Ratings,
  random: () => number,
  notes: string[],
): AdSetResult {
  const { set } = plan;
  const noise = (spread: number) => 1 + (random() * 2 - 1) * spread;
  const named = (text: string) => (campaign.adSets.length > 1 ? `${set.name}: ${text}` : text);
  const goal = PERFORMANCE_GOALS[set.performanceGoal];
  const objective = OBJECTIVES[campaign.objective];
  const audience = set.audience;
  const size = Math.max(500, adSetAudienceSize(audience));
  const placements = activePlacements(set);
  const avg = (pick: (p: Placement) => number) => placements.reduce((s, p) => s + pick(p), 0) / placements.length;
  const destination = set.destination ? DESTINATIONS[set.destination] : DESTINATIONS.ON_AD;
  const audienceFit = ratings.adSets?.find((r) => r.id === set.id)?.audienceFit ?? ratings.audienceFit;

  // Warm audiences: these people know the business already.
  const warm = audience.custom.reduce(
    (best, id) => ({ ctr: Math.max(best.ctr, CUSTOM_AUDIENCES[id].ctr), cvr: Math.max(best.cvr, CUSTOM_AUDIENCES[id].cvr) }),
    { ctr: 1, cvr: 1 },
  );
  const lookalikeLift = audience.lookalike ? 1 + (LOOKALIKES[audience.lookalike]?.fit ?? 0.6) * 0.35 : 1;

  // Price of 1,000 views: placements (automatic placements find cheaper
  // views), objective and goal, how narrow the audience is, overlap.
  const narrow = size < 50_000 ? 1.6 : size < 200_000 ? 1.3 : size < 1_000_000 ? 1.1 : 1;
  let cpm =
    config.benchmarks.cpm *
    avg((p) => PLACEMENTS[p].cpm) *
    (set.placementMode === "AUTO" ? 0.9 : 1) *
    objective.cpm *
    goal.cpm *
    narrow *
    plan.overlapCpm *
    noise(0.08);
  if (narrow > 1.2)
    notes.push(named("the audience is small, so views cost more and the same people see the ads repeatedly."));

  // The ads: each one's strength is its quality and how well its format
  // suits the placements. The platform spends part of the budget testing
  // every ad, then gives the rest mostly to the strongest.
  const ads = set.ads;
  const strength = ads.map((ad) => {
    const quality = ratings.creatives?.find((r) => r.id === ad.id)?.quality ?? ratings.creative;
    const fit = avg((p) => FORMAT_FIT[ad.format][p]);
    return { quality, value: Math.max(0.02, Math.min(1, quality * fit)) };
  });
  const dailyBudget = plan.budget / set.days;
  const perAdDaily = dailyBudget / ads.length;
  const tooThin = ads.length > 1 && perAdDaily < 1500;
  const explore = ads.length === 1 ? 0 : Math.min(0.6, 0.1 * ads.length * (tooThin ? 1.6 : 1));
  const weight = strength.map((s) => s.value ** 3);
  const weightSum = weight.reduce((a, b) => a + b, 0) || 1;
  const shares = weight.map((w) => explore / ads.length + (1 - explore) * (w / weightSum));
  const creativeQuality = shares.reduce((sum, share, i) => sum + share * strength[i].value, 0);
  const creativeMult = (0.45 + 1.1 * creativeQuality) * (tooThin ? 0.92 : 1);
  if (tooThin)
    notes.push(
      named(
        `each of the ${ads.length} ads got about ₦${Math.round(perAdDaily).toLocaleString("en-NG")} a day: too little for the system to learn which works. Use fewer ads or a bigger budget.`,
      ),
    );
  else if (ads.length > 1) {
    const best = shares.indexOf(Math.max(...shares));
    if (Math.max(...shares) - Math.min(...shares) < 0.05)
      notes.push(named(`the ${ads.length} ads performed about the same, so the budget was split evenly. Make them more different to learn what works.`));
    else notes.push(named(`${ads[best].name} got ${Math.round(shares[best] * 100)}% of the budget because it performed best.`));
  }

  const audienceMult = 0.4 + 1.2 * Math.max(audienceFit, audience.advantage ? 0.55 : 0);
  const objectiveMult = Math.max(
    0.2,
    Math.min(
      1.05,
      (ratings.objectiveFit + objectiveFitFor(campaign.objective, config.conversionEvent) + goalFit(set.performanceGoal, set.destination, config.conversionEvent)) / 3,
    ),
  );

  // Bidding: caps that are too low leave budget unspent.
  let spendShare = 0.97 + random() * 0.03;
  if (plan.bidStrategy === "BID_CAP" && plan.bidAmount) {
    const ratio = plan.bidAmount / cpm;
    spendShare *= Math.min(1, Math.max(0.05, ratio ** 2));
    if (ratio < 1) notes.push(named("the bid cap was below the going price, so it couldn't spend its budget."));
    cpm = Math.min(cpm, plan.bidAmount * 1.05);
  }

  // People seen and how often: reach flattens as the audience is used up.
  let impressions = ((plan.budget * spendShare) / cpm) * 1000;
  const maxImpressions = size * Math.min(12, 1.5 + set.days * 0.7);
  if (impressions > maxImpressions) {
    impressions = maxImpressions;
    notes.push(named("the budget was bigger than the audience could absorb; widen the audience or lower the budget."));
  }
  const reachFor = (views: number) => Math.min(size, Math.round(size * (1 - Math.exp(-views / size))));
  let reach = reachFor(impressions);
  let frequency = reach ? impressions / reach : 0;
  // Rotating several ads keeps them fresh for longer.
  const fatigueStart = 3 + 0.6 * Math.min(3, ads.length - 1);
  const fatigue = frequency > fatigueStart ? 1 / (1 + 0.12 * (frequency - fatigueStart)) : 1;
  if (frequency > fatigueStart + 1)
    notes.push(named(`people saw the ads ${frequency.toFixed(1)} times on average, so they wore out and clicks dropped.`));

  const ctr =
    (config.benchmarks.ctr / 100) *
    creativeMult *
    (0.6 + 0.4 * audienceMult) *
    avg((p) => PLACEMENTS[p].ctr) *
    objective.ctr *
    goal.ctr *
    destination.ctr *
    warm.ctr *
    fatigue *
    noise(0.1);
  let clicks = impressions * ctr;
  let cvr =
    (config.benchmarks.cvr / 100) *
    audienceMult *
    objectiveMult *
    goal.cvr *
    destination.cvr[config.conversionEvent] *
    warm.cvr *
    lookalikeLift *
    noise(0.12);
  // Past customers buy again, but excluding them means only new customers.
  if (audience.excludeCustomers) cvr *= 0.93;
  let conversions = clicks * 0.8 * cvr;
  let spend = (impressions / 1000) * cpm;

  // Goals that cap cost or require a return only buy what they can afford.
  const capBy = (share: number, note: string) => {
    impressions *= share;
    clicks *= share;
    conversions *= share;
    spend *= share;
    reach = reachFor(impressions);
    frequency = reach ? impressions / reach : 0;
    notes.push(named(note));
  };
  if (plan.bidStrategy === "COST_PER_RESULT" && plan.bidAmount && conversions > 0) {
    const costPerResult = spend / conversions;
    if (costPerResult > plan.bidAmount)
      capBy(Math.max(0.05, (plan.bidAmount / costPerResult) ** 2), "the cost per result goal was lower than results really cost, so it under-spent.");
  }
  if (plan.bidStrategy === "ROAS_GOAL" && plan.bidAmount && spend > 0) {
    const roas = (conversions * config.product.price) / spend;
    if (roas < plan.bidAmount)
      capBy(Math.max(0.05, (roas / plan.bidAmount) ** 2), "the ROAS goal was higher than the campaign could achieve, so it spent less.");
  }

  // The learning phase: about 50 results a week, or it stays less efficient.
  const optimizationEvents =
    set.performanceGoal === "CONVERSIONS" || set.performanceGoal === "CONVERSION_VALUE" || set.performanceGoal === "LEADS"
      ? conversions
      : set.performanceGoal === "CONVERSATIONS"
        ? clicks * 0.55
        : set.performanceGoal === "APP_INSTALLS"
          ? clicks * 0.25
          : clicks;
  const weekly = (optimizationEvents / set.days) * 7;
  let delivery: Delivery = "COMPLETED";
  if (weekly < 50) {
    delivery = "LEARNING_LIMITED";
    clicks *= 0.95;
    conversions *= 0.88;
    notes.push(
      named(
        `learning limited: about ${Math.round(weekly)} results a week, short of the ~50 the system needs to learn. Combine ad sets, raise the budget or choose a goal that happens more often.`,
      ),
    );
  }
  if (spend < plan.budget * 0.1) delivery = "NOT_DELIVERING";

  // The performance goal's own result.
  const engagements = impressions * 0.03 * creativeMult;
  const videoShare = ads.some((ad) => ad.format === "VIDEO")
    ? ads.reduce((s, ad, i) => s + (ad.format === "VIDEO" ? shares[i] : 0), 0)
    : 0;
  const results =
    set.performanceGoal === "REACH"
      ? reach
      : set.performanceGoal === "IMPRESSIONS"
        ? impressions
        : set.performanceGoal === "AD_RECALL"
          ? reach * 0.08 * creativeMult
          : set.performanceGoal === "LINK_CLICKS"
            ? clicks
            : set.performanceGoal === "LANDING_PAGE_VIEWS"
              ? clicks * 0.78
              : set.performanceGoal === "POST_ENGAGEMENT"
                ? engagements
                : set.performanceGoal === "VIDEO_VIEWS"
                  ? impressions * 0.12 * videoShare
                  : set.performanceGoal === "CONVERSATIONS"
                    ? clicks * 0.55
                    : set.performanceGoal === "APP_INSTALLS"
                      ? clicks * 0.25
                      : conversions;
  const valueBoost = set.performanceGoal === "CONVERSION_VALUE" ? 1.15 : 1;
  const revenue = conversions * config.product.price * valueBoost;

  const total: Metrics = { spend, impressions, reach, clicks, conversions, results };

  // Per ad: its share of the spend, and clicks by how strong it is.
  const pull = shares.map((share, i) => share * (0.45 + 1.1 * strength[i].value));
  const pullSum = pull.reduce((a, b) => a + b, 0) || 1;
  const adResults: CreativeResult[] = ads.map((ad, i) => {
    const m = roundMetrics({
      spend: spend * shares[i],
      impressions: impressions * shares[i],
      reach: reach * Math.min(1, shares[i] * 1.3),
      clicks: clicks * (pull[i] / pullSum),
      conversions: conversions * (pull[i] / pullSum),
      results: results * (["REACH", "IMPRESSIONS", "AD_RECALL", "VIDEO_VIEWS"].includes(set.performanceGoal) ? shares[i] : pull[i] / pullSum),
    });
    return {
      ...m,
      id: ad.id,
      name: ad.name,
      format: ad.format,
      adSetId: set.id,
      share: Math.round(shares[i] * 1000) / 1000,
      quality: Math.round(strength[i].quality * 100) / 100,
      ctr: Math.round((m.clicks / Math.max(1, m.impressions)) * 10000) / 100,
      costPerConversion: m.conversions >= 1 ? Math.round(m.spend / m.conversions) : 0,
    };
  });

  // Breakdowns: who saw it and where. Ages and genders that match the real
  // buyers respond better.
  const ideal = config.idealAudience;
  const ageRows = AGE_BANDS.filter((band) => band.max >= audience.ageMin && band.min <= audience.ageMax).map((band) => {
    let views = 0;
    for (let age = Math.max(band.min, audience.ageMin); age <= Math.min(band.max, audience.ageMax); age++) views += ageWeight(age);
    const affinity = band.max >= ideal.ageMin && band.min <= ideal.ageMax ? 1.25 : 0.75;
    return { key: band.key, label: band.key, views, clicks: views * affinity, converts: views * affinity * affinity };
  });
  const genderRows = (audience.gender === "ALL" ? (["WOMEN", "MEN"] as const) : [audience.gender]).map((g) => {
    const affinity = ideal.gender === "ALL" ? 1 : ideal.gender === g ? 1.35 : 0.65;
    return { key: g, label: g === "WOMEN" ? "Women" : "Men", views: 1, clicks: affinity, converts: affinity * affinity };
  });
  const placementRows = placements.map((p) => {
    // Cheaper placements get more views; format fit drives clicks.
    const views = (set.placementMode === "AUTO" ? 1 / PLACEMENTS[p].cpm : 1) * (p === "SEARCH" || p === "MESSAGES" ? 0.35 : 1);
    const fit = shares.reduce((s, share, i) => s + share * FORMAT_FIT[ads[i].format][p], 0);
    const clickRate = PLACEMENTS[p].ctr * fit;
    return { key: p, label: PLACEMENTS[p].label, views, clicks: views * clickRate, converts: views * clickRate * (p === "PARTNER_APPS" ? 0.5 : 1) };
  });
  const learning = Array.from({ length: set.days }, (_, i) => (i === 0 ? 0.7 : i === 1 ? 0.82 : i === 2 ? 0.92 : 1));
  const dayRows = learning.map((efficiency, i) => ({ key: String(i + 1), label: `Day ${i + 1}`, views: 1, clicks: efficiency, converts: efficiency }));

  const rounded = roundMetrics(total);
  const roundedConversions = Math.round(rounded.conversions);
  return {
    ...rounded,
    id: set.id,
    name: set.name,
    delivery,
    plannedBudget: Math.round(plan.budget),
    audienceSize: size,
    frequency: Math.round(frequency * 100) / 100,
    ctr: Math.round((rounded.clicks / Math.max(1, rounded.impressions)) * 10000) / 100,
    cpc: Math.round(rounded.spend / Math.max(1, rounded.clicks)),
    cpm: Math.round(rounded.impressions ? (rounded.spend / rounded.impressions) * 1000 : cpm),
    costPerConversion: roundedConversions ? Math.round(rounded.spend / roundedConversions) : 0,
    revenue: Math.round(revenue),
    roas: rounded.spend ? Math.round((revenue / rounded.spend) * 100) / 100 : 0,
    resultLabel: goal.result,
    costPerResult: rounded.results ? Math.round((rounded.spend / rounded.results) * 100) / 100 : 0,
    ads: adResults,
    breakdowns: {
      age: split(total, ageRows),
      gender: split(total, genderRows),
      placement: split(total, placementRows),
      day: split(total, dayRows),
    },
  };
}

/** Adds rows with the same key together (combining ad sets' breakdowns). */
function mergeRows(lists: BreakdownRow[][]): BreakdownRow[] {
  const byKey = new Map<string, BreakdownRow>();
  for (const row of lists.flat()) {
    const existing = byKey.get(row.key);
    if (existing) addInto(existing, row);
    else byKey.set(row.key, { ...row });
  }
  return [...byKey.values()].map(roundMetrics);
}

export function simulateCampaign(input: { campaign: Campaign; config: AdsConfig; ratings: Ratings; seed: string }): RunResult {
  const { config, ratings } = input;
  // What's switched off isn't published.
  const campaign = liveCampaign(input.campaign);
  const random = seededRandom(input.seed);
  const notes: string[] = [];
  const planned = plannedSpend(campaign);
  const days = campaignDays(campaign);

  // Ads for a special-category business that didn't declare it are rejected.
  if (config.specialCategory !== "NONE" && campaign.specialCategory !== config.specialCategory) {
    const label = SPECIAL_CATEGORIES[config.specialCategory].label.toLowerCase();
    return rejected(campaign, config, ratings, planned, days, [
      `Your ads were rejected: this business's ads fall under a special ad category (${label}), which must be declared on the campaign. Those ads also have stricter targeting rules.`,
    ]);
  }

  // Ad sets with overlapping audiences bid against each other (an A/B test
  // splits the audience, so its ad sets don't).
  const overlapCpm = campaign.adSets.map(() => 1);
  if (!campaign.abTest)
    for (let i = 0; i < campaign.adSets.length; i++)
      for (let j = i + 1; j < campaign.adSets.length; j++) {
        const overlap = audienceOverlap(campaign.adSets[i].audience, campaign.adSets[j].audience);
        if (overlap > 0.3) {
          overlapCpm[i] += 0.2 * overlap;
          overlapCpm[j] += 0.2 * overlap;
          notes.push(
            `${campaign.adSets[i].name} and ${campaign.adSets[j].name} target largely the same people (${Math.round(overlap * 100)}% overlap), so they bid against each other and views cost more. Combine them or make the audiences different.`,
          );
        }
      }

  // Budgets: each ad set's own, or the campaign budget shared out by the
  // system towards the ad sets that perform best.
  let budgets: number[];
  if (campaign.budgetMode === "AD_SET") budgets = campaign.adSets.map(adSetPlannedSpend);
  else {
    const strength = campaign.adSets.map((set) => {
      const fit = ratings.adSets?.find((r) => r.id === set.id)?.audienceFit ?? ratings.audienceFit;
      const quality =
        set.ads.reduce((s, ad) => s + (ratings.creatives?.find((r) => r.id === ad.id)?.quality ?? ratings.creative), 0) / set.ads.length;
      return Math.max(0.02, fit * quality) * Math.sqrt(set.days / days);
    });
    const explore = campaign.adSets.length > 1 ? 0.15 : 0;
    const weights = strength.map((s) => s ** 2);
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    budgets = weights.map((w) => planned * (explore / campaign.adSets.length + (1 - explore) * (w / sum)));
    if (campaign.adSets.length > 1) {
      const top = budgets.indexOf(Math.max(...budgets));
      notes.push(
        `With a campaign budget, the system gave ${campaign.adSets[top].name} ${Math.round((budgets[top] / planned) * 100)}% of the money because it was performing best.`,
      );
    }
  }

  const adSets = campaign.adSets.map((set, i) =>
    simulateAdSet(
      {
        set,
        budget: budgets[i],
        bidStrategy: campaign.budgetMode === "CAMPAIGN" ? campaign.bidStrategy : set.bidStrategy,
        bidAmount: campaign.budgetMode === "CAMPAIGN" ? campaign.bidAmount : set.bidAmount,
        overlapCpm: overlapCpm[i],
      },
      campaign,
      config,
      ratings,
      random,
      notes,
    ),
  );

  // Campaign totals. People reached by several ad sets count once.
  const sum = zero();
  for (const set of adSets) addInto(sum, set);
  let reach = sum.reach;
  if (!campaign.abTest && adSets.length > 1) {
    let overlapPeople = 0;
    for (let i = 0; i < adSets.length; i++)
      for (let j = i + 1; j < adSets.length; j++)
        overlapPeople +=
          audienceOverlap(campaign.adSets[i].audience, campaign.adSets[j].audience) * Math.min(adSets[i].reach, adSets[j].reach) * 0.6;
    reach = Math.max(Math.max(...adSets.map((s) => s.reach)), reach - overlapPeople);
  }
  const conversions = Math.round(sum.conversions);
  const revenue = adSets.reduce((s, set) => s + set.revenue, 0);
  const sameGoal = new Set(campaign.adSets.map((set) => set.performanceGoal)).size === 1;
  const totals: RunTotals = {
    plannedBudget: planned,
    spend: Math.round(sum.spend),
    audienceSize: adSets.reduce((s, set) => s + set.audienceSize, 0),
    impressions: Math.round(sum.impressions),
    reach: Math.round(reach),
    frequency: reach ? Math.round((sum.impressions / reach) * 100) / 100 : 0,
    clicks: Math.round(sum.clicks),
    ctr: Math.round((sum.clicks / Math.max(1, sum.impressions)) * 10000) / 100,
    cpc: Math.round(sum.spend / Math.max(1, sum.clicks)),
    cpm: sum.impressions ? Math.round((sum.spend / sum.impressions) * 1000) : 0,
    conversions,
    costPerConversion: conversions ? Math.round(sum.spend / conversions) : 0,
    revenue: Math.round(revenue),
    roas: sum.spend ? Math.round((revenue / sum.spend) * 100) / 100 : 0,
    ...(sameGoal
      ? {
          results: Math.round(sum.results),
          resultLabel: adSets[0].resultLabel,
          costPerResult: sum.results ? Math.round((sum.spend / sum.results) * 100) / 100 : 0,
        }
      : {}),
  };

  // Day by day, across ad sets.
  const dayRows = mergeRows(adSets.map((set) => set.breakdowns.day));
  const daily = dayRows.map((row) => ({
    day: Number(row.key),
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
  }));

  const creatives = adSets.flatMap((set) => set.ads);
  const abTest = campaign.abTest ? judgeAbTest(adSets) : undefined;
  if (abTest) notes.unshift(abTest.summary);

  const goals = config.goals.map((goal) => evaluateGoal(goal, totals));
  const score = goals.length ? Math.round((goals.reduce((s, goal) => s + goalCredit(goal), 0) / goals.length) * 100) : 0;
  return {
    version: 2,
    delivery: adSets.every((set) => set.delivery === "NOT_DELIVERING") ? "NOT_DELIVERING" : "COMPLETED",
    totals,
    daily,
    ratings,
    goals,
    score,
    notes: [...new Set(notes)],
    creatives,
    adSets,
    breakdowns: {
      age: mergeRows(adSets.map((set) => set.breakdowns.age)),
      gender: mergeRows(adSets.map((set) => set.breakdowns.gender)),
      placement: mergeRows(adSets.map((set) => set.breakdowns.placement)),
      day: dayRows,
    },
    abTest,
  };
}

/** A/B test: which ad set got results more cheaply, and how sure we are. */
function judgeAbTest(adSets: AdSetResult[]): AbTestResult {
  const metric = "Cost per result";
  const ranked = adSets.filter((set) => set.results > 0).sort((a, b) => a.costPerResult - b.costPerResult);
  if (ranked.length < 2)
    return { winnerId: null, confidence: 0, metric, summary: "A/B test: not enough results to compare the ad sets." };
  const [best, next] = ranked;
  const difference = (next.costPerResult - best.costPerResult) / next.costPerResult;
  // More results and a bigger gap make a surer winner.
  const confidence = Math.min(0.99, 0.5 + difference * Math.sqrt(Math.min(best.results, next.results)) * 0.35);
  if (confidence < 0.8)
    return {
      winnerId: null,
      confidence,
      metric,
      summary: `A/B test: no clear winner (${Math.round(confidence * 100)}% confidence). ${best.name} was ${Math.round(difference * 100)}% cheaper per result, but that could be chance; run longer or with a bigger budget.`,
    };
  return {
    winnerId: best.id,
    confidence,
    metric,
    summary: `A/B test winner: ${best.name}, ${Math.round(difference * 100)}% cheaper per result than ${next.name} (${Math.round(confidence * 100)}% confidence).`,
  };
}

function rejected(campaign: Campaign, config: AdsConfig, ratings: Ratings, planned: number, days: number, notes: string[]): RunResult {
  const totals: RunTotals = {
    plannedBudget: planned,
    spend: 0,
    audienceSize: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    conversions: 0,
    costPerConversion: 0,
    revenue: 0,
    roas: 0,
  };
  const empty: Breakdowns = { age: [], gender: [], placement: [], day: [] };
  const adSets: AdSetResult[] = campaign.adSets.map((set) => ({
    ...zero(),
    id: set.id,
    name: set.name,
    delivery: "REJECTED",
    plannedBudget: adSetPlannedSpend(set),
    audienceSize: 0,
    frequency: 0,
    ctr: 0,
    cpc: 0,
    cpm: 0,
    costPerConversion: 0,
    revenue: 0,
    roas: 0,
    resultLabel: PERFORMANCE_GOALS[set.performanceGoal].result,
    costPerResult: 0,
    ads: set.ads.map((ad) => ({
      ...zero(),
      id: ad.id,
      name: ad.name,
      format: ad.format,
      adSetId: set.id,
      share: 0,
      quality: 0,
      ctr: 0,
      costPerConversion: 0,
    })),
    breakdowns: empty,
  }));
  return {
    version: 2,
    delivery: "REJECTED",
    totals,
    daily: Array.from({ length: days }, (_, i) => ({ day: i + 1, spend: 0, impressions: 0, clicks: 0, conversions: 0 })),
    ratings,
    goals: config.goals.map((goal) => evaluateGoal(goal, totals)),
    score: 0,
    notes,
    creatives: adSets.flatMap((set) => set.ads),
    adSets,
    breakdowns: empty,
  };
}

/**
 * A run in the current shape. Runs from before ad sets had one implicit ad
 * set: it's rebuilt from the totals so the same reports work.
 */
export function normalizeRunResult(result: RunResult, campaign: Campaign): RunResult {
  if (result.adSets) return result;
  const set = campaign.adSets[0];
  const t = result.totals;
  const day: BreakdownRow[] = result.daily.map((d) => ({
    key: String(d.day),
    label: `Day ${d.day}`,
    spend: d.spend,
    impressions: d.impressions,
    reach: 0,
    clicks: d.clicks,
    conversions: d.conversions,
    results: d.conversions,
  }));
  const breakdowns: Breakdowns = { age: [], gender: [], placement: [], day };
  const ads: CreativeResult[] = (result.creatives ?? []).map((c) => ({
    ...c,
    adSetId: set.id,
    reach: c.reach ?? 0,
    results: c.results ?? c.conversions,
  }));
  return {
    ...result,
    version: 2,
    adSets: [
      {
        id: set.id,
        name: set.name,
        delivery: "COMPLETED",
        plannedBudget: t.plannedBudget,
        audienceSize: t.audienceSize,
        spend: t.spend,
        impressions: t.impressions,
        reach: t.reach,
        clicks: t.clicks,
        conversions: t.conversions,
        results: t.conversions,
        frequency: t.frequency,
        ctr: t.ctr,
        cpc: t.cpc,
        cpm: t.cpm,
        costPerConversion: t.costPerConversion,
        revenue: t.revenue,
        roas: t.roas,
        resultLabel: "Conversions",
        costPerResult: t.costPerConversion,
        ads,
        breakdowns,
      },
    ],
    creatives: ads,
    breakdowns,
  };
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
  const met = info.op === "gte" ? actual >= goal.value : actual > 0 && actual <= goal.value;
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
