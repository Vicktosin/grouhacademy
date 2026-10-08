import { z } from "zod";
import { generateObject, isAiEnabled } from "@/lib/ai";
import {
  COMMENT_KINDS,
  DAYS,
  FORMATS,
  PILLARS,
  PLATFORMS,
  POST_CTAS,
  type CommentKind,
  type PlanRatings,
  type SimComment,
  type SocialConfig,
  type SocialFeedback,
  type SocialPlan,
} from "@/lib/social-sim/model";

// AI for the social media simulator (Claude, or free Gemini, OpenRouter or
// Groq when one of their keys is set, see lib/ai.ts; otherwise simple
// rules):
//  1. judgeWeek: rates the plan and each post, and writes realistic follower
//     comments on the posts for the intern to answer.
//  2. gradeReplies: grades the intern's replies to those comments.

const scale = (value: number) => Math.max(0, Math.min(10, value)) / 10;

function describeBrief(config: SocialConfig) {
  return `Brand: ${config.brand.name}
${config.brand.description}
Brand voice: ${config.brand.voice || "(not specified)"}
Product/focus this week: ${config.product.name}${config.product.description ? ` — ${config.product.description}` : ""}
Audience: ${config.audience.description}
Followers: ${config.followers.toLocaleString("en-NG")}`;
}

function describePlan(plan: SocialPlan) {
  return plan.posts
    .map(
      (post) => `[${post.id}] ${DAYS[post.day]} ${post.time} · ${PLATFORMS[post.platform].label} · ${FORMATS[post.format].label} · ${PILLARS[post.pillar].label} · CTA: ${POST_CTAS[post.cta]}
Caption: ${post.caption || "(none)"}
Hashtags: ${post.hashtags || "(none)"}
Visual: ${post.visual || "(not described)"}`,
    )
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// 1. Judge the week and write comments
// ---------------------------------------------------------------------------

const JudgeSchema = z.object({
  contentMix: z.number().int().describe("0-10: balance of content types for this brand and audience (value vs promotion)"),
  consistency: z.number().int().describe("0-10: spread through the week and a sensible posting rhythm"),
  brandVoice: z.number().int().describe("0-10: how well the captions match the brand voice"),
  posts: z.array(
    z.object({
      postId: z.string(),
      hook: z.number().int().describe("0-10: would the first line/visual stop the scroll for this audience?"),
      caption: z.number().int().describe("0-10: clarity, value, readability and a fitting call to action"),
      relevance: z.number().int().describe("0-10: relevance to this audience and platform"),
      tip: z.string().describe("One short, specific improvement for this post"),
    }),
  ),
  summary: z.string().describe("Two sentences for the intern about the week overall"),
  strengths: z.array(z.string()).describe("2-4 specific things done well"),
  improvements: z.array(z.string()).describe("2-4 specific, practical improvements"),
  comments: z.array(
    z.object({
      postId: z.string().describe("Which post the comment is on"),
      author: z.string().describe("A realistic Nigerian social media handle, e.g. @adaeze_k"),
      kind: z.enum(["QUESTION", "PRAISE", "COMPLAINT", "LEAD", "SPAM", "TROLL"]),
      text: z.string().describe("The comment as a real follower would write it; Nigerian English or light Pidgin where natural"),
    }),
  ),
});

const JUDGE_PROMPT = `You are a senior social media manager coaching interns at Grouh Academy, a Nigerian internship programme. An intern has planned one week of organic posts for a brand in a training simulator. Judge it as an experienced Nigerian social media manager would.

Rate honestly: an average first attempt is about 5; reserve 8+ for posts a professional would publish as-is. Judge hooks (the first line and visual), caption clarity and value, fit with the brand voice, fit with the platform and audience, and a call to action that suits the post. A healthy week mostly gives value (educate, entertain, inspire, community) with some promotion.

Then write follower comments on the posts, as real followers of this brand would: specific to what each post says, natural and varied in tone (some Nigerian English or light Pidgin is fine). Include the requested mix of comment kinds. LEAD means someone ready to buy asking how; COMPLAINT is a real customer problem (late delivery, price, a reaction to the product); SPAM is a scam or promotion; TROLL is rude or baiting. Keep comments under 40 words and never offensive beyond mild rudeness.

Write advice to the intern ("you"), specific and practical. Don't invent numbers; the simulator calculates results.`;

const COMMENT_MIX: CommentKind[] = ["QUESTION", "LEAD", "PRAISE", "COMPLAINT", "QUESTION", "SPAM", "TROLL", "PRAISE", "QUESTION", "COMPLAINT", "LEAD", "PRAISE"];

async function judgeWithAi(plan: SocialPlan, config: SocialConfig) {
  const mix = COMMENT_MIX.slice(0, config.commentsPerRun);
  return generateObject({
    task: "social week judging",
    schema: JudgeSchema,
    system: JUDGE_PROMPT,
    prompt: `${describeBrief(config)}

The intern's week (post ids in brackets):
${describePlan(plan)}

Rate every post (use its id). Write exactly ${mix.length} comments with these kinds: ${mix.map((k) => COMMENT_KINDS[k]).join(", ")}. Put them on the posts where they'd naturally appear.`,
    maxTokens: 16000,
    effort: "medium",
  });
}

const NAMES = ["@adaeze_k", "@tunde.bakes", "@chiomaa__", "@ibk_vibes", "@ngozi.o", "@sule_abj", "@femi_writes", "@blessing.ng", "@kemi_lagos", "@musa.dan", "@ifeoma_xo", "@dayo_tech"];

/** Template comments for the rules fallback. */
function templateComment(kind: CommentKind, config: SocialConfig) {
  const product = config.product.name || config.brand.name;
  const templates: Record<CommentKind, string> = {
    QUESTION: `How much is ${product}, and do you deliver outside Lagos?`,
    LEAD: `I want to order ${product} today. How do I pay?`,
    PRAISE: `I've been using your products for a month and I'm loving the results 😍`,
    COMPLAINT: `I ordered last week and it still hasn't arrived. Nobody is replying my DM. This is not fair.`,
    SPAM: `Make ₦50,000 daily from home!!! Click the link in my bio now 💰💰`,
    TROLL: `Abeg this one na scam. Una just dey cap.`,
  };
  return templates[kind];
}

function judgeWithRules(plan: SocialPlan, config: SocialConfig) {
  const posts = plan.posts.map((post) => {
    const firstLine = post.caption.split("\n")[0] ?? "";
    let hook = 0.35;
    if (firstLine.length >= 8 && firstLine.length <= 90) hook += 0.15;
    if (/[?!]|\d|you/i.test(firstLine)) hook += 0.15;
    if (post.visual.length >= 25) hook += 0.15;
    if (post.format === "VIDEO" || post.format === "CAROUSEL") hook += 0.05;
    let caption = 0.35;
    if (post.caption.length >= 60) caption += 0.15;
    if (post.cta !== "NONE") caption += 0.15;
    if (post.caption.length <= PLATFORMS[post.platform].captionLimit * 0.6) caption += 0.1;
    if (/\n/.test(post.caption)) caption += 0.05;
    const relevance = config.platforms.includes(post.platform) ? 0.6 : 0.3;
    const tips: string[] = [];
    if (firstLine.length > 90) tips.push("Make the first line shorter and punchier.");
    if (post.cta === "NONE") tips.push("End with one clear call to action.");
    if (post.visual.length < 25) tips.push("Describe a more specific, eye-catching visual.");
    return {
      postId: post.id,
      hook: Math.min(1, hook),
      caption: Math.min(1, caption),
      relevance,
      tip: tips[0] ?? "Solid post. Test a stronger hook to stop the scroll.",
    };
  });
  const count = plan.posts.length || 1;
  const promoShare = plan.posts.filter((p) => p.pillar === "PROMOTE").length / count;
  const pillarsUsed = new Set(plan.posts.map((p) => p.pillar)).size;
  const mix = Math.max(0.2, Math.min(1, 0.4 + pillarsUsed * 0.12 - Math.max(0, promoShare - 0.3)));
  const activeDays = new Set(plan.posts.map((p) => p.day)).size;
  const consistency = Math.min(1, 0.25 + activeDays * 0.11);

  const comments: SimComment[] = COMMENT_MIX.slice(0, config.commentsPerRun).map((kind, i) => {
    const post = plan.posts[i % count];
    return {
      id: `c${i}`,
      postId: post?.id ?? "",
      author: NAMES[i % NAMES.length],
      kind,
      text: templateComment(kind, config),
    };
  });

  return {
    ratings: { mix, consistency, voice: 0.55, posts, source: "rules" as const },
    feedback: {
      summary: "Here's rule-based feedback on your week. (Detailed AI coaching is switched off for this academy.)",
      strengths: pillarsUsed >= 3 ? ["You used a variety of content types."] : [],
      improvements: [
        ...(promoShare > 0.4 ? ["Fewer sales posts: aim for roughly 1 in 4 posts being promotional."] : []),
        ...(activeDays < 5 ? ["Post on at least 5 days of the week for steady reach."] : []),
      ],
    },
    comments,
  };
}

export async function judgeWeek(
  plan: SocialPlan,
  config: SocialConfig,
): Promise<{ ratings: PlanRatings; feedback: SocialFeedback; comments: SimComment[] }> {
  if (isAiEnabled()) {
    try {
      const result = await judgeWithAi(plan, config);
      const ids = new Set(plan.posts.map((p) => p.id));
      const rated = new Map(result.posts.filter((p) => ids.has(p.postId)).map((p) => [p.postId, p]));
      return {
        ratings: {
          mix: scale(result.contentMix),
          consistency: scale(result.consistency),
          voice: scale(result.brandVoice),
          posts: plan.posts.map((post) => {
            const r = rated.get(post.id);
            return {
              postId: post.id,
              hook: scale(r?.hook ?? 5),
              caption: scale(r?.caption ?? 5),
              relevance: scale(r?.relevance ?? 5),
              tip: r?.tip ?? "",
            };
          }),
          source: "ai",
        },
        feedback: {
          summary: result.summary,
          strengths: result.strengths,
          improvements: result.improvements,
        },
        comments: result.comments
          .filter((c) => ids.has(c.postId))
          .slice(0, config.commentsPerRun)
          .map((c, i) => ({ id: `c${i}`, postId: c.postId, author: c.author.slice(0, 40), kind: c.kind, text: c.text.slice(0, 400) })),
      };
    } catch (error) {
      console.error("AI plan judging failed; using rules.", error);
    }
  }
  return judgeWithRules(plan, config);
}

// ---------------------------------------------------------------------------
// 2. Grade replies
// ---------------------------------------------------------------------------

const GradeSchema = z.object({
  grades: z.array(
    z.object({
      commentId: z.string(),
      score: z.number().int().describe("0-10"),
      feedback: z.string().describe("One or two sentences of specific feedback to the intern"),
    }),
  ),
});

const GRADE_PROMPT = `You are a senior community manager coaching interns at Grouh Academy, a Nigerian internship programme. The intern is replying to comments on a brand's social posts in a training simulator. Grade each reply 0-10 as a professional community manager would.

A good reply: answers the actual question with the specific information given; sounds like the brand voice; is warm and human; moves buyers to the next step (how to order/DM/link); handles complaints calmly — acknowledge, apologise where fair, move to private messages to resolve, never argue; doesn't feed trolls (a calm, short reply or none is fine); and doesn't engage with spam (best: say they'd hide/delete/report it). Inventing prices, policies or facts the brief doesn't give is a mistake — offering to share details by DM is better. An empty reply scores 0, except for spam, where choosing not to reply and to hide/report scores well.

Feedback goes to the intern ("you"), specific and short.`;

const SPAM_ACTION = /\b(hid(e|ing|den)|delet\w*|remov\w*|report\w*|block\w*|ignor\w*|flag\w*)\b/i;

function gradeWithRules(comments: SimComment[]) {
  return comments.map((comment) => {
    const reply = (comment.reply ?? "").trim();
    let score = 0;
    let feedback = "";
    if (comment.kind === "SPAM") {
      score = !reply || SPAM_ACTION.test(reply) ? 9 : 3;
      feedback = score >= 9 ? "Right call: don't engage with spam; hide or report it." : "Don't reply to spam; hide or report it instead.";
    } else if (!reply) {
      feedback = "No reply. Every real follower comment deserves a response.";
    } else {
      score = 4;
      if (reply.length >= 30) score += 2;
      if (comment.author && reply.includes(comment.author.replace("@", ""))) score += 1;
      if (/thank|sorry|apolog|appreciate/i.test(reply)) score += 1;
      if (/dm|message|link|whatsapp|order|call/i.test(reply)) score += 1;
      if (comment.kind === "COMPLAINT" && /sorry|apolog/i.test(reply)) score += 1;
      score = Math.min(10, score);
      feedback =
        comment.kind === "COMPLAINT"
          ? "For complaints: acknowledge, apologise, and move it to DM to resolve."
          : comment.kind === "LEAD"
            ? "For buyers: thank them and give the exact next step to order."
            : "Keep replies warm, specific and on-brand.";
    }
    return { ...comment, reply, grade: { score, feedback } };
  });
}

/** Grades the intern's replies; returns the graded comments and a 0-100 score. */
export async function gradeReplies(
  comments: SimComment[],
  plan: SocialPlan,
  config: SocialConfig,
): Promise<{ comments: SimComment[]; community: number }> {
  let graded: SimComment[] | null = null;
  if (isAiEnabled()) {
    try {
      const byId = new Map(plan.posts.map((p) => [p.id, p]));
      const output = await generateObject({
        task: "social reply grading",
        schema: GradeSchema,
        system: GRADE_PROMPT,
        prompt: `${describeBrief(config)}

${comments
  .map((c) => {
    const post = byId.get(c.postId);
    return `[${c.id}] On the ${post ? `${DAYS[post.day]} ${PLATFORMS[post.platform].label} post: "${post.caption.slice(0, 200)}"` : "brand's post"}
Comment (${COMMENT_KINDS[c.kind]}) from ${c.author}: ${c.text}
Intern's reply: ${c.reply?.trim() || "(no reply)"}`;
  })
  .join("\n\n")}`,
        maxTokens: 8000,
        effort: "low",
      });
      const grades = new Map(output.grades.map((g) => [g.commentId, g]));
      if (comments.every((c) => grades.has(c.id)))
        graded = comments.map((c) => {
          const g = grades.get(c.id)!;
          return {
            ...c,
            reply: c.reply?.trim() ?? "",
            grade: { score: Math.max(0, Math.min(10, g.score)), feedback: g.feedback },
          };
        });
    } catch (error) {
      console.error("AI reply grading failed; using rules.", error);
    }
  }
  graded ??= gradeWithRules(comments);
  const community = Math.round(
    (graded.reduce((t, c) => t + (c.grade?.score ?? 0), 0) / Math.max(1, graded.length)) * 10,
  );
  return { comments: graded, community };
}
