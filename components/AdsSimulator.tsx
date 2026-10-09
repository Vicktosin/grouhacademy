"use client";

import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderOpen,
  ImageIcon,
  ImagePlus,
  Info,
  Layers,
  Loader2,
  Megaphone,
  PencilLine,
  Play,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  activePlacements,
  adSetAudienceSize,
  adSetPlannedSpend,
  allAds,
  BID_STRATEGIES,
  blankAdSet,
  blankCreative,
  CALLS_TO_ACTION,
  campaignDays,
  campaignProblems,
  copyAd,
  copyAdSet,
  CUSTOM_AUDIENCES,
  DELIVERY,
  DESTINATIONS,
  FORMATS,
  formatGoalValue,
  GOAL_METRICS,
  goalsFor,
  INTERESTS,
  LOCATIONS,
  LOOKALIKES,
  MAX_AD_SETS,
  MAX_CARDS,
  MAX_CREATIVES,
  MAX_TOTAL_ADS,
  normalizeRunResult,
  OBJECTIVE_DESTINATIONS,
  OBJECTIVES,
  parseCampaign,
  PERFORMANCE_GOALS,
  PLACEMENTS,
  plannedSpend,
  SPECIAL_CATEGORIES,
  withObjective,
  type AdFormat,
  type AdSet,
  type AdSetAudience,
  type BidStrategy,
  type BreakdownRow,
  type Budget,
  type Campaign,
  type Creative,
  type CustomAudience,
  type Delivery,
  type Destination,
  type Gender,
  type GoalTarget,
  type Metrics,
  type Objective,
  type PerformanceGoal,
  type Placement,
  type RunResult,
  type SpecialCategory,
} from "@/lib/ads-sim/model";
import { mediaSrc, shrinkImage } from "@/lib/lab-media-shared";
import type { AdFeedback } from "@/lib/ads-sim/evaluate";

// Grouh Ads Studio: a practice ads manager. Interns build a campaign the way
// real ad platforms structure one (campaign → ad sets → ads), publish it to
// the simulator, and read an ads-manager-style report with breakdowns. Our
// own design and names: modelled on how ad platforms work, not a copy of
// any, and not affiliated with them (see the notice at the top).

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
  hasApp?: boolean;
  goals: GoalTarget[];
  maxRuns: number;
  maxTotalBudget: number;
};

type Selection = { level: "campaign" } | { level: "adset"; setId: string } | { level: "ad"; setId: string; adId: string };

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
const count = (value: number) => Math.round(value).toLocaleString("en-NG");
const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";
const card = "rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]";

export function StudioNotice() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] leading-5 text-sky-900">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Grouh Ads Studio is a practice tool for learning.</strong> It works like the ads managers of the big social
        platforms, but it isn&apos;t affiliated with or endorsed by Meta, Facebook, Instagram or any ad platform. No real ads
        run and no money is spent. To run real ads, use the platform&apos;s own ads manager.
      </span>
    </p>
  );
}

export default function AdsSimulator({
  config,
  campaign,
  onCampaignChange,
  runs,
  onRun,
  onSubmit,
  submitLabel = "Submit this run",
  maxRuns,
  mediaEnabled = false,
}: {
  config: SimConfig;
  campaign: Campaign;
  onCampaignChange: (campaign: Campaign) => void;
  runs: SimRun[];
  /** Runs (publishes) the campaign; resolves with an error message on failure. */
  onRun: (campaign: Campaign) => Promise<string | null>;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel?: string;
  /** Omit for unlimited (admin test runs). */
  maxRuns?: number;
  /** Whether images can be uploaded (file storage is set up). */
  mediaEnabled?: boolean;
}) {
  const [mode, setMode] = useState<"edit" | "results">(runs.length ? "results" : "edit");
  const [selection, setSelection] = useState<Selection>({ level: "campaign" });
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [showProblems, setShowProblems] = useState(false);

  const set = (patch: Partial<Campaign>) => onCampaignChange({ ...campaign, ...patch });
  const setAdSet = (id: string, patch: Partial<AdSet>) =>
    set({ adSets: campaign.adSets.map((item) => (item.id === id ? { ...item, ...patch } : item)) });

  const problems = campaignProblems(campaign, { maxTotalBudget: config.maxTotalBudget, hasApp: config.hasApp ?? false });
  const runsLeft = maxRuns === undefined ? null : Math.max(0, maxRuns - runs.length);
  const shownIndex = selectedRun ?? runs.length - 1;

  // What's selected (falling back to the campaign if it was deleted).
  const selectedSet =
    selection.level !== "campaign" ? campaign.adSets.find((item) => item.id === selection.setId) : undefined;
  const selectedAd = selection.level === "ad" ? selectedSet?.ads.find((ad) => ad.id === selection.adId) : undefined;
  const level = selection.level === "ad" && selectedAd ? "ad" : selection.level !== "campaign" && selectedSet ? "adset" : "campaign";
  const previewAd = selectedAd ?? selectedSet?.ads[0] ?? campaign.adSets[0]?.ads[0];

  async function publish() {
    setRunning(true);
    setError(null);
    const failure = await onRun(campaign);
    setRunning(false);
    if (failure) setError(failure);
    else {
      setSelectedRun(null);
      setMode("results");
    }
  }

  // Tree actions.
  const addAdSet = () => {
    if (campaign.adSets.length >= MAX_AD_SETS) return;
    const fresh = blankAdSet(campaign.adSets.length, campaign.objective);
    // Start from the first ad set's audience: usually a variation of it.
    const first = campaign.adSets[0];
    const next = first ? { ...fresh, audience: { ...first.audience, locations: [...first.audience.locations] } } : fresh;
    set({ adSets: [...campaign.adSets, next] });
    setSelection({ level: "adset", setId: next.id });
  };
  const duplicateAdSet = (target: AdSet) => {
    if (campaign.adSets.length >= MAX_AD_SETS || allAds(campaign).length + target.ads.length > MAX_TOTAL_ADS) return;
    const copy = copyAdSet(target, campaign.adSets.length);
    set({ adSets: [...campaign.adSets, copy] });
    setSelection({ level: "adset", setId: copy.id });
  };
  const deleteAdSet = (target: AdSet) => {
    if (campaign.adSets.length === 1 || !window.confirm(`Delete ${target.name} and its ads?`)) return;
    set({ adSets: campaign.adSets.filter((item) => item.id !== target.id), abTest: campaign.adSets.length > 2 && campaign.abTest });
    setSelection({ level: "campaign" });
  };
  const addAd = (target: AdSet, copyOf?: Creative) => {
    if (target.ads.length >= MAX_CREATIVES || allAds(campaign).length >= MAX_TOTAL_ADS) return;
    const ad = copyOf ? copyAd(copyOf, target.ads.length) : blankCreative(target.ads.length);
    setAdSet(target.id, { ads: [...target.ads, ad] });
    setSelection({ level: "ad", setId: target.id, adId: ad.id });
  };
  const deleteAd = (target: AdSet, ad: Creative) => {
    if (target.ads.length === 1 || !window.confirm(`Delete ${ad.name}?`)) return;
    setAdSet(target.id, { ads: target.ads.filter((item) => item.id !== ad.id) });
    setSelection({ level: "adset", setId: target.id });
  };

  return (
    <div className="space-y-4" data-ads-studio>
      <StudioNotice />
      <ClientBrief config={config} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold ${mode === "edit" ? "bg-[#1C1D52] text-white" : "bg-white text-slate-600 shadow-sm"}`}
        >
          <PencilLine className="h-3.5 w-3.5" /> Edit campaign
        </button>
        <button
          type="button"
          disabled={!runs.length}
          onClick={() => setMode("results")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold disabled:opacity-40 ${mode === "results" ? "bg-[#1C1D52] text-white" : "bg-white text-slate-600 shadow-sm"}`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Results{runs.length ? ` (${runs.length})` : ""}
        </button>
      </div>

      {mode === "edit" ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_300px]">
            <CampaignTree
              campaign={campaign}
              selection={selection}
              level={level}
              onSelect={setSelection}
              onAddAdSet={addAdSet}
              onDuplicateAdSet={duplicateAdSet}
              onDeleteAdSet={deleteAdSet}
              onAddAd={addAd}
              onDeleteAd={deleteAd}
            />

            <section className={`${card} min-w-0`}>
              {level === "campaign" && <CampaignEditor campaign={campaign} config={config} onChange={onCampaignChange} />}
              {level === "adset" && selectedSet && (
                <AdSetEditor
                  campaign={campaign}
                  adSet={selectedSet}
                  hasApp={config.hasApp ?? false}
                  onChange={(patch) => setAdSet(selectedSet.id, patch)}
                />
              )}
              {level === "ad" && selectedSet && selectedAd && (
                <AdEditor
                  ad={selectedAd}
                  mediaEnabled={mediaEnabled}
                  onChange={(patch) =>
                    setAdSet(selectedSet.id, {
                      ads: selectedSet.ads.map((item) => (item.id === selectedAd.id ? { ...item, ...patch } : item)),
                    })
                  }
                />
              )}
            </section>

            <aside className="min-w-0 space-y-3 lg:col-span-2 xl:col-span-1">
              {level === "adset" && selectedSet ? (
                <AudienceMeter adSet={selectedSet} />
              ) : level === "campaign" ? (
                <CampaignSummary campaign={campaign} limit={config.maxTotalBudget} />
              ) : null}
              {previewAd && (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Ad preview · {previewAd.name}</p>
                  <AdPreview ad={previewAd} businessName={config.business.name} />
                </>
              )}
            </aside>
          </div>

          <section className={`${card} flex flex-wrap items-center gap-3 p-4!`}>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={running || problems.length > 0 || runsLeft === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f] disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Running your campaign…" : "Publish to the simulator"}
            </button>
            <span className="text-xs text-slate-500">
              {naira(plannedSpend(campaign))} planned of {naira(config.maxTotalBudget)}
              {runsLeft !== null && ` · ${runsLeft} of ${maxRuns} runs left`}
            </span>
            {problems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowProblems(!showProblems)}
                className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800"
              >
                {problems.length} thing{problems.length === 1 ? "" : "s"} to fix {showProblems ? "▴" : "▾"}
              </button>
            )}
            {problems.length > 0 && showProblems && (
              <ul className="w-full list-disc pl-5 text-[11px] text-amber-800">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {error && (
              <p className="w-full text-xs font-semibold text-red-600" role="alert">
                {error}
              </p>
            )}
          </section>
        </>
      ) : (
        runs[shownIndex] && (
          <Results
            runs={runs}
            shownIndex={shownIndex}
            price={config.product.price}
            onSelect={setSelectedRun}
            onEdit={() => setMode("edit")}
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
        )
      )}
    </div>
  );
}

function ClientBrief({ config }: { config: SimConfig }) {
  return (
    <section className={card}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">The client</p>
      <h2 className="mt-1 text-sm font-bold text-[#1C1D52]">{config.business.name}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">{config.business.description}</p>
      <p className="mt-2 text-xs text-slate-600">
        <strong className="text-[#1C1D52]">Selling:</strong> {config.product.name} · {naira(config.product.price)}{" "}
        {config.conversionEvent === "SALES" ? "per sale" : "value per lead"}
        {config.hasApp === false && " · no app"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {config.goals.map((goal, index) => (
          <span key={index} className="inline-flex items-center gap-1 rounded-full bg-[#eef3ff] px-2.5 py-1 text-[10px] font-semibold text-[#1C1D52]">
            <Target className="h-3 w-3" />
            {GOAL_METRICS[goal.metric].label} {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"} {formatGoalValue(goal.metric, goal.value)}
          </span>
        ))}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          Practice budget {naira(config.maxTotalBudget)} (no billing needed)
        </span>
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{children}</span>;
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {help && <span className="mt-1 block text-[10px] leading-4 text-slate-500">{help}</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Megaphone; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-bold text-[#1C1D52]">
      <Icon className="h-4 w-4 text-[#5FBB46]" /> {children}
    </h3>
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

const toggle = <T extends string>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

// --------------------------------------------------------------- the tree

function CampaignTree({
  campaign,
  selection,
  level,
  onSelect,
  onAddAdSet,
  onDuplicateAdSet,
  onDeleteAdSet,
  onAddAd,
  onDeleteAd,
}: {
  campaign: Campaign;
  selection: Selection;
  level: "campaign" | "adset" | "ad";
  onSelect: (selection: Selection) => void;
  onAddAdSet: () => void;
  onDuplicateAdSet: (set: AdSet) => void;
  onDeleteAdSet: (set: AdSet) => void;
  onAddAd: (set: AdSet, copyOf?: Creative) => void;
  onDeleteAd: (set: AdSet, ad: Creative) => void;
}) {
  const totalAds = allAds(campaign).length;
  const isSelected = (s: Selection) =>
    s.level === level &&
    (s.level === "campaign" ||
      (s.level === "adset" && selection.level !== "campaign" && selection.setId === s.setId) ||
      (s.level === "ad" && selection.level === "ad" && selection.adId === s.adId));
  const row = (active: boolean) =>
    `flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${active ? "bg-[#1C1D52] text-white" : "text-[#1C1D52] hover:bg-slate-100"}`;
  const iconButton = "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#1C1D52] disabled:opacity-30";

  return (
    <nav aria-label="Campaign structure" className={`${card} h-fit p-3!`}>
      <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Campaign structure</p>
      <button type="button" onClick={() => onSelect({ level: "campaign" })} className={row(isSelected({ level: "campaign" }))}>
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="truncate font-semibold">{campaign.name || "Campaign"}</span>
      </button>
      <ul className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2">
        {campaign.adSets.map((set) => (
          <li key={set.id}>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => onSelect({ level: "adset", setId: set.id })} className={row(isSelected({ level: "adset", setId: set.id }))}>
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{set.name}</span>
              </button>
              <button
                type="button"
                title="Duplicate ad set"
                aria-label={`Duplicate ${set.name}`}
                disabled={campaign.adSets.length >= MAX_AD_SETS || totalAds + set.ads.length > MAX_TOTAL_ADS}
                onClick={() => onDuplicateAdSet(set)}
                className={iconButton}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Delete ad set"
                aria-label={`Delete ${set.name}`}
                disabled={campaign.adSets.length === 1}
                onClick={() => onDeleteAdSet(set)}
                className={iconButton}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
              {set.ads.map((ad) => (
                <li key={ad.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onSelect({ level: "ad", setId: set.id, adId: ad.id })}
                    className={row(isSelected({ level: "ad", setId: set.id, adId: ad.id }))}
                  >
                    <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{ad.name}</span>
                  </button>
                  <button
                    type="button"
                    title="Duplicate ad"
                    aria-label={`Duplicate ${ad.name}`}
                    disabled={set.ads.length >= MAX_CREATIVES || totalAds >= MAX_TOTAL_ADS}
                    onClick={() => onAddAd(set, ad)}
                    className={iconButton}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete ad"
                    aria-label={`Delete ${ad.name}`}
                    disabled={set.ads.length === 1}
                    onClick={() => onDeleteAd(set, ad)}
                    className={iconButton}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  disabled={set.ads.length >= MAX_CREATIVES || totalAds >= MAX_TOTAL_ADS}
                  onClick={() => onAddAd(set)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#397d3a] hover:bg-[#f4faf2] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> New ad
                </button>
              </li>
            </ul>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={campaign.adSets.length >= MAX_AD_SETS}
            onClick={onAddAdSet}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#397d3a] hover:bg-[#f4faf2] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> New ad set
          </button>
        </li>
      </ul>
      <p className="mt-3 px-2 text-[10px] leading-4 text-slate-400">
        Up to {MAX_AD_SETS} ad sets, {MAX_CREATIVES} ads each, {MAX_TOTAL_ADS} ads in all.
      </p>
    </nav>
  );
}

// ------------------------------------------------------------ the campaign

function BudgetFields({ budget, days, onChange }: { budget: Budget; days: number; onChange: (budget: Budget) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Budget">
        <select value={budget.type} onChange={(e) => onChange({ ...budget, type: e.target.value as Budget["type"] })} className={inputClass}>
          <option value="DAILY">Daily budget</option>
          <option value="LIFETIME">Lifetime budget</option>
        </select>
      </Field>
      <Field
        label={budget.type === "DAILY" ? "Amount per day (₦)" : "Amount in total (₦)"}
        help={budget.type === "DAILY" ? `About ${naira(budget.amount * days)} over ${days} day${days === 1 ? "" : "s"}.` : `About ${naira(budget.amount / Math.max(1, days))} a day.`}
      >
        <input type="number" min={0} step={500} value={budget.amount} onChange={(e) => onChange({ ...budget, amount: Number(e.target.value) })} className={inputClass} />
      </Field>
    </div>
  );
}

function BidFields({
  strategy,
  amount,
  objective,
  onChange,
}: {
  strategy: BidStrategy;
  amount: number | null;
  objective: Objective;
  onChange: (strategy: BidStrategy, amount: number | null) => void;
}) {
  const options = (Object.keys(BID_STRATEGIES) as BidStrategy[]).filter((key) => key !== "ROAS_GOAL" || objective === "SALES");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Bid strategy" help={BID_STRATEGIES[strategy].help}>
        <select
          value={strategy}
          onChange={(e) => {
            const next = e.target.value as BidStrategy;
            onChange(next, next === "HIGHEST_VOLUME" ? null : next === "ROAS_GOAL" ? 2 : (amount ?? 1500));
          }}
          className={inputClass}
        >
          {options.map((key) => (
            <option key={key} value={key}>
              {BID_STRATEGIES[key].label}
            </option>
          ))}
        </select>
      </Field>
      {strategy !== "HIGHEST_VOLUME" && (
        <Field label={BID_STRATEGIES[strategy].amount ?? "Amount"}>
          <input
            type="number"
            min={0}
            step={strategy === "ROAS_GOAL" ? 0.1 : 50}
            value={amount ?? 0}
            onChange={(e) => onChange(strategy, Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      )}
    </div>
  );
}

function CampaignEditor({ campaign, config, onChange }: { campaign: Campaign; config: SimConfig; onChange: (campaign: Campaign) => void }) {
  const set = (patch: Partial<Campaign>) => onChange({ ...campaign, ...patch });
  const days = campaignDays(campaign);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">Campaign</p>
        <p className="mt-1 text-[11px] text-slate-500">The objective and money for everything inside it.</p>
      </div>
      <Field label="Campaign name">
        <input value={campaign.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
      </Field>

      <div className="space-y-2">
        <SectionTitle icon={Target}>Campaign objective</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(OBJECTIVES) as Objective[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => key !== campaign.objective && onChange(withObjective(campaign, key))}
              className={`rounded-xl border p-3 text-left ${campaign.objective === key ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <strong className="block text-xs text-[#1C1D52]">{OBJECTIVES[key].label}</strong>
              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{OBJECTIVES[key].help}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle icon={Info}>Special ad categories</SectionTitle>
        <Field
          label="Declare a category if the ads are about one of these"
          help={`${SPECIAL_CATEGORIES[campaign.specialCategory].help} Ads in these categories must be declared, and their targeting is restricted (ages 18–65+, all genders, no interests or lookalikes). Undeclared ads in a category get rejected.`}
        >
          <select value={campaign.specialCategory} onChange={(e) => set({ specialCategory: e.target.value as SpecialCategory })} className={inputClass}>
            {(Object.keys(SPECIAL_CATEGORIES) as SpecialCategory[]).map((key) => (
              <option key={key} value={key}>
                {SPECIAL_CATEGORIES[key].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={BarChart3}>Budget</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["AD_SET", "Ad set budgets", "Set a budget on each ad set. You control exactly where money goes."],
              ["CAMPAIGN", "Campaign budget", "One budget for the campaign; the system moves money to the ad sets doing best."],
            ] as const
          ).map(([key, label, help]) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ budgetMode: key, ...(key === "CAMPAIGN" ? { abTest: false } : {}) })}
              className={`rounded-xl border p-3 text-left ${campaign.budgetMode === key ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <strong className="block text-xs text-[#1C1D52]">{label}</strong>
              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{help}</span>
            </button>
          ))}
        </div>
        {campaign.budgetMode === "CAMPAIGN" && (
          <>
            <BudgetFields budget={campaign.budget} days={days} onChange={(budget) => set({ budget })} />
            <BidFields
              strategy={campaign.bidStrategy}
              amount={campaign.bidAmount}
              objective={campaign.objective}
              onChange={(bidStrategy, bidAmount) => set({ bidStrategy, bidAmount })}
            />
          </>
        )}
        <p className="text-[11px] text-slate-500">
          Planned spend: <strong className="text-[#1C1D52]">{naira(plannedSpend(campaign))}</strong> of your practice budget of{" "}
          {naira(config.maxTotalBudget)}.
        </p>
      </div>

      <div className="space-y-2">
        <SectionTitle icon={Trophy}>A/B test</SectionTitle>
        <label className="flex items-start gap-2 text-xs text-[#1C1D52]">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#5FBB46]"
            checked={campaign.abTest}
            disabled={campaign.adSets.length < 2}
            onChange={(e) => set({ abTest: e.target.checked, ...(e.target.checked ? { budgetMode: "AD_SET" as const } : {}) })}
          />
          <span>
            Compare the ad sets in an A/B test
            <span className="block text-[10px] leading-4 text-slate-500">
              {campaign.adSets.length < 2
                ? "Add a second ad set (e.g. a different audience) to test one against the other."
                : "The audience is split so each person sees only one ad set; each keeps its own budget. Change one thing between them (audience, placement or ads) to learn what works."}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function CampaignSummary({ campaign, limit }: { campaign: Campaign; limit: number }) {
  const total = plannedSpend(campaign);
  return (
    <div className="rounded-2xl bg-white p-4 text-xs text-slate-600 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Summary</p>
      <ul className="mt-2 space-y-1">
        <li>
          <strong className="text-[#1C1D52]">{OBJECTIVES[campaign.objective].label}</strong> campaign
        </li>
        <li>
          {campaign.adSets.length} ad set{campaign.adSets.length === 1 ? "" : "s"} · {allAds(campaign).length} ad
          {allAds(campaign).length === 1 ? "" : "s"}
        </li>
        <li>{campaign.budgetMode === "CAMPAIGN" ? "Campaign budget" : "Ad set budgets"}</li>
        <li>
          {naira(total)} over up to {campaignDays(campaign)} days
        </li>
      </ul>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${total > limit ? "bg-red-400" : "bg-[#5FBB46]"}`} style={{ width: `${Math.min(100, (total / Math.max(1, limit)) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">of the {naira(limit)} practice budget</p>
    </div>
  );
}

// -------------------------------------------------------------- the ad set

function AdSetEditor({
  campaign,
  adSet,
  hasApp,
  onChange,
}: {
  campaign: Campaign;
  adSet: AdSet;
  hasApp: boolean;
  onChange: (patch: Partial<AdSet>) => void;
}) {
  const a = adSet.audience;
  const setAudience = (patch: Partial<AdSetAudience>) => onChange({ audience: { ...a, ...patch } });
  const destinations = OBJECTIVE_DESTINATIONS[campaign.objective];
  const goals = goalsFor(campaign.objective, adSet.destination);
  const special = campaign.specialCategory !== "NONE";
  const warm = a.custom.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">Ad set</p>
        <p className="mt-1 text-[11px] text-slate-500">Who sees the ads, where, when, and for how much.</p>
      </div>
      <Field label="Ad set name">
        <input value={adSet.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </Field>

      <div className="space-y-3">
        <SectionTitle icon={Target}>Conversion and performance goal</SectionTitle>
        {destinations.length > 0 ? (
          <Field label="Conversion location" help={adSet.destination ? DESTINATIONS[adSet.destination].help : undefined}>
            <select
              value={adSet.destination ?? ""}
              onChange={(e) => {
                const destination = e.target.value as Destination;
                const options = goalsFor(campaign.objective, destination);
                onChange({ destination, performanceGoal: options.includes(adSet.performanceGoal) ? adSet.performanceGoal : options[0] });
              }}
              className={inputClass}
            >
              {destinations.map((key) => (
                <option key={key} value={key} disabled={key === "APP" && !hasApp}>
                  {DESTINATIONS[key].label}
                  {key === "APP" && !hasApp ? " (this business has no app)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-[11px] text-slate-500">Awareness campaigns show the ad itself; there&apos;s no conversion location.</p>
        )}
        <Field label="Performance goal" help={`Results will count: ${PERFORMANCE_GOALS[adSet.performanceGoal].result.toLowerCase()}.`}>
          <select value={adSet.performanceGoal} onChange={(e) => onChange({ performanceGoal: e.target.value as PerformanceGoal })} className={inputClass}>
            {goals.map((key) => (
              <option key={key} value={key}>
                {PERFORMANCE_GOALS[key].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={BarChart3}>Budget and schedule</SectionTitle>
        {campaign.budgetMode === "AD_SET" ? (
          <>
            <BudgetFields budget={adSet.budget} days={adSet.days} onChange={(budget) => onChange({ budget })} />
            <BidFields
              strategy={adSet.bidStrategy}
              amount={adSet.bidAmount}
              objective={campaign.objective}
              onChange={(bidStrategy, bidAmount) => onChange({ bidStrategy, bidAmount })}
            />
          </>
        ) : (
          <p className="text-[11px] text-slate-500">This campaign uses a campaign budget: the system decides how much this ad set gets.</p>
        )}
        <Field label="Run for (days)" help={campaign.budgetMode === "AD_SET" ? `Spends about ${naira(adSetPlannedSpend(adSet))} in total.` : undefined}>
          <input type="number" min={1} max={30} value={adSet.days} onChange={(e) => onChange({ days: Number(e.target.value) })} className={`${inputClass} sm:w-40`} />
        </Field>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={Users}>Audience</SectionTitle>
        <div>
          <Label>Custom audiences (your own warm audiences)</Label>
          <div className="space-y-1.5">
            {(Object.keys(CUSTOM_AUDIENCES) as CustomAudience[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-xs text-[#1C1D52]">
                <input type="checkbox" className="mt-0.5 accent-[#5FBB46]" checked={a.custom.includes(key)} onChange={() => setAudience({ custom: toggle(a.custom, key) })} />
                <span>
                  {CUSTOM_AUDIENCES[key].label}
                  <span className="block text-[10px] text-slate-500">
                    {CUSTOM_AUDIENCES[key].help} About {count(CUSTOM_AUDIENCES[key].size)} people.
                  </span>
                </span>
              </label>
            ))}
          </div>
          {warm && <p className="mt-1 text-[10px] text-amber-700">With a custom audience, only those people (and any lookalike) see the ads.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lookalike of your customers" help={special ? "Not allowed in special ad categories." : "People similar to past customers. Smaller % = closer match, fewer people."}>
            <select value={a.lookalike} disabled={special} onChange={(e) => setAudience({ lookalike: Number(e.target.value) })} className={inputClass}>
              <option value={0}>None</option>
              {Object.entries(LOOKALIKES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-start gap-2 self-end text-xs text-[#1C1D52]">
            <input type="checkbox" className="mt-0.5 accent-[#5FBB46]" checked={a.excludeCustomers} onChange={(e) => setAudience({ excludeCustomers: e.target.checked })} />
            <span>
              Exclude past customers
              <span className="block text-[10px] text-slate-500">Find new customers only.</span>
            </span>
          </label>
        </div>
        <div>
          <Label>Locations</Label>
          <Chips options={LOCATIONS.map((l) => ({ id: l.id, label: l.name }))} selected={a.locations} onToggle={(id) => setAudience({ locations: toggle(a.locations, id) })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Age from">
            <input type="number" min={13} max={65} value={a.ageMin} onChange={(e) => setAudience({ ageMin: Number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Age to (65 = 65+)">
            <input type="number" min={13} max={65} value={a.ageMax} onChange={(e) => setAudience({ ageMax: Number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Gender">
            <select value={a.gender} onChange={(e) => setAudience({ gender: e.target.value as Gender })} className={inputClass}>
              <option value="ALL">All genders</option>
              <option value="WOMEN">Women</option>
              <option value="MEN">Men</option>
            </select>
          </Field>
        </div>
        <div>
          <Label>Detailed targeting: interests (people interested in any of these)</Label>
          {special ? (
            <p className="text-[11px] text-slate-500">Not available in special ad categories.</p>
          ) : (
            <Chips options={INTERESTS.map((i) => ({ id: i, label: i }))} selected={a.interests} onToggle={(id) => setAudience({ interests: toggle(a.interests, id).slice(0, 10) })} />
          )}
        </div>
        <label className="flex items-start gap-2 text-xs text-[#1C1D52]">
          <input type="checkbox" className="mt-0.5 accent-[#5FBB46]" checked={a.advantage} onChange={(e) => setAudience({ advantage: e.target.checked })} />
          <span>
            Automatic audience
            <span className="block text-[10px] leading-4 text-slate-500">
              Treat your targeting as a suggestion: the system may show ads to people outside it when they&apos;re likely to act.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={Layers}>Placements</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["AUTO", "Automatic placements (recommended)", "The system shows ads wherever they're likely to do best and costs less."],
              ["MANUAL", "Manual placements", "Choose exactly where ads appear."],
            ] as const
          ).map(([key, label, help]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ placementMode: key })}
              className={`rounded-xl border p-3 text-left ${adSet.placementMode === key ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <strong className="block text-xs text-[#1C1D52]">{label}</strong>
              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{help}</span>
            </button>
          ))}
        </div>
        {adSet.placementMode === "MANUAL" && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(PLACEMENTS) as Placement[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-xs text-[#1C1D52]">
                <input type="checkbox" className="mt-0.5 accent-[#5FBB46]" checked={adSet.placements.includes(key)} onChange={() => onChange({ placements: toggle(adSet.placements, key) })} />
                <span>
                  {PLACEMENTS[key].label}
                  <span className="block text-[10px] text-slate-500">{PLACEMENTS[key].help}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AudienceMeter({ adSet }: { adSet: AdSet }) {
  const size = adSetAudienceSize(adSet.audience);
  const none = !adSet.audience.locations.length;
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Estimated audience size</p>
      <p className="mt-1 text-lg font-bold text-[#1C1D52]">{none ? "Choose a location" : `${count(size)} people`}</p>
      {!none && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${size < 200_000 ? "bg-amber-400" : size > 8_000_000 ? "bg-sky-400" : "bg-[#5FBB46]"}`}
              style={{ width: `${Math.min(100, Math.max(4, (Math.log10(Math.max(size, 1)) - 3) * 22))}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            {size < 200_000
              ? "Specific: less waste, but views cost more and people see the ads repeatedly."
              : size > 8_000_000
                ? "Very broad: cheap views, but many won't be interested."
                : "A healthy size for most ad sets."}
          </p>
        </>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        Placements: {adSet.placementMode === "AUTO" ? "automatic" : activePlacements(adSet).map((p) => PLACEMENTS[p].label).join(", ")}
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ the ad

function AdEditor({ ad, mediaEnabled, onChange }: { ad: Creative; mediaEnabled: boolean; onChange: (patch: Partial<Creative>) => void }) {
  const changeFormat = (format: AdFormat) =>
    onChange({
      format,
      cards:
        format === "CAROUSEL"
          ? ad.cards.length >= 2
            ? ad.cards
            : [
                { image: ad.image, headline: ad.headline },
                { image: "", headline: "" },
              ]
          : [],
      image: format === "CAROUSEL" ? "" : ad.image || ad.cards[0]?.image || "",
    });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">Ad</p>
        <p className="mt-1 text-[11px] text-slate-500">
          What people see. The system tests the ads in an ad set and spends more on the best, so make them genuinely different.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad name (only you see it)">
          <input value={ad.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Format">
          <select value={ad.format} onChange={(e) => changeFormat(e.target.value as AdFormat)} className={inputClass}>
            {(Object.keys(FORMATS) as AdFormat[]).map((key) => (
              <option key={key} value={key}>
                {FORMATS[key]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {ad.format === "CAROUSEL" ? (
        <div>
          <Label>
            Cards ({ad.cards.length} of {MAX_CARDS})
          </Label>
          <div className="space-y-2">
            {ad.cards.map((item, index) => (
              <div key={index} className="flex gap-3 rounded-xl border border-slate-200 p-2.5">
                <ImagePicker
                  value={item.image}
                  enabled={mediaEnabled}
                  compact
                  onChange={(image) => onChange({ cards: ad.cards.map((c, i) => (i === index ? { ...c, image } : c)) })}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={item.headline}
                    maxLength={60}
                    onChange={(e) => onChange({ cards: ad.cards.map((c, i) => (i === index ? { ...c, headline: e.target.value } : c)) })}
                    placeholder={`Card ${index + 1} headline`}
                    className={inputClass}
                  />
                  {ad.cards.length > 2 && (
                    <button type="button" onClick={() => onChange({ cards: ad.cards.filter((_, i) => i !== index) })} className="text-[10px] font-semibold text-red-600">
                      Remove card
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {ad.cards.length < MAX_CARDS && (
            <button type="button" onClick={() => onChange({ cards: [...ad.cards, { image: "", headline: "" }] })} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1C1D52]">
              <Plus className="h-3.5 w-3.5" /> Add card
            </button>
          )}
        </div>
      ) : (
        <div>
          <Label>{ad.format === "VIDEO" ? "Cover image (the video's first frame)" : "Image"}</Label>
          <ImagePicker value={ad.image} enabled={mediaEnabled} onChange={(image) => onChange({ image })} />
        </div>
      )}

      <Field label={ad.image || ad.cards.some((c) => c.image) ? "What the visual shows (optional, helps reviewers)" : "Describe the visual"}>
        <textarea
          value={ad.visual}
          rows={2}
          maxLength={400}
          onChange={(e) => onChange({ visual: e.target.value })}
          placeholder="e.g. Close-up of steaming jollof with plantain, our rider handing over a bag, bright Lagos street."
          className={inputClass}
        />
      </Field>

      {ad.format === "VIDEO" && (
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label={`Script / storyboard (${ad.script.length}/1200)`}>
            <textarea
              value={ad.script}
              rows={5}
              maxLength={1200}
              onChange={(e) => onChange({ script: e.target.value })}
              placeholder={"0–3s: hook (what stops the scroll)\n3–10s: show the product and the benefit\n10–15s: the offer and what to do next"}
              className={inputClass}
            />
          </Field>
          <Field label="Length (seconds)">
            <input type="number" min={5} max={120} value={ad.seconds} onChange={(e) => onChange({ seconds: Number(e.target.value) })} className={inputClass} />
          </Field>
        </div>
      )}

      <Field label={`Primary text (${ad.primaryText.length}/600)`}>
        <textarea
          value={ad.primaryText}
          rows={4}
          maxLength={600}
          onChange={(e) => onChange({ primaryText: e.target.value })}
          placeholder="What you'd say to the customer: the benefit, the offer, why now."
          className={inputClass}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {ad.format !== "CAROUSEL" && (
          <Field label={`Headline (${ad.headline.length}/80)`}>
            <input value={ad.headline} maxLength={80} onChange={(e) => onChange({ headline: e.target.value })} className={inputClass} />
          </Field>
        )}
        <Field label="Call to action">
          <select value={ad.cta} onChange={(e) => onChange({ cta: e.target.value })} className={inputClass}>
            {CALLS_TO_ACTION.map((cta) => (
              <option key={cta} value={cta}>
                {cta}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description (optional)">
        <input value={ad.description} maxLength={120} onChange={(e) => onChange({ description: e.target.value })} className={inputClass} />
      </Field>
    </div>
  );
}

/** Uploads an image (shrunk in the browser first) and shows it. */
function ImagePicker({
  value,
  onChange,
  enabled,
  compact = false,
}: {
  value: string;
  onChange: (ref: string) => void;
  enabled: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = compact ? "h-20 w-20" : "h-40 w-40";

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { full, thumb } = await shrinkImage(file);
      const form = new FormData();
      form.set("image", full);
      form.set("thumb", thumb);
      const response = await fetch("/api/internship/lab/media", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Upload failed.");
      onChange(body.ref as string);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled && !value)
    return (
      <div className={`${box} flex shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 p-2 text-center text-[10px] text-slate-400`}>
        Image uploads aren&apos;t available yet; describe it below.
      </div>
    );

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || !enabled}
        className={`${box} relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-[#5FBB46]`}
        aria-label={value ? "Replace image" : "Upload image"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaSrc(value, "thumb")} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold">
            <ImagePlus className="h-5 w-5" /> Upload
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-[#5FBB46]" />
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {value && !compact && enabled && (
        <button type="button" onClick={() => onChange("")} className="mt-1 block text-[10px] font-semibold text-red-600">
          Remove image
        </button>
      )}
      {error && <p className={`mt-1 text-[10px] text-red-600 ${compact ? "w-20" : "w-40"}`}>{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------- the preview

/** A generic sponsored-post mock-up (our own design, not any platform's). */
function AdPreview({ ad, businessName }: { ad: Creative; businessName: string }) {
  const [view, setView] = useState<"feed" | "story">("feed");
  const [cardIndexRaw, setCard] = useState(0);
  const cardIndex = Math.min(cardIndexRaw, Math.max(0, ad.cards.length - 1));
  const image = ad.format === "CAROUSEL" ? ad.cards[cardIndex]?.image : ad.image;

  const visual = (shape: string) => (
    <div className={`relative flex ${shape} items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C1D52] to-[#5FBB46] text-center`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaSrc(image)} alt={ad.visual || "Ad image"} className="h-full w-full object-cover" />
      ) : (
        <p className="p-5 text-xs italic leading-5 text-white/90">{ad.visual || "Upload an image or describe it."}</p>
      )}
      {ad.format === "VIDEO" && (
        <>
          <span className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="h-6 w-6 fill-white" />
          </span>
          <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            0:{String(ad.seconds % 60).padStart(2, "0")}
          </span>
        </>
      )}
      {ad.format === "CAROUSEL" && ad.cards.length > 1 && (
        <>
          <button type="button" aria-label="Previous card" onClick={() => setCard(Math.max(0, cardIndex - 1))} className="absolute left-1.5 rounded-full bg-white/80 p-1 text-[#1C1D52] disabled:opacity-30" disabled={cardIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next card" onClick={() => setCard(Math.min(ad.cards.length - 1, cardIndex + 1))} className="absolute right-1.5 rounded-full bg-white/80 p-1 text-[#1C1D52] disabled:opacity-30" disabled={cardIndex === ad.cards.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {cardIndex + 1}/{ad.cards.length}
          </span>
        </>
      )}
    </div>
  );
  const headline = ad.format === "CAROUSEL" ? ad.cards[cardIndex]?.headline : ad.headline;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["feed", "story"] as const).map((key) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold ${view === key ? "bg-[#1C1D52] text-white" : "bg-slate-100 text-slate-600"}`}>
            {key === "feed" ? "Feeds" : "Stories / Reels"}
          </button>
        ))}
      </div>
      {view === "feed" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1D52] text-xs font-bold text-white">{businessName.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="text-xs font-bold text-[#1C1D52]">{businessName}</p>
              <p className="text-[10px] text-slate-400">Sponsored</p>
            </div>
          </div>
          <p className="whitespace-pre-line px-3 pb-2 text-xs leading-5 text-slate-700">
            {ad.primaryText || <span className="text-slate-300">Your primary text appears here.</span>}
          </p>
          {visual("aspect-square")}
          <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[#1C1D52]">{headline || "Your headline"}</p>
              {ad.description && <p className="truncate text-[10px] text-slate-500">{ad.description}</p>}
            </div>
            <span className="shrink-0 rounded-md bg-[#1C1D52] px-3 py-1.5 text-[10px] font-bold text-white">{ad.cta}</span>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto w-[220px] overflow-hidden rounded-2xl bg-black shadow-sm">
          {visual("aspect-[9/16]")}
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#1C1D52]">{businessName.slice(0, 1).toUpperCase()}</span>
            <p className="text-[10px] font-bold text-white">{businessName} · Sponsored</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8">
            <p className="line-clamp-2 text-[10px] leading-4 text-white">{ad.primaryText}</p>
            <span className="mt-2 block rounded-full bg-white py-1.5 text-center text-[10px] font-bold text-[#1C1D52]">{ad.cta}</span>
          </div>
        </div>
      )}
      <p className="text-[10px] leading-4 text-slate-400">
        {view === "story" ? "Stories and Reels show the image tall (9:16): keep key details in the middle." : "Feeds show it square. Check both when you use several placements."}
      </p>
    </div>
  );
}

// ------------------------------------------------------------- the results

type Level = "campaign" | "adset" | "ad";
type BreakdownKey = "none" | "age" | "gender" | "placement" | "day";

const DELIVERY_STYLE: Record<Delivery, string> = {
  COMPLETED: "bg-slate-100 text-slate-600",
  LEARNING_LIMITED: "bg-amber-100 text-amber-800",
  NOT_DELIVERING: "bg-red-50 text-red-600",
  REJECTED: "bg-red-50 text-red-600",
};

/** The report for one run: a run in older shapes is converted first. */
function prepared(run: SimRun): SimRun {
  const campaign = parseCampaign(run.campaign);
  return { ...run, campaign, result: normalizeRunResult(run.result, campaign) };
}

function Results({
  runs,
  shownIndex,
  price,
  onSelect,
  onEdit,
  onSubmit,
  submitting,
  submitLabel,
}: {
  runs: SimRun[];
  shownIndex: number;
  price: number;
  onSelect: (index: number) => void;
  onEdit: () => void;
  onSubmit?: (index: number) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
}) {
  const run = useMemo(() => prepared(runs[shownIndex]), [runs, shownIndex]);
  const best = runs.reduce((bestIndex, item, index) => (item.result.score > runs[bestIndex].result.score ? index : bestIndex), 0);
  const { result } = run;

  return (
    <section className={`${card} space-y-4`}>
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
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg bg-[#f4faf2] px-2.5 py-1.5 text-[11px] font-semibold text-[#397d3a]">
            <PencilLine className="h-3.5 w-3.5" /> Improve and run again
          </button>
        </div>
      </div>

      <RunReport run={run} price={price} />

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
      {result.delivery === "REJECTED" && <p className="text-[11px] text-red-600">Fix the rejection and publish again.</p>}
    </section>
  );
}

/** One run's full report: score, goals, the results table, notes and coaching. */
export function RunReport({ run: raw, price }: { run: SimRun; price: number }) {
  const run = useMemo(() => prepared(raw), [raw]);
  const { result, feedback } = run;
  const { goals, ratings, notes, score, totals } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-[#1C1D52] p-4 text-white">
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-[#5FBB46]">
          <span className="text-xl font-bold">{score}</span>
          <span className="text-[9px] text-white/60">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/70">
            {run.campaign.name} · {OBJECTIVES[run.campaign.objective].label} · spent {naira(totals.spend)} of {naira(totals.plannedBudget)}
          </p>
          <p className="mt-1 text-sm">{feedback.summary}</p>
        </div>
      </div>

      {result.delivery === "REJECTED" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{notes[0]}</p>
      )}

      {result.abTest && (
        <p className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs ${result.abTest.winnerId ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-amber-50 text-amber-800"}`}>
          <Trophy className="mt-0.5 h-4 w-4 shrink-0" /> {result.abTest.summary}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal, index) => (
          <li key={index} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${goal.met ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}>
            {goal.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {goal.label}: <strong>{formatGoalValue(goal.metric, goal.actual)}</strong>
              <span className="block text-[10px] opacity-75">
                target {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"} {formatGoalValue(goal.metric, goal.target)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ResultsTable run={run} price={price} />

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
        <Rating label="Objective and goal fit" value={ratings.objectiveFit} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Advice title="Audiences and placements" items={feedback.targeting} />
        <Advice title="The ads" items={feedback.creative} />
        <Advice title="Structure, budget and bidding" items={feedback.budget} />
      </div>

      <TipsByItem run={run} />

      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <Sparkles className="h-3 w-3" />
        {ratings.source === "ai" ? "Plan and images judged by AI." : "Plan judged by simple rules."} Results come from a training simulation, not real ads.
      </p>
    </div>
  );
}

/** Ads-manager-style table: campaign, ad sets or ads, with a breakdown. */
function ResultsTable({ run, price }: { run: SimRun; price: number }) {
  const [level, setLevel] = useState<Level>("adset");
  const [breakdown, setBreakdown] = useState<BreakdownKey>("none");
  const { result, campaign } = run;
  const adSets = result.adSets ?? [];
  const winner = result.abTest?.winnerId;
  const hasBreakdown = (key: Exclude<BreakdownKey, "none">) => (result.breakdowns?.[key].length ?? 0) > 0;

  type Row = {
    id: string;
    name: string;
    sub?: string;
    delivery?: Delivery;
    budget?: number;
    m: Metrics;
    resultLabel?: string;
    child?: boolean;
    badge?: string;
  };
  const metricsOf = (x: Metrics): Metrics => ({
    spend: x.spend,
    impressions: x.impressions,
    reach: x.reach,
    clicks: x.clicks,
    conversions: x.conversions,
    results: x.results,
  });
  const breakdownRows = (rows: BreakdownRow[] | undefined, resultLabel?: string): Row[] =>
    (rows ?? []).map((r) => ({ id: r.key, name: r.label, m: metricsOf(r), resultLabel, child: true }));

  const rows: Row[] = [];
  if (level === "campaign") {
    const t = result.totals;
    rows.push({
      id: "campaign",
      name: campaign.name,
      sub: OBJECTIVES[campaign.objective].label,
      delivery: result.delivery ?? "COMPLETED",
      budget: t.plannedBudget,
      m: {
        spend: t.spend,
        impressions: t.impressions,
        reach: t.reach,
        clicks: t.clicks,
        conversions: t.conversions,
        results: t.results ?? t.conversions,
      },
      resultLabel: t.resultLabel ?? "Conversions",
    });
    if (breakdown !== "none") rows.push(...breakdownRows(result.breakdowns?.[breakdown], t.resultLabel));
  } else if (level === "adset") {
    for (const set of adSets) {
      rows.push({
        id: set.id,
        name: set.name,
        sub: PERFORMANCE_GOALS[campaign.adSets.find((s) => s.id === set.id)?.performanceGoal ?? "CONVERSIONS"].label,
        delivery: set.delivery,
        budget: set.plannedBudget,
        m: metricsOf(set),
        resultLabel: set.resultLabel,
        badge: winner === set.id ? "A/B winner" : undefined,
      });
      if (breakdown !== "none") rows.push(...breakdownRows(set.breakdowns[breakdown], set.resultLabel));
    }
  } else {
    for (const set of adSets)
      for (const ad of set.ads)
        rows.push({
          id: ad.id,
          name: ad.name,
          sub: `${set.name} · ${FORMATS[ad.format]} · ${Math.round(ad.share * 100)}% of its budget`,
          delivery: set.delivery,
          m: metricsOf(ad),
          resultLabel: set.resultLabel,
        });
  }

  // Sizes on the cells themselves: the site's base styles size every th/td.
  const cell = "whitespace-nowrap px-3 py-2 text-right text-[11px]";
  const head = "whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.04em]";
  const per = (spend: number, n: number, digits = 0) => (n > 0 ? `₦${(spend / n).toLocaleString("en-NG", { maximumFractionDigits: digits })}` : "—");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-[#f3f6fb] p-1" role="tablist" aria-label="Level">
          {(
            [
              ["campaign", "Campaign", FolderOpen],
              ["adset", "Ad sets", Layers],
              ["ad", "Ads", ImageIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={level === key}
              onClick={() => setLevel(key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold ${level === key ? "bg-white text-[#1C1D52] shadow-sm" : "text-slate-500"}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
          Breakdown
          <select
            value={level === "ad" ? "none" : breakdown}
            disabled={level === "ad"}
            onChange={(e) => setBreakdown(e.target.value as BreakdownKey)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-[#1C1D52] disabled:opacity-50"
          >
            <option value="none">None</option>
            {(["age", "gender", "placement", "day"] as const).map((key) => (
              <option key={key} value={key} disabled={!hasBreakdown(key)}>
                {key === "age" ? "Age" : key === "gender" ? "Gender" : key === "placement" ? "Placement" : "Day"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[1100px] border-collapse text-[11px] text-slate-700">
          <thead>
            <tr className="bg-[#f5f8fb] text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">
              <th className={`${head} sticky left-0 z-10 bg-[#f5f8fb] text-left!`}>Name</th>
              <th className={`${head} text-left!`}>Delivery</th>
              <th className={head}>Results</th>
              <th className={head}>Cost per result</th>
              <th className={head}>Budget</th>
              <th className={head}>Amount spent</th>
              <th className={head}>Reach</th>
              <th className={head}>Impressions</th>
              <th className={head}>Frequency</th>
              <th className={head}>CPM</th>
              <th className={head}>Link clicks</th>
              <th className={head}>CTR</th>
              <th className={head}>CPC</th>
              <th className={head}>Conversions</th>
              <th className={head}>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const m = row.m;
              const roas = m.spend ? (m.conversions * price) / m.spend : 0;
              return (
                <tr key={`${row.id}-${index}`} className={`border-t border-slate-100 ${row.child ? "bg-slate-50/60 text-slate-600" : ""}`}>
                  <td className={`sticky left-0 z-10 max-w-[220px] px-3 py-2 text-left text-[11px] ${row.child ? "bg-[#f9fbfd] pl-7" : "bg-white"}`}>
                    <span className={`block truncate ${row.child ? "" : "font-bold text-[#1C1D52]"}`}>{row.name}</span>
                    {row.sub && <span className="block truncate text-[10px] text-slate-400">{row.sub}</span>}
                    {row.badge && <span className="mt-0.5 inline-block rounded-full bg-[#e8f7eb] px-2 py-0.5 text-[9px] font-bold text-[#397d3a]">{row.badge}</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {row.delivery && (
                      <span title={DELIVERY[row.delivery].help} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${DELIVERY_STYLE[row.delivery]}`}>
                        {DELIVERY[row.delivery].label}
                      </span>
                    )}
                  </td>
                  <td className={cell}>
                    <span className="font-bold text-[#1C1D52]">{count(m.results)}</span>
                    {row.resultLabel && !row.child && <span className="block text-[9px] text-slate-400">{row.resultLabel}</span>}
                  </td>
                  <td className={cell}>{per(m.spend, m.results, 2)}</td>
                  <td className={cell}>{row.budget !== undefined ? naira(row.budget) : "—"}</td>
                  <td className={cell}>{naira(m.spend)}</td>
                  <td className={cell}>{m.reach ? count(m.reach) : "—"}</td>
                  <td className={cell}>{count(m.impressions)}</td>
                  <td className={cell}>{m.reach ? (m.impressions / m.reach).toFixed(2) : "—"}</td>
                  <td className={cell}>{per(m.spend * 1000, m.impressions)}</td>
                  <td className={cell}>{count(m.clicks)}</td>
                  <td className={cell}>{m.impressions ? `${((m.clicks / m.impressions) * 100).toFixed(2)}%` : "—"}</td>
                  <td className={cell}>{per(m.spend, m.clicks)}</td>
                  <td className={cell}>{count(m.conversions)}</td>
                  <td className={cell}>{m.spend ? `${roas.toFixed(2)}×` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-4 text-slate-400">
        Results count each ad set&apos;s performance goal. Conversions are {price ? "sales or leads" : "results"} the business cares about; ROAS = value of
        conversions ÷ amount spent. Hover a delivery status for what it means.
      </p>
    </div>
  );
}

/** The AI's tips for each ad set and ad. */
function TipsByItem({ run }: { run: SimRun }) {
  const items = [
    ...(run.feedback.adSets ?? []).map((item) => ({ ...item, kind: "Ad set" })),
    ...(run.feedback.ads ?? []).map((item) => ({ ...item, kind: "Ad" })),
  ].filter((item) => item.tips.length);
  if (!items.length) return null;
  return (
    <details className="rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-xs font-bold text-[#1C1D52]">Tips for each ad set and ad ({items.length})</summary>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="text-[11px] text-slate-600">
            <strong className="text-[#1C1D52]">
              {item.kind}: {item.name}
            </strong>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
              {item.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
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
