"use client";

import {
  BarChart3,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Megaphone,
  Play,
  Send,
  Sparkles,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  audienceSize,
  BIDDING,
  CALLS_TO_ACTION,
  campaignProblems,
  FORMATS,
  formatGoalValue,
  GOAL_METRICS,
  INTERESTS,
  LOCATIONS,
  OBJECTIVES,
  PLACEMENTS,
  type AdFormat,
  type Bidding,
  type Campaign,
  type Gender,
  type GoalTarget,
  type Objective,
  type Placement,
  type RunResult,
} from "@/lib/ads-sim/model";
import type { AdFeedback } from "@/lib/ads-sim/evaluate";

// The Ad Campaign Simulator screen: plan a campaign in three steps (with a
// live ad preview), run it on the server, and read the results. Our own
// design, deliberately not a copy of any real ad platform.

export type SimRun = {
  at: string;
  campaign: Campaign;
  result: RunResult;
  feedback: AdFeedback;
};

type SimConfig = {
  business: { name: string; description: string };
  product: { name: string; description: string; price: number };
  conversionEvent: "SALES" | "LEADS";
  goals: GoalTarget[];
  maxRuns: number;
  maxTotalBudget: number;
};

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
const count = (value: number) => Math.round(value).toLocaleString("en-NG");
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";

export default function AdsSimulator({
  config,
  campaign,
  onCampaignChange,
  runs,
  onRun,
  onSubmit,
  submitLabel = "Submit this run",
  maxRuns,
}: {
  config: SimConfig;
  campaign: Campaign;
  onCampaignChange: (campaign: Campaign) => void;
  runs: SimRun[];
  /** Runs the campaign; resolves with an error message on failure. */
  onRun: (campaign: Campaign) => Promise<string | null>;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel?: string;
  /** Omit for unlimited (admin test runs). */
  maxRuns?: number;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const set = (patch: Partial<Campaign>) => onCampaignChange({ ...campaign, ...patch });
  const toggle = <T extends string>(list: T[], item: T) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const size = useMemo(() => audienceSize(campaign), [campaign]);
  const problems = campaignProblems(campaign, config);
  const runsLeft = maxRuns === undefined ? null : Math.max(0, maxRuns - runs.length);
  const shownIndex = selected ?? runs.length - 1;
  const shown = runs[shownIndex];

  async function run() {
    setRunning(true);
    setError(null);
    const failure = await onRun(campaign);
    setRunning(false);
    if (failure) setError(failure);
    else setSelected(null);
  }

  const steps = [
    { label: "1. Campaign", icon: Megaphone },
    { label: "2. Audience", icon: Users },
    { label: "3. Ad", icon: ImageIcon },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
          The client
        </p>
        <h2 className="mt-1 text-sm font-bold text-[#1C1D52]">{config.business.name}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">{config.business.description}</p>
        <p className="mt-2 text-xs text-slate-600">
          <strong className="text-[#1C1D52]">Selling:</strong> {config.product.name} ·{" "}
          {naira(config.product.price)} {config.conversionEvent === "SALES" ? "per sale" : "value per lead"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {config.goals.map((goal, index) => (
            <span key={index} className="inline-flex items-center gap-1 rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-semibold text-[#1C1D52]">
              <Target className="h-3 w-3" />
              {GOAL_METRICS[goal.metric].label} {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"}{" "}
              {formatGoalValue(goal.metric, goal.value)}
            </span>
          ))}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
            Budget limit {naira(config.maxTotalBudget)}
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <div className="flex flex-wrap gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setStep(index as 0 | 1 | 2)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${step === index ? "bg-[#1C1D52] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
          </div>

          {step === 0 && (
            <div className="mt-5 space-y-4">
              <Field label="Campaign name">
                <input value={campaign.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
              </Field>
              <div>
                <Label>Objective</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(OBJECTIVES) as Objective[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set({ objective: key })}
                      className={`rounded-xl border p-3 text-left ${campaign.objective === key ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}
                    >
                      <strong className="block text-xs text-[#1C1D52]">{OBJECTIVES[key].label}</strong>
                      <span className="mt-0.5 block text-[10px] text-slate-500">{OBJECTIVES[key].help}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Daily budget (₦)">
                  <input type="number" min={1000} step={500} value={campaign.dailyBudget} onChange={(e) => set({ dailyBudget: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="Number of days">
                  <input type="number" min={1} max={30} value={campaign.days} onChange={(e) => set({ days: Number(e.target.value) })} className={inputClass} />
                </Field>
              </div>
              <p className="text-[11px] text-slate-500">
                Total: <strong className="text-[#1C1D52]">{naira(campaign.dailyBudget * campaign.days)}</strong> of your {naira(config.maxTotalBudget)} limit
              </p>
              <Field label="Bidding">
                <select value={campaign.bidding} onChange={(e) => set({ bidding: e.target.value as Bidding, bidAmount: e.target.value === "LOWEST_COST" ? null : (campaign.bidAmount ?? 1000) })} className={inputClass}>
                  {(Object.keys(BIDDING) as Bidding[]).map((key) => (
                    <option key={key} value={key}>{BIDDING[key].label}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] text-slate-500">{BIDDING[campaign.bidding].help}</span>
              </Field>
              {campaign.bidding !== "LOWEST_COST" && (
                <Field label={campaign.bidding === "COST_CAP" ? "Cap per result (₦)" : "Max bid per 1,000 views (₦)"}>
                  <input type="number" min={1} value={campaign.bidAmount ?? 0} onChange={(e) => set({ bidAmount: Number(e.target.value) })} className={inputClass} />
                </Field>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="mt-5 space-y-4">
              <div>
                <Label>Locations</Label>
                <Chips options={LOCATIONS.map((l) => ({ id: l.id, label: l.name }))} selected={campaign.locations} onToggle={(id) => set({ locations: toggle(campaign.locations, id) })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Age from">
                  <input type="number" min={13} max={65} value={campaign.ageMin} onChange={(e) => set({ ageMin: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="Age to (65 = 65+)">
                  <input type="number" min={13} max={65} value={campaign.ageMax} onChange={(e) => set({ ageMax: Number(e.target.value) })} className={inputClass} />
                </Field>
                <Field label="Gender">
                  <select value={campaign.gender} onChange={(e) => set({ gender: e.target.value as Gender })} className={inputClass}>
                    <option value="ALL">Everyone</option>
                    <option value="WOMEN">Women</option>
                    <option value="MEN">Men</option>
                  </select>
                </Field>
              </div>
              <div>
                <Label>Interests (people interested in any of these; none = broad)</Label>
                <Chips options={INTERESTS.map((i) => ({ id: i, label: i }))} selected={campaign.interests} onToggle={(id) => set({ interests: toggle(campaign.interests, id).slice(0, 10) })} />
              </div>
              <div>
                <Label>Placements</Label>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(PLACEMENTS) as Placement[]).map((key) => (
                    <label key={key} className="inline-flex items-center gap-1.5 text-xs text-[#1C1D52]">
                      <input type="checkbox" className="accent-[#5FBB46]" checked={campaign.placements.includes(key)} onChange={() => set({ placements: toggle(campaign.placements, key) })} />
                      {PLACEMENTS[key].label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#f8fbff] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Estimated audience</p>
                <p className="mt-1 text-lg font-bold text-[#1C1D52]">{campaign.locations.length ? `${count(size)} people` : "Choose a location"}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${size < 200_000 ? "bg-amber-400" : size > 8_000_000 ? "bg-sky-400" : "bg-[#5FBB46]"}`} style={{ width: `${Math.min(100, Math.max(4, (Math.log10(Math.max(size, 1)) - 3) * 22))}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {size < 200_000 ? "Specific: cheaper to waste less, but views cost more and people see it repeatedly." : size > 8_000_000 ? "Very broad: cheap views, but many won't be interested." : "A healthy size for most campaigns."}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-5 space-y-4">
              <Field label="Format">
                <select value={campaign.format} onChange={(e) => set({ format: e.target.value as AdFormat })} className={inputClass}>
                  {(Object.keys(FORMATS) as AdFormat[]).map((key) => (
                    <option key={key} value={key}>{FORMATS[key]}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Primary text (${campaign.primaryText.length}/600)`}>
                <textarea value={campaign.primaryText} rows={4} maxLength={600} onChange={(e) => set({ primaryText: e.target.value })} placeholder="What you'd say to the customer: the benefit, the offer, why now." className={inputClass} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Headline (${campaign.headline.length}/80)`}>
                  <input value={campaign.headline} maxLength={80} onChange={(e) => set({ headline: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Button">
                  <select value={campaign.cta} onChange={(e) => set({ cta: e.target.value })} className={inputClass}>
                    {CALLS_TO_ACTION.map((cta) => (
                      <option key={cta} value={cta}>{cta}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Description (optional)">
                <input value={campaign.description} maxLength={120} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Describe the image or video">
                <textarea value={campaign.visual} rows={3} maxLength={400} onChange={(e) => set({ visual: e.target.value })} placeholder="e.g. Close-up of steaming jollof with plantain, our rider handing over a bag, bright Lagos street." className={inputClass} />
              </Field>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Ad preview</p>
          <AdPreview campaign={campaign} businessName={config.business.name} />
        </aside>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || problems.length > 0 || runsLeft === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running your campaign…" : "Run campaign"}
        </button>
        {runsLeft !== null && (
          <span className="text-xs text-slate-500">
            {runsLeft} of {maxRuns} runs left
          </span>
        )}
        {problems.length > 0 && (
          <ul className="w-full list-disc pl-5 text-[11px] text-amber-700">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {error && <p className="w-full text-xs font-semibold text-red-600" role="alert">{error}</p>}
      </section>

      {shown && (
        <Results
          runs={runs}
          shownIndex={shownIndex}
          onSelect={setSelected}
          onSubmit={
            onSubmit
              ? async (index) => {
                  setSubmitting(true);
                  try {
                    await onSubmit(index);
                  } finally {
                    setSubmitting(false);
                  }
                }
              : undefined
          }
          submitting={submitting}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-[#5FBB46] bg-[#f4faf2] font-semibold text-[#1C1D52]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A generic sponsored-post mock-up (not any real platform's design). */
function AdPreview({ campaign, businessName }: { campaign: Campaign; businessName: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1D52] text-xs font-bold text-white">
          {businessName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-xs font-bold text-[#1C1D52]">{businessName}</p>
          <p className="text-[10px] text-slate-400">Sponsored</p>
        </div>
      </div>
      <p className="whitespace-pre-line px-3 pb-2 text-xs leading-5 text-slate-700">
        {campaign.primaryText || <span className="text-slate-300">Your primary text appears here.</span>}
      </p>
      <div className="relative flex aspect-square items-center justify-center bg-gradient-to-br from-[#1C1D52] to-[#5FBB46] p-5 text-center">
        <span className="absolute left-2 top-2 rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
          {FORMATS[campaign.format]}
        </span>
        <p className="text-xs italic leading-5 text-white/90">
          {campaign.visual || "Describe your image or video in step 3."}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-[#1C1D52]">{campaign.headline || "Your headline"}</p>
          {campaign.description && <p className="truncate text-[10px] text-slate-500">{campaign.description}</p>}
        </div>
        <span className="shrink-0 rounded-md bg-[#1C1D52] px-3 py-1.5 text-[10px] font-bold text-white">{campaign.cta}</span>
      </div>
    </div>
  );
}

function Results({
  runs,
  shownIndex,
  onSelect,
  onSubmit,
  submitting,
  submitLabel,
}: {
  runs: SimRun[];
  shownIndex: number;
  onSelect: (index: number) => void;
  onSubmit?: (index: number) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}) {
  const run = runs[shownIndex];
  const { totals, goals, daily, ratings, notes, score } = run.result;
  const best = runs.reduce((bestIndex, item, index) => (item.result.score > runs[bestIndex].result.score ? index : bestIndex), 0);
  const maxConversions = Math.max(1, ...daily.map((day) => day.conversions));
  const maxClicks = Math.max(1, ...daily.map((day) => day.clicks));
  const stats: Array<[string, string]> = [
    ["Spend", `${naira(totals.spend)} of ${naira(totals.plannedBudget)}`],
    ["Audience size", count(totals.audienceSize)],
    ["People reached", count(totals.reach)],
    ["Frequency", `${totals.frequency}×`],
    ["Impressions", count(totals.impressions)],
    ["Cost per 1,000 views", naira(totals.cpm)],
    ["Link clicks", count(totals.clicks)],
    ["Click-through rate", `${totals.ctr}%`],
    ["Cost per click", naira(totals.cpc)],
    ["Conversions", count(totals.conversions)],
    ["Cost per conversion", totals.conversions ? naira(totals.costPerConversion) : "—"],
    ["Revenue", naira(totals.revenue)],
    ["ROAS", `${totals.roas}×`],
  ];

  return (
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
              Run {index + 1} · {item.result.score}
              {index === best && runs.length > 1 ? " ★" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#1C1D52] p-4 text-white">
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-[#5FBB46]">
          <span className="text-xl font-bold">{score}</span>
          <span className="text-[9px] text-white/60">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/70">{run.campaign.name} · {OBJECTIVES[run.campaign.objective].label}</p>
          <p className="mt-1 text-sm">{run.feedback.summary}</p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal, index) => (
          <li key={index} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${goal.met ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}>
            {goal.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {goal.label}: <strong>{formatGoalValue(goal.metric, goal.actual)}</strong>
              <span className="block text-[10px] opacity-75">target {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"} {formatGoalValue(goal.metric, goal.target)}</span>
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
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Day by day (clicks ▮ and conversions ▮)</p>
        <div className="flex h-36 items-end gap-1.5 overflow-x-auto rounded-xl bg-[#f8fbff] p-3">
          {daily.map((day) => (
            <div key={day.day} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end justify-center gap-0.5">
                <div className="w-2.5 rounded-t bg-sky-300" style={{ height: `${(day.clicks / maxClicks) * 100}%` }} title={`${day.clicks} clicks`} />
                <div className="w-2.5 rounded-t bg-[#5FBB46]" style={{ height: `${(day.conversions / maxConversions) * 100}%` }} title={`${day.conversions} conversions`} />
              </div>
              <span className="text-[9px] text-slate-500">D{day.day}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">The first days are weaker while the ad system learns who responds.</p>
      </div>

      {notes.length > 0 && (
        <ul className="list-disc space-y-1 rounded-xl bg-amber-50 py-3 pl-8 pr-4 text-xs text-amber-800">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Rating label="Audience fit" value={ratings.audienceFit} />
        <Rating label="Ad quality" value={ratings.creative} />
        <Rating label="Objective fit" value={ratings.objectiveFit} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Advice title="Targeting" items={run.feedback.targeting} />
        <Advice title="The ad" items={run.feedback.creative} />
        <Advice title="Budget & bidding" items={run.feedback.budget} />
      </div>
      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <Sparkles className="h-3 w-3" />
        {ratings.source === "ai" ? "Plan judged by AI." : "Plan judged by simple rules."} Results come from a training simulation, not real ads.
      </p>

      {onSubmit && (
        <button
          type="button"
          onClick={() => void onSubmit(shownIndex)}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Submitting…" : `${submitLabel} (run ${shownIndex + 1})`}
        </button>
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
        <p className="mt-1.5 text-[11px] text-slate-400">Nothing to change here.</p>
      )}
    </div>
  );
}
