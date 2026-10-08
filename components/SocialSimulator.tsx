"use client";

import {
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Play,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { bringIntoView } from "@/lib/bring-into-view";
import {
  COMMENT_KINDS,
  DAYS,
  FORMATS,
  formatSocialGoal,
  newPostId,
  PILLARS,
  PLATFORMS,
  planProblems,
  POST_CTAS,
  SOCIAL_GOAL_METRICS,
  suggestTime,
  type Pillar,
  type Platform,
  type PostCta,
  type PostFormat,
  type PublicSocialConfig,
  type SocialPlan,
  type SocialPost,
} from "@/lib/social-sim/model";
import type { SocialRun } from "@/lib/practice-lab";

// The Social Media Simulator screen: plan a week of posts, run it, read the
// results and reply to follower comments. Shared by interns and the admin
// test run. Generic design; no real platform's look or branding.

const n = (value: number) => Math.round(value).toLocaleString("en-NG");
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";
const PILLAR_COLOR: Record<Pillar, string> = {
  EDUCATE: "bg-sky-500",
  ENTERTAIN: "bg-fuchsia-500",
  INSPIRE: "bg-amber-500",
  PROMOTE: "bg-red-500",
  COMMUNITY: "bg-emerald-500",
  BEHIND_SCENES: "bg-indigo-500",
};
const PLATFORM_SHORT: Record<Platform, string> = {
  FEED: "Feed",
  SHORT_VIDEO: "Short video",
  PROFESSIONAL: "Pro network",
  THREADS: "Threads",
  STATUS: "Status",
};

export default function SocialSimulator({
  config,
  plan,
  onPlanChange,
  runs,
  onRun,
  onReply,
  onSubmit,
  submitLabel = "Submit this run",
  maxRuns,
}: {
  config: PublicSocialConfig;
  plan: SocialPlan;
  onPlanChange: (plan: SocialPlan) => void;
  runs: SocialRun[];
  /** Runs the week; resolves with an error message on failure. */
  onRun: (plan: SocialPlan) => Promise<string | null>;
  /** Sends replies for grading; resolves with an error message on failure. */
  onReply: (runIndex: number, replies: Record<string, string>) => Promise<string | null>;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel?: string;
  /** Omit for unlimited (admin test runs). */
  maxRuns?: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Opens a post's editor, which sits below the week (scrolls on phones).
  const editPost = (id: string | null) => {
    setEditing(id);
    if (id) bringIntoView(editorRef.current);
  };
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const problems = planProblems(plan, config);
  const runsLeft = maxRuns === undefined ? null : Math.max(0, maxRuns - runs.length);
  const shownIndex = selected ?? runs.length - 1;
  const editingPost = plan.posts.find((post) => post.id === editing) ?? null;

  const setPosts = (posts: SocialPost[]) => onPlanChange({ posts });
  const updatePost = (id: string, patch: Partial<SocialPost>) =>
    setPosts(plan.posts.map((post) => (post.id === id ? { ...post, ...patch } : post)));
  const addPost = (day: number) => {
    const platform = config.platforms[0];
    const post: SocialPost = {
      id: newPostId(),
      day,
      time: suggestTime(plan, day),
      platform,
      format: PLATFORMS[platform].formats[0],
      pillar: "EDUCATE",
      caption: "",
      hashtags: "",
      visual: "",
      cta: "NONE",
    };
    setPosts([...plan.posts, post]);
    editPost(post.id);
  };

  async function run() {
    setRunning(true);
    setError(null);
    const failure = await onRun(plan);
    setRunning(false);
    if (failure) setError(failure);
    else {
      setSelected(null);
      setEditing(null);
    }
  }

  const pillarCounts = (Object.keys(PILLARS) as Pillar[])
    .map((pillar) => ({ pillar, count: plan.posts.filter((p) => p.pillar === pillar).length }))
    .filter((entry) => entry.count);
  const activeDays = new Set(plan.posts.map((p) => p.day)).size;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">The brand</p>
        <h2 className="mt-1 text-sm font-bold text-[#1C1D52]">{config.brand.name}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">{config.brand.description}</p>
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          {config.brand.voice && (
            <div>
              <dt className="font-bold text-[#1C1D52]">Brand voice</dt>
              <dd>{config.brand.voice}</dd>
            </div>
          )}
          {config.product.name && (
            <div>
              <dt className="font-bold text-[#1C1D52]">Focus this week</dt>
              <dd>
                {config.product.name}
                {config.product.description ? ` — ${config.product.description}` : ""}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-bold text-[#1C1D52]">Audience</dt>
            <dd>{config.audience.description}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#1C1D52]">Account</dt>
            <dd>
              {n(config.followers)} followers · {config.platforms.map((p) => PLATFORMS[p].label).join(", ")}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          {config.goals.map((goal, index) => (
            <span key={index} className="inline-flex items-center gap-1 rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-semibold text-[#1C1D52]">
              <Target className="h-3 w-3" />
              {SOCIAL_GOAL_METRICS[goal.metric].label} ≥ {formatSocialGoal(goal.metric, goal.value)}
            </span>
          ))}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            {config.minPosts}–{config.maxPosts} posts
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">Your week</h2>
            <p className="text-[11px] text-slate-500">
              {plan.posts.length} post{plan.posts.length === 1 ? "" : "s"} · {activeDays} of 7 days · tap a post to edit it
            </p>
          </div>
          {plan.posts.length > 0 && (
            <div className="w-full max-w-xs">
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                {pillarCounts.map(({ pillar, count }) => (
                  <div key={pillar} className={PILLAR_COLOR[pillar]} style={{ width: `${(count / plan.posts.length) * 100}%` }} />
                ))}
              </div>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
                {pillarCounts.map(({ pillar, count }) => (
                  <span key={pillar} className="inline-flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${PILLAR_COLOR[pillar]}`} />
                    {PILLARS[pillar].label} {count}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div className="grid min-w-[840px] grid-cols-7 gap-2">
            {DAYS.map((label, day) => {
              const posts = plan.posts
                .filter((post) => post.day === day)
                .sort((a, b) => a.time.localeCompare(b.time));
              return (
                <div key={label} className="flex min-h-[160px] flex-col rounded-xl bg-[#f8fbff] p-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
                  <div className="mt-2 flex-1 space-y-1.5">
                    {posts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => editPost(editing === post.id ? null : post.id)}
                        className={`w-full rounded-lg border bg-white p-2 text-left ${editing === post.id ? "border-[#5FBB46] ring-1 ring-[#5FBB46]" : "border-slate-200"}`}
                      >
                        <span className="flex items-center justify-between gap-1 text-[10px] font-bold text-[#1C1D52]">
                          {post.time}
                          <span className={`h-2 w-2 rounded-full ${PILLAR_COLOR[post.pillar]}`} title={PILLARS[post.pillar].label} />
                        </span>
                        <span className="block text-[9px] text-slate-500">
                          {PLATFORM_SHORT[post.platform]} · {FORMATS[post.format].label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[10px] text-slate-600">
                          {post.caption || <em className="text-slate-300">No caption yet</em>}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addPost(day)}
                    disabled={plan.posts.length >= config.maxPosts}
                    className="mt-2 inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Add post
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={editorRef} className="scroll-mt-4" />
        {editingPost && (
          <PostEditor
            key={editingPost.id}
            post={editingPost}
            platforms={config.platforms}
            brandName={config.brand.name}
            onChange={(patch) => updatePost(editingPost.id, patch)}
            onDuplicate={() => {
              const copy = { ...editingPost, id: newPostId(), day: (editingPost.day + 1) % 7 };
              setPosts([...plan.posts, copy]);
              setEditing(copy.id);
            }}
            onDelete={() => {
              setPosts(plan.posts.filter((post) => post.id !== editingPost.id));
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
            canDuplicate={plan.posts.length < config.maxPosts}
          />
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || problems.length > 0 || runsLeft === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Publishing your week…" : "Run the week"}
        </button>
        {runsLeft !== null && (
          <span className="text-xs text-slate-500">
            {runsLeft} of {maxRuns} runs left
          </span>
        )}
        {problems.length > 0 && (
          <ul className="w-full list-disc pl-5 text-[11px] text-amber-700">
            {problems.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
            {problems.length > 6 && <li>…and {problems.length - 6} more.</li>}
          </ul>
        )}
        {error && <p className="w-full text-xs font-semibold text-red-600" role="alert">{error}</p>}
      </section>

      {runs[shownIndex] && (
        <Results
          key={shownIndex}
          runs={runs}
          shownIndex={shownIndex}
          onSelect={setSelected}
          onReply={onReply}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function PostEditor({
  post,
  platforms,
  brandName,
  onChange,
  onDuplicate,
  onDelete,
  onClose,
  canDuplicate,
}: {
  post: SocialPost;
  platforms: Platform[];
  brandName: string;
  onChange: (patch: Partial<SocialPost>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  canDuplicate: boolean;
}) {
  const limit = PLATFORMS[post.platform].captionLimit;
  return (
    <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-[#1C1D52]">
            Edit post · {DAYS[post.day]} {post.time}
          </p>
          <div className="flex gap-1">
            <button type="button" onClick={onDuplicate} disabled={!canDuplicate} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">
              <Copy className="h-3 w-3" /> Duplicate
            </button>
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <button type="button" onClick={onClose} className="rounded-lg bg-[#1C1D52] px-3 py-1.5 text-[10px] font-bold text-white">
              Done
            </button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Day">
            <select value={post.day} onChange={(e) => onChange({ day: Number(e.target.value) })} className={inputClass}>
              {DAYS.map((label, day) => (
                <option key={label} value={day}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Time (WAT)">
            <input
              type="time"
              step={900}
              value={post.time}
              onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && onChange({ time: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Platform">
            <select
              value={post.platform}
              onChange={(e) => {
                const platform = e.target.value as Platform;
                const formats = PLATFORMS[platform].formats;
                onChange({ platform, format: formats.includes(post.format) ? post.format : formats[0] });
              }}
              className={inputClass}
            >
              {platforms.map((platform) => (
                <option key={platform} value={platform}>{PLATFORMS[platform].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Format">
            <select value={post.format} onChange={(e) => onChange({ format: e.target.value as PostFormat })} className={inputClass}>
              {PLATFORMS[post.platform].formats.map((format) => (
                <option key={format} value={format}>{FORMATS[format].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Content type">
            <select value={post.pillar} onChange={(e) => onChange({ pillar: e.target.value as Pillar })} className={inputClass}>
              {(Object.keys(PILLARS) as Pillar[]).map((pillar) => (
                <option key={pillar} value={pillar}>
                  {PILLARS[pillar].label} — {PILLARS[pillar].help}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Call to action">
            <select value={post.cta} onChange={(e) => onChange({ cta: e.target.value as PostCta })} className={inputClass}>
              {(Object.keys(POST_CTAS) as PostCta[]).map((cta) => (
                <option key={cta} value={cta}>{POST_CTAS[cta]}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Caption (${post.caption.length}/${limit})`}>
          <textarea
            rows={5}
            value={post.caption}
            maxLength={limit}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Start with a hook that stops the scroll. Then the value. End with one clear call to action."
            className={inputClass}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hashtags">
            <input value={post.hashtags} maxLength={300} onChange={(e) => onChange({ hashtags: e.target.value })} placeholder="#skincare #lagosbusiness" className={inputClass} />
          </Field>
          <Field label={post.format === "TEXT" ? "Image (optional)" : "Describe the image or video"}>
            <input value={post.visual} maxLength={400} onChange={(e) => onChange({ visual: e.target.value })} placeholder="e.g. 15s video: before/after of dry elbows, upbeat Afrobeats" className={inputClass} />
          </Field>
        </div>
      </div>
      <PostPreview post={post} brandName={brandName} />
    </div>
  );
}

/** A generic post mock-up (not any real platform's design). */
function PostPreview({ post, brandName }: { post: SocialPost; brandName: string }) {
  const vertical = post.format === "VIDEO" || post.format === "STORY" || post.format === "LIVE";
  return (
    <div className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1D52] text-xs font-bold text-white">
          {brandName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[#1C1D52]">{brandName}</p>
          <p className="text-[10px] text-slate-400">
            {PLATFORMS[post.platform].label} · {DAYS[post.day]} {post.time}
          </p>
        </div>
      </div>
      {post.format !== "TEXT" && (
        <div className={`relative flex ${vertical ? "aspect-[4/5]" : "aspect-square"} items-center justify-center bg-gradient-to-br from-[#1C1D52] to-[#5FBB46] p-5 text-center`}>
          <span className="absolute left-2 top-2 rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
            {FORMATS[post.format].label}
          </span>
          <p className="text-xs italic leading-5 text-white/90">{post.visual || "Describe the image or video."}</p>
        </div>
      )}
      <p className="whitespace-pre-line px-3 py-2.5 text-xs leading-5 text-slate-700">
        {post.caption || <span className="text-slate-300">Your caption appears here.</span>}
        {post.hashtags && <span className="mt-1 block text-sky-700">{post.hashtags}</span>}
      </p>
    </div>
  );
}

function Results({
  runs,
  shownIndex,
  onSelect,
  onReply,
  onSubmit,
  submitLabel,
}: {
  runs: SocialRun[];
  shownIndex: number;
  onSelect: (index: number) => void;
  onReply: (runIndex: number, replies: Record<string, string>) => Promise<string | null>;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel: string;
}) {
  const run = runs[shownIndex];
  const { result, ratings, feedback, plan } = run;
  const t = result.totals;
  const [submitting, setSubmitting] = useState(false);
  const best = runs.reduce((b, r, i) => (r.result.score > runs[b].result.score ? i : b), 0);
  const maxReach = Math.max(1, ...result.daily.map((d) => d.reach));
  const postById = new Map(plan.posts.map((p) => [p.id, p]));
  const ratingById = new Map(ratings.posts.map((r) => [r.postId, r]));
  const avg = (pick: (r: (typeof ratings.posts)[number]) => number) =>
    ratings.posts.length ? ratings.posts.reduce((s, r) => s + pick(r), 0) / ratings.posts.length : 0;

  const stats: Array<[string, string]> = [
    ["Posts", String(t.posts)],
    ["Total reach", n(t.reach)],
    ["Engagements", n(t.engagements)],
    ["Engagement rate", `${t.engagementRate}%`],
    ["Likes", n(t.likes)],
    ["Comments", n(t.comments)],
    ["Shares", n(t.shares)],
    ["Saves", n(t.saves)],
    ["Link clicks / DMs", n(t.clicks)],
    ["New followers", n(t.followers)],
  ];

  return (
    <>
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <BarChart3 className="h-4 w-4 text-[#5FBB46]" /> Results
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {runs.map((item, index) => (
              <button
                key={item.at}
                type="button"
                onClick={() => onSelect(index)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${index === shownIndex ? "bg-[#1C1D52] text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Week {index + 1} · {item.result.score}
                {index === best && runs.length > 1 ? " ★" : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#1C1D52] p-4 text-white">
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-[#5FBB46]">
            <span className="text-xl font-bold">{result.score}</span>
            <span className="text-[9px] text-white/60">/100</span>
          </div>
          <p className="min-w-0 flex-1 text-sm">{feedback.summary}</p>
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.goals.map((goal, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${goal.pending ? "bg-amber-50 text-amber-800" : goal.met ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}
            >
              {goal.pending ? <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" /> : goal.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>
                {goal.label}: <strong>{goal.pending ? "reply to comments below" : formatSocialGoal(goal.metric, goal.actual)}</strong>
                <span className="block text-[10px] opacity-75">target ≥ {formatSocialGoal(goal.metric, goal.target)}</span>
              </span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[#f8fbff] p-3">
              <dt className="text-[10px] text-slate-500">{label}</dt>
              <dd className="mt-0.5 text-sm font-bold text-[#1C1D52]">{value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Reach by day</p>
          <div className="flex h-32 items-end gap-2 rounded-xl bg-[#f8fbff] p-3">
            {result.daily.map((day) => (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end justify-center">
                  <div className="w-full max-w-[28px] rounded-t bg-[#5FBB46]" style={{ height: `${(day.reach / maxReach) * 100}%` }} title={`${n(day.reach)} reach · ${n(day.engagements)} engagements`} />
                </div>
                <span className="text-[9px] text-slate-500">{DAYS[day.day]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[11px]">
            <thead>
              <tr className="bg-[#f5f8fb] text-slate-600">
                <th className="px-2 py-2 font-semibold">Post</th>
                <th className="px-2 py-2 font-semibold">Timing</th>
                <th className="px-2 py-2 font-semibold">Reach</th>
                <th className="px-2 py-2 font-semibold">Eng. rate</th>
                <th className="px-2 py-2 font-semibold">Saves+shares</th>
                <th className="px-2 py-2 font-semibold">Clicks</th>
                <th className="px-2 py-2 font-semibold">Followers</th>
                <th className="px-2 py-2 font-semibold">Coach&apos;s tip</th>
              </tr>
            </thead>
            <tbody>
              {result.posts.map((r) => {
                const post = postById.get(r.postId);
                const rating = ratingById.get(r.postId);
                if (!post) return null;
                return (
                  <tr key={r.postId} className="border-b border-slate-100 align-top text-[#1C1D52]">
                    <td className="max-w-[220px] px-2 py-2">
                      <span className="font-bold">{DAYS[post.day]} {post.time}</span>
                      <span className="block text-[10px] text-slate-500">
                        {PLATFORM_SHORT[post.platform]} · {FORMATS[post.format].label} · {PILLARS[post.pillar].label}
                      </span>
                      <span className="line-clamp-1 block text-[10px] text-slate-500">{post.caption}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.timing === "peak" ? "bg-[#e8f7eb] text-[#397d3a]" : r.timing === "quiet" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"}`}>
                        <Clock className="h-3 w-3" />
                        {r.timing === "peak" ? "Peak" : r.timing === "quiet" ? "Quiet" : "OK"}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-semibold">{n(r.reach)}</td>
                    <td className="px-2 py-2">{r.engagementRate}%</td>
                    <td className="px-2 py-2">{n(r.saves + r.shares)}</td>
                    <td className="px-2 py-2">{n(r.clicks)}</td>
                    <td className="px-2 py-2">{n(r.followers)}</td>
                    <td className="max-w-[240px] px-2 py-2 text-[10px] text-slate-600">{rating?.tip}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {result.notes.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl bg-amber-50 py-3 pl-8 pr-4 text-xs text-amber-800">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Rating label="Hooks" value={avg((r) => r.hook)} />
          <Rating label="Captions" value={avg((r) => r.caption)} />
          <Rating label="Content mix" value={ratings.mix} />
          <Rating label="Consistency" value={ratings.consistency} />
          <Rating label="Brand voice" value={ratings.voice} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Advice title="What worked" items={feedback.strengths} />
          <Advice title="To improve" items={feedback.improvements} />
        </div>
        <p className="flex items-center gap-1 text-[10px] text-slate-400">
          <Sparkles className="h-3 w-3" />
          {ratings.source === "ai" ? "Plan judged by AI." : "Plan judged by simple rules."} Results come from a training simulation, not real posts.
        </p>
      </section>

      <Inbox key={`inbox-${shownIndex}`} run={run} runIndex={shownIndex} onReply={onReply} />

      {onSubmit && (
        <button
          type="button"
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit(shownIndex);
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Submitting…" : `${submitLabel} (week ${shownIndex + 1})`}
        </button>
      )}
    </>
  );
}

function Inbox({
  run,
  runIndex,
  onReply,
}: {
  run: SocialRun;
  runIndex: number;
  onReply: (runIndex: number, replies: Record<string, string>) => Promise<string | null>;
}) {
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const graded = Boolean(run.repliedAt);
  const postById = new Map(run.plan.posts.map((p) => [p.id, p]));

  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <MessageCircle className="h-4 w-4 text-[#5FBB46]" /> Comments to reply to
          </h2>
          <p className="text-[11px] text-slate-500">
            {graded
              ? `Reply quality: ${run.result.totals.community ?? 0}/100`
              : "Reply as the brand. Answer questions, calm complaints, help buyers, and don't feed trolls or spam (you can say you'd hide or report it). You can send once per week."}
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {run.comments.map((comment) => {
          const post = postById.get(comment.postId);
          return (
            <li key={comment.id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] text-slate-400">
                On {post ? `${DAYS[post.day]} ${PLATFORM_SHORT[post.platform]}: “${post.caption.slice(0, 70)}${post.caption.length > 70 ? "…" : ""}”` : "your post"}
              </p>
              <p className="mt-1 text-xs text-[#1C1D52]">
                <strong>{comment.author}</strong> {comment.text}
              </p>
              {graded ? (
                <div className="mt-2 space-y-1.5">
                  <p className="rounded-lg bg-[#f8fbff] px-3 py-2 text-xs text-slate-700">
                    <strong className="text-[#1C1D52]">You:</strong> {comment.reply || <em className="text-slate-400">No reply</em>}
                  </p>
                  {comment.grade && (
                    <p className={`rounded-lg px-3 py-2 text-[11px] ${comment.grade.score >= 7 ? "bg-[#e8f7eb] text-[#397d3a]" : comment.grade.score >= 4 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
                      <strong>{comment.grade.score}/10</strong> · {COMMENT_KINDS[comment.kind]} — {comment.grade.feedback}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={replies[comment.id] ?? ""}
                  onChange={(e) => setReplies({ ...replies, [comment.id]: e.target.value })}
                  placeholder="Write your reply…"
                  className={`${inputClass} mt-2`}
                />
              )}
            </li>
          );
        })}
      </ul>
      {!graded && (
        <>
          <button
            type="button"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              setError(null);
              const failure = await onReply(runIndex, replies);
              setSending(false);
              if (failure) setError(failure);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Grading your replies…" : "Send replies"}
          </button>
          {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}

function Rating({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div className="rounded-xl bg-[#f8fbff] p-3">
      <div className="flex justify-between text-[11px]">
        <span className="font-semibold text-[#1C1D52]">{label}</span>
        <span className="text-slate-500">{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${percent >= 70 ? "bg-[#5FBB46]" : percent >= 45 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Advice({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-bold text-[#1C1D52]">{title}</p>
      {items.length ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-slate-600">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-400">Nothing to add.</p>
      )}
    </div>
  );
}
