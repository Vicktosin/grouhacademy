// Social media content planner simulator (pure; safe in the browser).
//
// An intern plans a week of organic posts for a brand. Claude (or simple
// rules) rates the plan and each post; this model turns those ratings, the
// timing, formats and content mix into realistic organic results. Followers
// then leave comments the intern must reply to; the replies are graded into
// a "community" score.
//
// Platforms have generic names on purpose (no real-platform branding).

export type Platform = "FEED" | "SHORT_VIDEO" | "PROFESSIONAL" | "THREADS" | "STATUS";
export type PostFormat = "IMAGE" | "CAROUSEL" | "VIDEO" | "STORY" | "TEXT" | "LIVE";
export type Pillar =
  | "EDUCATE"
  | "ENTERTAIN"
  | "INSPIRE"
  | "PROMOTE"
  | "COMMUNITY"
  | "BEHIND_SCENES";
export type PostCta = "NONE" | "LINK" | "DM" | "COMMENT" | "SHARE" | "SAVE";
export type AudienceType = "STUDENTS" | "PROFESSIONALS" | "PARENTS" | "BUSINESS_OWNERS";
export type SocialGoalMetric =
  | "REACH"
  | "ENGAGEMENT_RATE"
  | "FOLLOWERS"
  | "CLICKS"
  | "SAVES_SHARES"
  | "COMMUNITY";
export type CommentKind = "QUESTION" | "PRAISE" | "COMPLAINT" | "LEAD" | "SPAM" | "TROLL";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const PLATFORMS: Record<
  Platform,
  {
    label: string;
    help: string;
    formats: PostFormat[];
    captionLimit: number;
    reach: number;
    /** How well the platform suits each audience. */
    fit: Record<AudienceType, number>;
  }
> = {
  FEED: {
    label: "Photo & video feed",
    help: "Visual posts and stories for a broad consumer audience.",
    formats: ["IMAGE", "CAROUSEL", "VIDEO", "STORY", "LIVE"],
    captionLimit: 2200,
    reach: 1,
    fit: { STUDENTS: 1.15, PROFESSIONALS: 0.95, PARENTS: 1.05, BUSINESS_OWNERS: 0.95 },
  },
  SHORT_VIDEO: {
    label: "Short-video app",
    help: "Vertical videos discovered by people who don't follow you yet.",
    formats: ["VIDEO", "LIVE"],
    captionLimit: 2200,
    reach: 1.5,
    fit: { STUDENTS: 1.35, PROFESSIONALS: 0.75, PARENTS: 0.85, BUSINESS_OWNERS: 0.8 },
  },
  PROFESSIONAL: {
    label: "Professional network",
    help: "Career and business audience; text, documents and videos.",
    formats: ["TEXT", "IMAGE", "CAROUSEL", "VIDEO"],
    captionLimit: 3000,
    reach: 0.8,
    fit: { STUDENTS: 0.65, PROFESSIONALS: 1.35, PARENTS: 0.6, BUSINESS_OWNERS: 1.25 },
  },
  THREADS: {
    label: "Text & threads app",
    help: "Short text posts and conversations; fast-moving.",
    formats: ["TEXT", "IMAGE", "VIDEO"],
    captionLimit: 280,
    reach: 0.85,
    fit: { STUDENTS: 1.1, PROFESSIONALS: 1.05, PARENTS: 0.7, BUSINESS_OWNERS: 0.9 },
  },
  STATUS: {
    label: "Messaging status",
    help: "24-hour updates seen by people who saved your number.",
    formats: ["IMAGE", "VIDEO", "TEXT"],
    captionLimit: 700,
    reach: 0.45,
    fit: { STUDENTS: 0.9, PROFESSIONALS: 0.9, PARENTS: 1.2, BUSINESS_OWNERS: 1.15 },
  },
};

export const FORMATS: Record<
  PostFormat,
  { label: string; reach: number; engagement: number; saves: number; shares: number; comments: number; clicks: number }
> = {
  IMAGE: { label: "Single image", reach: 1, engagement: 1, saves: 1, shares: 1, comments: 1, clicks: 1 },
  CAROUSEL: { label: "Carousel / document", reach: 1.05, engagement: 1.25, saves: 1.7, shares: 1.1, comments: 1, clicks: 0.9 },
  VIDEO: { label: "Short video", reach: 1.45, engagement: 1.1, saves: 1, shares: 1.6, comments: 1.1, clicks: 0.8 },
  STORY: { label: "Story (24h)", reach: 0.55, engagement: 0.5, saves: 0.1, shares: 0.4, comments: 0.6, clicks: 1.4 },
  TEXT: { label: "Text post", reach: 0.85, engagement: 0.9, saves: 0.6, shares: 0.9, comments: 1.3, clicks: 0.9 },
  LIVE: { label: "Live session", reach: 0.5, engagement: 2, saves: 0.2, shares: 0.8, comments: 3, clicks: 0.7 },
};

export const PILLARS: Record<
  Pillar,
  { label: string; help: string; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number }
> = {
  EDUCATE: { label: "Educate", help: "Tips, how-tos, explainers", reach: 1, likes: 1, comments: 1, shares: 1.2, saves: 1.8, clicks: 1 },
  ENTERTAIN: { label: "Entertain", help: "Humour, trends, relatable moments", reach: 1.15, likes: 1.25, comments: 1.1, shares: 1.8, saves: 0.7, clicks: 0.7 },
  INSPIRE: { label: "Inspire", help: "Stories, results, testimonials", reach: 1.05, likes: 1.3, comments: 1, shares: 1.2, saves: 1.1, clicks: 0.9 },
  PROMOTE: { label: "Promote", help: "Offers, launches, prices", reach: 0.85, likes: 0.7, comments: 0.8, shares: 0.6, saves: 0.7, clicks: 2.2 },
  COMMUNITY: { label: "Community", help: "Questions, polls, user content", reach: 1, likes: 1, comments: 2, shares: 0.9, saves: 0.6, clicks: 0.6 },
  BEHIND_SCENES: { label: "Behind the scenes", help: "The people and process", reach: 1, likes: 1.15, comments: 1.2, shares: 0.9, saves: 0.8, clicks: 0.8 },
};

export const POST_CTAS: Record<PostCta, string> = {
  NONE: "No call to action",
  LINK: "Visit the link",
  DM: "Send us a message",
  COMMENT: "Comment below",
  SHARE: "Share / tag a friend",
  SAVE: "Save this post",
};

export const AUDIENCE_TYPES: Record<
  AudienceType,
  {
    label: string;
    /** Busy hours (WAT) on weekdays and at weekends: [from, to) windows. */
    weekday: Array<[number, number]>;
    weekend: Array<[number, number]>;
    weekendActivity: number;
  }
> = {
  STUDENTS: {
    label: "Students & young adults",
    weekday: [[12, 14], [19, 23.5]],
    weekend: [[11, 14], [18, 23.5]],
    weekendActivity: 1.1,
  },
  PROFESSIONALS: {
    label: "Working professionals",
    weekday: [[6.5, 8.5], [12, 13.5], [19, 21.5]],
    weekend: [[10, 12], [17, 20]],
    weekendActivity: 0.8,
  },
  PARENTS: {
    label: "Parents & homemakers",
    weekday: [[5.5, 7], [13, 15.5], [20, 22]],
    weekend: [[9, 12], [16, 19]],
    weekendActivity: 1,
  },
  BUSINESS_OWNERS: {
    label: "Business owners & traders",
    weekday: [[6.5, 8.5], [17, 19.5]],
    weekend: [[19, 22]],
    weekendActivity: 0.75,
  },
};

export const SOCIAL_GOAL_METRICS: Record<
  SocialGoalMetric,
  { label: string; unit: "count" | "percent" | "score" }
> = {
  REACH: { label: "Total reach", unit: "count" },
  ENGAGEMENT_RATE: { label: "Engagement rate", unit: "percent" },
  FOLLOWERS: { label: "New followers", unit: "count" },
  CLICKS: { label: "Link clicks / DMs", unit: "count" },
  SAVES_SHARES: { label: "Saves + shares", unit: "count" },
  COMMUNITY: { label: "Reply quality", unit: "score" },
};

export const COMMENT_KINDS: Record<CommentKind, string> = {
  QUESTION: "Question",
  PRAISE: "Praise",
  COMPLAINT: "Complaint",
  LEAD: "Ready to buy",
  SPAM: "Spam",
  TROLL: "Troll",
};

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type SocialPost = {
  id: string;
  day: number;
  /** "HH:MM", 24-hour, West Africa Time. */
  time: string;
  platform: Platform;
  format: PostFormat;
  pillar: Pillar;
  caption: string;
  hashtags: string;
  visual: string;
  cta: PostCta;
};

export type SocialPlan = { posts: SocialPost[] };

export type SocialGoal = { metric: SocialGoalMetric; value: number };

export type SocialConfig = {
  brand: { name: string; description: string; voice: string };
  product: { name: string; description: string };
  audience: { type: AudienceType; description: string };
  followers: number;
  platforms: Platform[];
  /** Typical organic results for this account with average content. */
  benchmarks: { reachRate: number; engagementRate: number; clickRate: number };
  goals: SocialGoal[];
  minPosts: number;
  maxPosts: number;
  commentsPerRun: number;
  maxRuns: number;
};

export const DEFAULT_SOCIAL_CONFIG: SocialConfig = {
  brand: {
    name: "Glow by Tolu",
    description:
      "A small Lagos skincare brand selling shea-butter body creams and black-soap face washes, made in Nigeria. Sells online with delivery across Lagos and Abuja.",
    voice: "Warm, confident and a little playful; speaks like a big sister. Light Pidgin is fine.",
  },
  product: {
    name: "Shea Glow body cream (250ml, ₦6,500)",
    description: "Rich, non-greasy body cream for dry skin and dark spots; new launch this week.",
  },
  audience: {
    type: "STUDENTS",
    description: "Women aged 18-30 in Lagos and Abuja, mostly students and young workers who care about skincare on a budget.",
  },
  followers: 4800,
  platforms: ["FEED", "SHORT_VIDEO", "STATUS"],
  benchmarks: { reachRate: 0.18, engagementRate: 4, clickRate: 0.6 },
  goals: [
    { metric: "REACH", value: 9000 },
    { metric: "ENGAGEMENT_RATE", value: 4.5 },
    { metric: "FOLLOWERS", value: 40 },
    { metric: "COMMUNITY", value: 70 },
  ],
  minPosts: 5,
  maxPosts: 14,
  commentsPerRun: 6,
  maxRuns: 4,
};

/** What interns see: the audience type and benchmarks stay hidden. */
export function publicSocialConfig(config: SocialConfig) {
  return {
    brand: config.brand,
    product: config.product,
    audience: { description: config.audience.description },
    followers: config.followers,
    platforms: config.platforms,
    goals: config.goals,
    minPosts: config.minPosts,
    maxPosts: config.maxPosts,
    commentsPerRun: config.commentsPerRun,
    maxRuns: config.maxRuns,
  };
}
export type PublicSocialConfig = ReturnType<typeof publicSocialConfig>;

export type PostRating = {
  postId: string;
  hook: number;
  caption: number;
  relevance: number;
  tip: string;
};

export type PlanRatings = {
  mix: number;
  consistency: number;
  voice: number;
  posts: PostRating[];
  source: "ai" | "rules";
};

export type SocialFeedback = {
  summary: string;
  strengths: string[];
  improvements: string[];
};

export type SimComment = {
  id: string;
  postId: string;
  author: string;
  kind: CommentKind;
  text: string;
  reply?: string;
  grade?: { score: number; feedback: string };
};

export type PostResult = {
  postId: string;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  followers: number;
  engagementRate: number;
  timing: "peak" | "ok" | "quiet";
};

export type SocialTotals = {
  posts: number;
  reach: number;
  engagements: number;
  engagementRate: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  followers: number;
  community: number | null;
};

export type SocialGoalResult = {
  metric: SocialGoalMetric;
  label: string;
  target: number;
  actual: number;
  met: boolean;
  pending: boolean;
};

export type SocialResult = {
  posts: PostResult[];
  daily: Array<{ day: number; reach: number; engagements: number }>;
  totals: SocialTotals;
  goals: SocialGoalResult[];
  score: number;
  notes: string[];
};

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const clampNum = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T) =>
  options.includes(value as T) ? (value as T) : fallback;
const keys = <T extends string>(record: Record<T, unknown>) => Object.keys(record) as T[];

export function newPostId() {
  return Math.random().toString(36).slice(2, 10);
}

function parsePost(raw: unknown, index: number): SocialPost {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const platform = oneOf(r.platform, keys(PLATFORMS), "FEED");
  const time = typeof r.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : "12:00";
  return {
    id: typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : `p${index}`,
    day: clampInt(r.day, 0, 6, 0),
    time,
    platform,
    format: oneOf(r.format, PLATFORMS[platform].formats, PLATFORMS[platform].formats[0]),
    pillar: oneOf(r.pillar, keys(PILLARS), "EDUCATE"),
    caption: text(r.caption, 3000),
    hashtags: text(r.hashtags, 300),
    visual: text(r.visual, 400),
    cta: oneOf(r.cta, keys(POST_CTAS), "NONE"),
  };
}

export function parsePlan(value: unknown): SocialPlan {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const posts = Array.isArray(raw.posts) ? raw.posts.slice(0, 30).map(parsePost) : [];
  // Keep ids unique.
  const seen = new Set<string>();
  for (const post of posts) {
    while (seen.has(post.id)) post.id = `${post.id}x`;
    seen.add(post.id);
  }
  return { posts };
}

export function parseSocialConfig(value: unknown): SocialConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const obj = (key: string) =>
    raw[key] && typeof raw[key] === "object" ? (raw[key] as Record<string, unknown>) : {};
  const d = DEFAULT_SOCIAL_CONFIG;
  const brand = obj("brand");
  const product = obj("product");
  const audience = obj("audience");
  const benchmarks = obj("benchmarks");
  const platforms = Array.isArray(raw.platforms)
    ? [...new Set(raw.platforms.filter((p): p is Platform => keys(PLATFORMS).includes(p as Platform)))]
    : d.platforms;
  const goals = Array.isArray(raw.goals)
    ? raw.goals
        .filter(
          (goal): goal is { metric: SocialGoalMetric; value: unknown } =>
            Boolean(goal) &&
            keys(SOCIAL_GOAL_METRICS).includes((goal as { metric?: SocialGoalMetric }).metric!),
        )
        .map((goal) => ({ metric: goal.metric, value: Math.max(0, Number(goal.value) || 0) }))
        .slice(0, 6)
    : d.goals;
  const minPosts = clampInt(raw.minPosts, 1, 21, d.minPosts);
  return {
    brand: {
      name: text(brand.name, 80) || d.brand.name,
      description: text(brand.description, 1000),
      voice: text(brand.voice, 300),
    },
    product: { name: text(product.name, 120), description: text(product.description, 500) },
    audience: {
      type: oneOf(audience.type, keys(AUDIENCE_TYPES), d.audience.type),
      description: text(audience.description, 500),
    },
    followers: clampInt(raw.followers, 50, 5_000_000, d.followers),
    platforms: platforms.length ? platforms : d.platforms,
    benchmarks: {
      reachRate: clampNum(benchmarks.reachRate, 0.01, 1, d.benchmarks.reachRate),
      engagementRate: clampNum(benchmarks.engagementRate, 0.1, 30, d.benchmarks.engagementRate),
      clickRate: clampNum(benchmarks.clickRate, 0, 20, d.benchmarks.clickRate),
    },
    goals,
    minPosts,
    maxPosts: Math.max(minPosts, clampInt(raw.maxPosts, 1, 30, d.maxPosts)),
    commentsPerRun: clampInt(raw.commentsPerRun, 2, 12, d.commentsPerRun),
    maxRuns: clampInt(raw.maxRuns, 1, 20, d.maxRuns),
  };
}

/** Problems that stop a plan from running (shown before Run). */
export function planProblems(
  plan: SocialPlan,
  config: Pick<SocialConfig, "minPosts" | "maxPosts" | "platforms">,
) {
  const problems: string[] = [];
  if (plan.posts.length < config.minPosts)
    problems.push(`Plan at least ${config.minPosts} posts for the week.`);
  if (plan.posts.length > config.maxPosts)
    problems.push(`Plan at most ${config.maxPosts} posts this week.`);
  plan.posts.forEach((post, index) => {
    const name = `Post ${index + 1} (${DAYS[post.day]} ${post.time})`;
    if (!config.platforms.includes(post.platform))
      problems.push(`${name}: that platform isn't part of this brief.`);
    if (post.caption.length < 10 && post.format !== "STORY")
      problems.push(`${name}: write a caption.`);
    if (post.caption.length > PLATFORMS[post.platform].captionLimit)
      problems.push(`${name}: the caption is too long for ${PLATFORMS[post.platform].label}.`);
    if (post.format !== "TEXT" && post.visual.length < 10)
      problems.push(`${name}: describe the image or video.`);
  });
  return problems;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

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

function hoursOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

/** How busy the audience is at a time: 1.25 at peak, ~0.25 overnight. */
export function timingFactor(audience: AudienceType, day: number, time: string) {
  const type = AUDIENCE_TYPES[audience];
  const weekend = day >= 5;
  const hour = hoursOf(time);
  const windows = weekend ? type.weekend : type.weekday;
  const dayActivity = weekend ? type.weekendActivity : 1;
  if (windows.some(([from, to]) => hour >= from && hour < to))
    return { factor: 1.25 * dayActivity, timing: "peak" as const };
  if (hour < 5.5 || hour >= 23.75) return { factor: 0.25 * dayActivity, timing: "quiet" as const };
  // Shoulder: within an hour of a peak.
  if (windows.some(([from, to]) => hour >= from - 1 && hour < to + 1))
    return { factor: 0.9 * dayActivity, timing: "ok" as const };
  return { factor: 0.65 * dayActivity, timing: "ok" as const };
}

function hashtagFactor(post: SocialPost) {
  const tags = post.hashtags.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (post.platform === "STATUS") return 1;
  if (post.platform === "PROFESSIONAL" || post.platform === "THREADS")
    return tags.length === 0 ? 0.97 : tags.length <= 3 ? 1.05 : 0.9;
  if (tags.length === 0) return 0.92;
  if (tags.length <= 8) return 1.06;
  if (tags.length <= 20) return 1;
  return 0.88;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function simulateWeek({
  plan,
  config,
  ratings,
  seed,
  community = null,
}: {
  plan: SocialPlan;
  config: SocialConfig;
  ratings: PlanRatings;
  seed: string;
  community?: number | null;
}): SocialResult {
  const random = seededRandom(seed);
  const noise = (spread: number) => 1 + (random() * 2 - 1) * spread;
  const { benchmarks, followers, audience } = config;
  const ratingFor = new Map(ratings.posts.map((r) => [r.postId, r]));
  const planQuality = 0.75 + 0.5 * ((ratings.mix + ratings.consistency + ratings.voice) / 3);
  const notes: string[] = [];

  // Posting the same platform more than twice a day tires followers.
  const perDayPlatform = new Map<string, number>();
  const ordered = [...plan.posts].sort(
    (a, b) => a.day - b.day || hoursOf(a.time) - hoursOf(b.time),
  );

  const results: PostResult[] = [];
  let quietPosts = 0;
  for (const post of ordered) {
    const key = `${post.day}:${post.platform}`;
    const nth = (perDayPlatform.get(key) ?? 0) + 1;
    perDayPlatform.set(key, nth);
    const fatigue = nth <= 2 ? 1 : Math.pow(0.65, nth - 2);

    const rating = ratingFor.get(post.id) ?? { hook: 0.5, caption: 0.5, relevance: 0.5 };
    const quality = 0.45 + 0.35 * rating.hook + 0.2 * rating.relevance; // 0.45..1
    const platform = PLATFORMS[post.platform];
    const format = FORMATS[post.format];
    const pillar = PILLARS[post.pillar];
    const timing = timingFactor(audience.type, post.day, post.time);
    if (timing.timing === "quiet") quietPosts++;

    // A strong short video occasionally travels well beyond followers.
    const viral =
      post.format === "VIDEO" && rating.hook > 0.7 && random() < 0.18 * rating.hook
        ? 2 + random() * 3
        : 1;

    const reach = Math.round(
      followers *
        benchmarks.reachRate *
        platform.reach *
        platform.fit[audience.type] *
        format.reach *
        pillar.reach *
        timing.factor *
        hashtagFactor(post) *
        quality *
        1.6 *
        planQuality *
        fatigue *
        viral *
        noise(0.15),
    );

    const engageBase =
      (benchmarks.engagementRate / 100) *
      format.engagement *
      (0.5 + 0.6 * rating.caption + 0.4 * rating.relevance) *
      (0.85 + 0.3 * ratings.voice) *
      noise(0.12);
    const ctaBoost = (kind: PostCta) => (post.cta === kind ? 1.6 : 1);
    const likes = Math.round(reach * engageBase * 0.78 * pillar.likes);
    const comments = Math.round(
      reach * engageBase * 0.09 * pillar.comments * format.comments * ctaBoost("COMMENT"),
    );
    const shares = Math.round(
      reach * engageBase * 0.07 * pillar.shares * format.shares * ctaBoost("SHARE"),
    );
    const saves = Math.round(
      reach * engageBase * 0.06 * pillar.saves * format.saves * ctaBoost("SAVE"),
    );
    const clicks = Math.round(
      reach *
        (benchmarks.clickRate / 100) *
        pillar.clicks *
        format.clicks *
        (post.cta === "LINK" || post.cta === "DM" ? 2.2 : 0.4) *
        (0.6 + 0.8 * rating.caption) *
        noise(0.2),
    );
    const followersGained = Math.round(
      (reach * 0.0018 * quality + shares * 0.09 + saves * 0.02) * (viral > 1 ? 1.5 : 1),
    );
    const engagements = likes + comments + shares + saves;
    results.push({
      postId: post.id,
      reach,
      likes,
      comments,
      shares,
      saves,
      clicks,
      followers: followersGained,
      engagementRate: reach ? round1((engagements / reach) * 100) : 0,
      timing: timing.timing,
    });
    if (fatigue < 1 && nth === 3)
      notes.push(
        `${DAYS[post.day]}: more than two posts on ${platform.label} in one day — later ones reached fewer people.`,
      );
    if (viral > 1)
      notes.push(`Your ${DAYS[post.day]} video took off and reached people beyond your followers.`);
  }

  if (quietPosts)
    notes.push(
      `${quietPosts} post${quietPosts === 1 ? " went" : "s went"} out when your audience was mostly offline.`,
    );
  const promoShare =
    plan.posts.filter((p) => p.pillar === "PROMOTE").length / Math.max(1, plan.posts.length);
  if (promoShare > 0.5)
    notes.push("Over half your posts were promotional, so followers engaged less. Mix in value posts.");
  const activeDays = new Set(plan.posts.map((p) => p.day)).size;
  if (activeDays <= 3) notes.push("You posted on only a few days; consistency through the week builds reach.");

  const sum = (pick: (r: PostResult) => number) => results.reduce((t, r) => t + pick(r), 0);
  const totalReach = sum((r) => r.reach);
  const engagements = sum((r) => r.likes + r.comments + r.shares + r.saves);
  const totals: SocialTotals = {
    posts: results.length,
    reach: totalReach,
    engagements,
    engagementRate: totalReach ? round1((engagements / totalReach) * 100) : 0,
    likes: sum((r) => r.likes),
    comments: sum((r) => r.comments),
    shares: sum((r) => r.shares),
    saves: sum((r) => r.saves),
    clicks: sum((r) => r.clicks),
    followers: sum((r) => r.followers),
    community,
  };

  const byPost = new Map(plan.posts.map((p) => [p.id, p]));
  const daily = DAYS.map((_, day) => {
    const dayResults = results.filter((r) => byPost.get(r.postId)?.day === day);
    return {
      day,
      reach: dayResults.reduce((t, r) => t + r.reach, 0),
      engagements: dayResults.reduce((t, r) => t + r.likes + r.comments + r.shares + r.saves, 0),
    };
  });

  return { ...scoreWeek(totals, config, ratings), posts: results, daily, totals, notes };
}

function actualFor(metric: SocialGoalMetric, totals: SocialTotals) {
  switch (metric) {
    case "REACH":
      return totals.reach;
    case "ENGAGEMENT_RATE":
      return totals.engagementRate;
    case "FOLLOWERS":
      return totals.followers;
    case "CLICKS":
      return totals.clicks;
    case "SAVES_SHARES":
      return totals.saves + totals.shares;
    case "COMMUNITY":
      return totals.community ?? 0;
  }
}

/**
 * Goals (70%, partial credit for getting close) plus plan quality (30%).
 * Reply quality counts once the intern has replied to the comments.
 */
export function scoreWeek(
  totals: SocialTotals,
  config: Pick<SocialConfig, "goals">,
  ratings: PlanRatings,
) {
  const goals: SocialGoalResult[] = config.goals.map((goal) => {
    const actual = actualFor(goal.metric, totals);
    const pending = goal.metric === "COMMUNITY" && totals.community === null;
    return {
      metric: goal.metric,
      label: SOCIAL_GOAL_METRICS[goal.metric].label,
      target: goal.value,
      actual,
      met: !pending && actual >= goal.value,
      pending,
    };
  });
  const goalScore = goals.length
    ? goals.reduce(
        (t, g) => t + (g.pending ? 0 : Math.min(1, g.target ? g.actual / g.target : 1) ** 1.5),
        0,
      ) / goals.length
    : 1;
  const postAverage = ratings.posts.length
    ? ratings.posts.reduce((t, p) => t + (p.hook + p.caption + p.relevance) / 3, 0) /
      ratings.posts.length
    : 0.5;
  const quality = (ratings.mix + ratings.consistency + ratings.voice + postAverage) / 4;
  return { goals, score: Math.round(70 * goalScore + 30 * quality) };
}

export function formatSocialGoal(metric: SocialGoalMetric, value: number) {
  const unit = SOCIAL_GOAL_METRICS[metric].unit;
  if (unit === "percent") return `${value}%`;
  if (unit === "score") return `${Math.round(value)}/100`;
  return Math.round(value).toLocaleString("en-NG");
}

/** Next free half-hour slot suggestion for a new post on a day. */
export function suggestTime(plan: SocialPlan, day: number) {
  const used = new Set(plan.posts.filter((p) => p.day === day).map((p) => p.time));
  for (const time of ["12:00", "19:00", "08:00", "21:00", "15:00"])
    if (!used.has(time)) return time;
  return "17:00";
}
