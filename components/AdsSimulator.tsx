"use client";

import {
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  ImageIcon,
  ImagePlus,
  Info,
  LayoutGrid,
  Layers,
  Loader2,
  PencilLine,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FullscreenToggle, useFullscreen } from "@/components/FullscreenFrame";
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
  type AdSetResult,
  type BidStrategy,
  type BreakdownRow,
  type Budget,
  type Campaign,
  type Creative,
  type CreativeResult,
  type CustomAudience,
  type Delivery,
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

// SabiRole Ads Studio: a practice ads manager. Its look and workflow
// follow the big social platforms' ads managers (a campaigns table with
// Campaigns / Ad sets / Ads tabs, on/off switches, an editing pane with the
// structure on the left and a preview on the right, Publish), so interns
// feel at home in the real thing. It carries our own name and logo, no
// platform's logos or trademarks, and a notice that it's a practice tool not
// affiliated with any platform. It can fill the screen (FullscreenFrame).

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
type View = "manage" | "edit" | "report" | "brief";
type Level = "campaign" | "adset" | "ad";

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;
const count = (value: number) => Math.round(value).toLocaleString("en-NG");
const compact = (value: number) =>
  value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}K` : String(Math.round(value));

// The ads-manager palette (colours only: names and logos are our own).
const BLUE = "bg-[#1877F2] hover:bg-[#166FE5] text-white";
const GREEN = "bg-[#42B72A] hover:bg-[#36A420] text-white";
const GREY = "bg-[#E4E6EB] hover:bg-[#D8DADF] text-[#050505]";
const inputClass =
  "w-full rounded-md border border-[#CCD0D5] bg-white px-3 py-2 text-[13px] text-[#1C1E21] outline-none focus:border-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/20 disabled:bg-[#F5F6F7] disabled:text-[#8A8D91]";
const panel = "rounded-lg border border-[#DADDE1] bg-white";
const button = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40";

/** The practice-tool notice: shown inside the studio at all times. */
export function StudioNotice() {
  return (
    <p className="flex items-start gap-2 border-b border-[#DADDE1] bg-[#E7F3FF] px-4 py-2 text-[12px] leading-5 text-[#1C1E21]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1877F2]" />
      <span>
        <strong>For learning only.</strong> SabiRole Ads Studio works like the ads managers of the big social platforms, but it
        isn&apos;t affiliated with or endorsed by Meta, Facebook, Instagram or any ad platform. No real ads run and no money is
        spent. To run real ads, use the platform&apos;s own ads manager.
      </span>
    </p>
  );
}

/** Our own mark: a blue tile with a G (not any platform's logo). */
function StudioLogo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877F2] text-[15px] font-black text-white">G</span>
      <span className="leading-tight">
        <span className="block text-[11px] font-semibold text-[#65676B]">SabiRole</span>
        <span className="block text-[15px] font-bold text-[#1C1E21]">Ads Studio</span>
      </span>
    </span>
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
  const { full } = useFullscreen();
  const fresh = runs.length === 0 && allAds(campaign).every((ad) => !ad.primaryText);
  const [view, setView] = useState<View>(fresh ? "edit" : "manage");
  const [choosingObjective, setChoosingObjective] = useState(fresh);
  const [selection, setSelection] = useState<Selection>({ level: "campaign" });
  const [tab, setTab] = useState<Level>("campaign");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownRun, setShownRun] = useState<number | null>(null);

  const set = (patch: Partial<Campaign>) => onCampaignChange({ ...campaign, ...patch });
  const setAdSet = (id: string, patch: Partial<AdSet>) =>
    set({ adSets: campaign.adSets.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const setAd = (setId: string, adId: string, patch: Partial<Creative>) =>
    set({
      adSets: campaign.adSets.map((item) =>
        item.id === setId ? { ...item, ads: item.ads.map((ad) => (ad.id === adId ? { ...ad, ...patch } : ad)) } : item,
      ),
    });

  const problems = campaignProblems(campaign, { maxTotalBudget: config.maxTotalBudget, hasApp: config.hasApp ?? false });
  const runsLeft = maxRuns === undefined ? null : Math.max(0, maxRuns - runs.length);
  const runIndex = shownRun ?? runs.length - 1;
  const latest = useMemo(() => (runs[runIndex] ? prepare(runs[runIndex]) : null), [runs, runIndex]);
  const changedSincePublish = latest ? JSON.stringify(parseCampaign(campaign)) !== JSON.stringify(latest.campaign) : true;

  async function publish() {
    setRunning(true);
    setError(null);
    const failure = await onRun(campaign);
    setRunning(false);
    if (failure) setError(failure);
    else {
      setShownRun(null);
      setView("manage");
      setTab("adset");
    }
  }

  // Structure actions (from the table or the editing pane).
  const addAdSet = (copyOf?: AdSet) => {
    if (campaign.adSets.length >= MAX_AD_SETS || (copyOf && allAds(campaign).length + copyOf.ads.length > MAX_TOTAL_ADS)) return;
    const next = copyOf
      ? copyAdSet(copyOf, campaign.adSets.length)
      : (() => {
          const blank = blankAdSet(campaign.adSets.length, campaign.objective);
          const first = campaign.adSets[0];
          // Start from the first ad set's audience: usually a variation of it.
          return first ? { ...blank, audience: { ...first.audience, locations: [...first.audience.locations] } } : blank;
        })();
    set({ adSets: [...campaign.adSets, next] });
    setSelection({ level: "adset", setId: next.id });
    setView("edit");
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
    setView("edit");
  };
  const deleteAd = (target: AdSet, ad: Creative) => {
    if (target.ads.length === 1 || !window.confirm(`Delete ${ad.name}?`)) return;
    setAdSet(target.id, { ads: target.ads.filter((item) => item.id !== ad.id) });
    setSelection({ level: "adset", setId: target.id });
  };
  const edit = (next: Selection) => {
    setSelection(next);
    setView("edit");
  };

  const rail: Array<{ key: View; label: string; icon: typeof LayoutGrid; disabled?: boolean }> = [
    { key: "manage", label: "Campaigns", icon: LayoutGrid },
    { key: "edit", label: "Edit", icon: PencilLine },
    { key: "report", label: "Practice report", icon: BarChart3, disabled: !runs.length },
    { key: "brief", label: "Client brief", icon: BookOpen },
  ];

  return (
    <div
      data-ads-studio
      className={`overflow-hidden bg-[#F0F2F5] text-[#1C1E21] [&_:is(button,input,select,textarea,label,th,td,a)]:[font-family:inherit] ${full ? "flex min-h-screen flex-col" : "rounded-xl border border-[#DADDE1] shadow-[0_8px_24px_rgba(28,29,82,0.09)]"}`}
      style={{ fontFamily: "Helvetica, Arial, 'Segoe UI', sans-serif" }}
    >
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-[#DADDE1] bg-white px-4 py-2">
        <StudioLogo />
        <span className="hidden h-6 w-px bg-[#DADDE1] sm:block" />
        <span className="flex min-w-0 items-center gap-2 rounded-md bg-[#F0F2F5] px-3 py-1.5 text-[13px]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1C1E21] text-[10px] font-bold text-white">
            {config.business.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-semibold">{config.business.name}</span>
          <span className="hidden text-[#65676B] md:inline">· practice ad account</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full bg-[#FFF5D6] px-2.5 py-1 text-[11px] font-bold text-[#8A6100] sm:inline">Practice mode</span>
          {runsLeft !== null && (
            <span className="hidden text-[12px] text-[#65676B] md:inline">
              {runsLeft} of {maxRuns} publishes left
            </span>
          )}
          <FullscreenToggle className={GREY} />
        </span>
      </header>
      <StudioNotice />

      <div className={`flex ${full ? "flex-1" : "min-h-[640px]"}`}>
        {/* Left navigation */}
        <nav aria-label="Ads Studio" className="hidden w-[64px] shrink-0 flex-col items-center gap-1 border-r border-[#DADDE1] bg-white py-3 md:flex">
          {rail.map(({ key, label, icon: Icon, disabled }) => (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              disabled={disabled}
              onClick={() => setView(key)}
              className={`flex w-12 flex-col items-center gap-0.5 rounded-lg py-2 text-[9px] font-semibold disabled:opacity-30 ${view === key ? "bg-[#E7F3FF] text-[#1877F2]" : "text-[#65676B] hover:bg-[#F2F3F5]"}`}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-tight">{label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          {/* Small screens: the navigation as tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-[#DADDE1] bg-white px-2 py-1.5 md:hidden">
            {rail.map(({ key, label, icon: Icon, disabled }) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => setView(key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-30 ${view === key ? "bg-[#E7F3FF] text-[#1877F2]" : "text-[#65676B]"}`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {view === "manage" && (
            <ManageView
              campaign={campaign}
              config={config}
              runs={runs}
              runIndex={runIndex}
              latest={latest}
              changedSincePublish={changedSincePublish}
              tab={tab}
              onTab={setTab}
              onShowRun={setShownRun}
              onEdit={edit}
              onAddAdSet={addAdSet}
              onAddAd={addAd}
              onDeleteAdSet={deleteAdSet}
              onDeleteAd={deleteAd}
              onToggleAdSet={(item) => setAdSet(item.id, { paused: !item.paused })}
              onToggleAd={(item, ad) => setAd(item.id, ad.id, { paused: !ad.paused })}
              onReport={() => setView("report")}
            />
          )}

          {view === "edit" && (
            <EditView
              campaign={campaign}
              config={config}
              selection={selection}
              mediaEnabled={mediaEnabled}
              problems={problems}
              running={running}
              runsLeft={runsLeft}
              error={error}
              onCampaignChange={onCampaignChange}
              onAdSetChange={setAdSet}
              onAdChange={setAd}
              onSelect={setSelection}
              onAddAdSet={addAdSet}
              onDeleteAdSet={deleteAdSet}
              onAddAd={addAd}
              onDeleteAd={deleteAd}
              onToggleAdSet={(item) => setAdSet(item.id, { paused: !item.paused })}
              onToggleAd={(item, ad) => setAd(item.id, ad.id, { paused: !ad.paused })}
              onChangeObjective={() => setChoosingObjective(true)}
              onClose={() => setView("manage")}
              onPublish={() => void publish()}
            />
          )}

          {view === "report" && latest && (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p role="heading" aria-level={2} className="text-[20px] font-bold">Practice report</p>
                <RunPicker runs={runs} index={runIndex} onChange={setShownRun} />
              </div>
              <div className={`${panel} p-4`}>
                <RunReport run={latest} price={config.product.price} />
              </div>
              {onSubmit && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      await onSubmit(runIndex);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className={`${button} ${BLUE} px-5 py-2.5`}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Submitting…" : `${submitLabel} (publish ${runIndex + 1})`}
                </button>
              )}
            </div>
          )}

          {view === "brief" && (
            <div className="p-4">
              <ClientBrief config={config} />
            </div>
          )}
        </main>
      </div>

      {choosingObjective && (
        <ObjectiveDialog
          value={campaign.objective}
          onCancel={() => setChoosingObjective(false)}
          onContinue={(objective) => {
            if (objective !== campaign.objective) onCampaignChange(withObjective(campaign, objective));
            setChoosingObjective(false);
            setSelection({ level: "campaign" });
            setView("edit");
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------- shared bits

function ClientBrief({ config }: { config: SimConfig }) {
  return (
    <section className={`${panel} space-y-3 p-5`}>
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#65676B]">Client brief</p>
      <p role="heading" aria-level={2} className="text-[20px] font-bold">{config.business.name}</p>
      <p className="text-[14px] leading-6 text-[#1C1E21]">{config.business.description}</p>
      <p className="text-[14px]">
        <strong>Selling:</strong> {config.product.name} · {naira(config.product.price)}{" "}
        {config.conversionEvent === "SALES" ? "per sale" : "value per lead"}
        {config.hasApp === false && " · the business has no app"}
      </p>
      <div>
        <p className="mb-2 text-[13px] font-bold">Goals for this campaign</p>
        <div className="flex flex-wrap gap-2">
          {config.goals.map((goal, index) => (
            <span key={index} className="rounded-full bg-[#E7F3FF] px-3 py-1 text-[12px] font-semibold text-[#1877F2]">
              {GOAL_METRICS[goal.metric].label} {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"} {formatGoalValue(goal.metric, goal.value)}
            </span>
          ))}
          <span className="rounded-full bg-[#F0F2F5] px-3 py-1 text-[12px] font-semibold text-[#65676B]">
            Practice budget {naira(config.maxTotalBudget)} (no billing needed)
          </span>
        </div>
      </div>
    </section>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? "On: publishes" : "Off: not published"}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition disabled:opacity-40 ${on ? "bg-[#1877F2]" : "bg-[#BCC0C4]"}`}
    >
      <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
    </button>
  );
}

const DOT: Record<Delivery | "OFF" | "DRAFT", string> = {
  COMPLETED: "bg-[#42B72A]",
  LEARNING_LIMITED: "bg-[#F7B928]",
  NOT_DELIVERING: "bg-[#FA383E]",
  REJECTED: "bg-[#FA383E]",
  OFF: "bg-[#BCC0C4]",
  DRAFT: "border border-[#8A8D91] bg-white",
};

function DeliveryCell({ state }: { state: Delivery | "OFF" | "DRAFT" }) {
  const label = state === "OFF" ? "Off" : state === "DRAFT" ? "Not published" : DELIVERY[state].label;
  const help = state === "OFF" ? "Switched off: not published." : state === "DRAFT" ? "Publish to see how it does." : DELIVERY[state].help;
  return (
    <span title={help} className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${DOT[state]}`} />
      {label}
    </span>
  );
}

function RunPicker({ runs, index, onChange }: { runs: SimRun[]; index: number; onChange: (index: number) => void }) {
  const best = runs.reduce((b, item, i) => (item.result.score > runs[b].result.score ? i : b), 0);
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-[#65676B]">
      Results from
      <select value={index} onChange={(e) => onChange(Number(e.target.value))} className="rounded-md border border-[#CCD0D5] bg-white px-2 py-1.5 text-[13px] font-semibold text-[#1C1E21]">
        {runs.map((item, i) => (
          <option key={item.at} value={i}>
            Publish {i + 1} · score {item.result.score}
            {i === best && runs.length > 1 ? " ★" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A run in the current shape (older runs are converted). */
function prepare(run: SimRun): SimRun {
  const campaign = parseCampaign(run.campaign);
  return { ...run, campaign, result: normalizeRunResult(run.result, campaign) };
}

// ----------------------------------------------------------- manage view

type Extra = { budget?: string; ends?: string; bid?: string; price: number };
type Column = { key: string; label: string; render: (m: Metrics, extra: Extra) => string };

const per = (spend: number, n: number, digits = 0) =>
  n > 0 ? `₦${(spend / n).toLocaleString("en-NG", { maximumFractionDigits: digits, minimumFractionDigits: digits })}` : "—";
const shown = (m: Metrics) => m.spend > 0 || m.impressions > 0;

const PERFORMANCE_COLUMNS: Column[] = [
  { key: "bid", label: "Bid strategy", render: (_, x) => x.bid ?? "—" },
  { key: "budget", label: "Budget", render: (_, x) => x.budget ?? "—" },
  { key: "results", label: "Results", render: (m) => (shown(m) ? count(m.results) : "—") },
  { key: "reach", label: "Reach", render: (m) => (m.reach ? count(m.reach) : "—") },
  { key: "impressions", label: "Impressions", render: (m) => (m.impressions ? count(m.impressions) : "—") },
  { key: "cpr", label: "Cost per result", render: (m) => per(m.spend, m.results, 2) },
  { key: "spend", label: "Amount spent", render: (m) => (shown(m) ? naira(m.spend) : "—") },
  { key: "ends", label: "Ends", render: (_, x) => x.ends ?? "—" },
];

const DELIVERY_COLUMNS: Column[] = [
  { key: "spend", label: "Amount spent", render: (m) => (shown(m) ? naira(m.spend) : "—") },
  { key: "frequency", label: "Frequency", render: (m) => (m.reach ? (m.impressions / m.reach).toFixed(2) : "—") },
  { key: "cpm", label: "CPM (cost per 1,000 impressions)", render: (m) => per(m.spend * 1000, m.impressions, 2) },
  { key: "clicks", label: "Link clicks", render: (m) => (m.impressions ? count(m.clicks) : "—") },
  { key: "ctr", label: "CTR (link click-through rate)", render: (m) => (m.impressions ? `${((m.clicks / m.impressions) * 100).toFixed(2)}%` : "—") },
  { key: "cpc", label: "CPC (cost per link click)", render: (m) => per(m.spend, m.clicks, 2) },
  { key: "conversions", label: "Conversions", render: (m) => (m.impressions ? count(m.conversions) : "—") },
  { key: "roas", label: "ROAS (return on ad spend)", render: (m, x) => (m.spend ? ((m.conversions * x.price) / m.spend).toFixed(2) : "—") },
];

const empty: Metrics = { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, results: 0 };

function budgetLabel(budget: Budget) {
  return `${naira(budget.amount)} ${budget.type === "DAILY" ? "Daily" : "Lifetime"}`;
}

type BreakdownKey = "none" | "age" | "gender" | "placement" | "day";

function ManageView({
  campaign,
  config,
  runs,
  runIndex,
  latest,
  changedSincePublish,
  tab,
  onTab,
  onShowRun,
  onEdit,
  onAddAdSet,
  onAddAd,
  onDeleteAdSet,
  onDeleteAd,
  onToggleAdSet,
  onToggleAd,
  onReport,
}: {
  campaign: Campaign;
  config: SimConfig;
  runs: SimRun[];
  runIndex: number;
  latest: SimRun | null;
  changedSincePublish: boolean;
  tab: Level;
  onTab: (level: Level) => void;
  onShowRun: (index: number) => void;
  onEdit: (selection: Selection) => void;
  onAddAdSet: (copyOf?: AdSet) => void;
  onAddAd: (set: AdSet, copyOf?: Creative) => void;
  onDeleteAdSet: (set: AdSet) => void;
  onDeleteAd: (set: AdSet, ad: Creative) => void;
  onToggleAdSet: (set: AdSet) => void;
  onToggleAd: (set: AdSet, ad: Creative) => void;
  onReport: () => void;
}) {
  const [columns, setColumns] = useState<"performance" | "delivery">("performance");
  const [breakdown, setBreakdown] = useState<BreakdownKey>("none");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const result = latest?.result;
  const setResults = new Map((result?.adSets ?? []).map((s) => [s.id, s]));
  const adResults = new Map((result?.creatives ?? []).map((a) => [a.id, a]));
  const cols = columns === "performance" ? PERFORMANCE_COLUMNS : DELIVERY_COLUMNS;
  const price = config.product.price;
  const needle = query.trim().toLowerCase();
  const matches = (name: string) => !needle || name.toLowerCase().includes(needle);

  type Row = {
    id: string;
    level: Level;
    name: string;
    sub?: string;
    on: boolean;
    state: Delivery | "OFF" | "DRAFT";
    m: Metrics;
    resultLabel?: string;
    extra: Extra;
    set?: AdSet;
    ad?: Creative;
    child?: boolean;
    badge?: string;
  };
  const metricsOf = (x: Metrics | undefined): Metrics =>
    x ? { spend: x.spend, impressions: x.impressions, reach: x.reach, clicks: x.clicks, conversions: x.conversions, results: x.results } : empty;
  const breakdownRows = (rows: BreakdownRow[] | undefined): Row[] =>
    breakdown === "none"
      ? []
      : (rows ?? []).map((r) => ({ id: r.key, level: tab, name: r.label, on: true, state: "COMPLETED", m: metricsOf(r), extra: { price }, child: true }));
  const breakdownKey = breakdown === "none" ? "day" : breakdown;

  const rows: Row[] = [];
  if (tab === "campaign") {
    const t = result?.totals;
    rows.push({
      id: "campaign",
      level: "campaign",
      name: campaign.name,
      sub: OBJECTIVES[campaign.objective].label,
      on: campaign.adSets.some((s) => !s.paused),
      state: !result ? "DRAFT" : (result.delivery ?? "COMPLETED"),
      m: t ? { spend: t.spend, impressions: t.impressions, reach: t.reach, clicks: t.clicks, conversions: t.conversions, results: t.results ?? t.conversions } : empty,
      resultLabel: t ? (t.resultLabel ?? "Conversions") : undefined,
      extra: {
        price,
        bid: campaign.budgetMode === "CAMPAIGN" ? BID_STRATEGIES[campaign.bidStrategy].label : "Using ad set bid strategy",
        budget: campaign.budgetMode === "CAMPAIGN" ? budgetLabel(campaign.budget) : "Using ad set budget",
        ends: `${campaignDays(campaign)} days`,
      },
    });
    rows.push(...breakdownRows(result?.breakdowns?.[breakdownKey]));
  } else if (tab === "adset") {
    for (const item of campaign.adSets.filter((s) => matches(s.name))) {
      const r = setResults.get(item.id) as AdSetResult | undefined;
      rows.push({
        id: item.id,
        level: "adset",
        name: item.name,
        sub: PERFORMANCE_GOALS[item.performanceGoal].label,
        on: !item.paused,
        state: item.paused ? "OFF" : r ? r.delivery : "DRAFT",
        m: metricsOf(r),
        resultLabel: r?.resultLabel ?? PERFORMANCE_GOALS[item.performanceGoal].result,
        extra: {
          price,
          bid: campaign.budgetMode === "CAMPAIGN" ? "Using campaign bid strategy" : BID_STRATEGIES[item.bidStrategy].label,
          budget: campaign.budgetMode === "CAMPAIGN" ? "Using campaign budget" : budgetLabel(item.budget),
          ends: `${item.days} days`,
        },
        set: item,
        badge: result?.abTest?.winnerId === item.id ? "A/B test winner" : undefined,
      });
      rows.push(...breakdownRows(r?.breakdowns[breakdownKey]));
    }
  } else {
    for (const item of campaign.adSets)
      for (const ad of item.ads.filter((a) => matches(a.name))) {
        const r = adResults.get(ad.id) as CreativeResult | undefined;
        const setResult = setResults.get(item.id);
        rows.push({
          id: ad.id,
          level: "ad",
          name: ad.name,
          sub: `${item.name} · ${FORMATS[ad.format]}${r ? ` · ${Math.round(r.share * 100)}% of its budget` : ""}`,
          on: !ad.paused && !item.paused,
          state: ad.paused || item.paused ? "OFF" : setResult ? setResult.delivery : "DRAFT",
          m: metricsOf(r),
          resultLabel: setResult?.resultLabel ?? PERFORMANCE_GOALS[item.performanceGoal].result,
          extra: { price },
          set: item,
          ad,
        });
      }
  }

  // The footer totals row ("Results from N…").
  const top = rows.filter((r) => !r.child);
  const sum = top.reduce<Metrics>(
    (acc, r) => ({
      spend: acc.spend + r.m.spend,
      impressions: acc.impressions + r.m.impressions,
      reach: acc.reach + r.m.reach,
      clicks: acc.clicks + r.m.clicks,
      conversions: acc.conversions + r.m.conversions,
      results: acc.results + r.m.results,
    }),
    { ...empty },
  );
  const checkedRow = top.find((r) => r.id === checked);
  const levelName = tab === "campaign" ? "campaign" : tab === "adset" ? "ad set" : "ad";
  const editRow = (row: Row) =>
    onEdit(row.ad && row.set ? { level: "ad", setId: row.set.id, adId: row.ad.id } : row.set ? { level: "adset", setId: row.set.id } : { level: "campaign" });

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="heading" aria-level={2} className="text-[20px] font-bold">Campaigns</p>
        <div className="flex flex-wrap items-center gap-2">
          {runs.length > 0 ? (
            <RunPicker runs={runs} index={runIndex} onChange={onShowRun} />
          ) : (
            <span className="text-[13px] text-[#65676B]">Not published yet</span>
          )}
          {latest && changedSincePublish && (
            <span className="rounded-full bg-[#FFF5D6] px-2.5 py-1 text-[11px] font-bold text-[#8A6100]" title="You've edited the campaign since this publish.">
              Unpublished edits
            </span>
          )}
        </div>
      </div>

      {result && (
        <button type="button" onClick={onReport} className={`${panel} flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-[#F7F8FA]`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-[#1877F2] text-[14px] font-bold">{result.score}</span>
          <span className="min-w-0 flex-1 text-[13px]">
            <strong>Practice score {result.score}/100</strong> · {result.goals.filter((g) => g.met).length} of {result.goals.length} goals met
            <span className="block truncate text-[#65676B]">{latest?.feedback.summary}</span>
          </span>
          <span className="text-[13px] font-semibold text-[#1877F2]">See full report →</span>
        </button>
      )}

      <section className={panel}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#DADDE1] p-2">
          <button
            type="button"
            onClick={() =>
              tab === "ad"
                ? onAddAd(campaign.adSets.find((s) => s.id === checkedRow?.set?.id) ?? campaign.adSets[0])
                : tab === "adset"
                  ? onAddAdSet()
                  : onEdit({ level: "campaign" })
            }
            className={`${button} ${GREEN}`}
            title={tab === "campaign" ? "This practice account has one campaign: edit it, or create ad sets and ads." : `Create ${tab === "adset" ? "an ad set" : "an ad"}`}
          >
            <Plus className="h-4 w-4" /> Create
          </button>
          <button
            type="button"
            disabled={!checkedRow || tab === "campaign"}
            onClick={() => {
              if (!checkedRow) return;
              if (checkedRow.ad && checkedRow.set) onAddAd(checkedRow.set, checkedRow.ad);
              else if (checkedRow.set) onAddAdSet(checkedRow.set);
            }}
            className={`${button} ${GREY}`}
          >
            <Copy className="h-4 w-4" /> Duplicate
          </button>
          <button
            type="button"
            disabled={!checkedRow && tab !== "campaign"}
            onClick={() => {
              const row = checkedRow ?? top[0];
              if (row) editRow(row);
            }}
            className={`${button} ${GREY}`}
          >
            <PencilLine className="h-4 w-4" /> Edit
          </button>
          <button
            type="button"
            disabled={!checkedRow || tab === "campaign"}
            onClick={() => {
              if (!checkedRow?.set) return;
              if (checkedRow.ad) onDeleteAd(checkedRow.set, checkedRow.ad);
              else onDeleteAdSet(checkedRow.set);
              setChecked(null);
            }}
            className={`${button} ${GREY}`}
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <label className="relative ml-auto">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65676B]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="w-44 rounded-md border border-[#CCD0D5] py-1.5 pl-8 pr-2 text-[13px] outline-none focus:border-[#1877F2]"
            />
          </label>
          <select
            value={columns}
            onChange={(e) => setColumns(e.target.value as "performance" | "delivery")}
            className="rounded-md border border-[#CCD0D5] bg-white px-2 py-1.5 text-[13px] font-semibold"
            aria-label="Columns"
          >
            <option value="performance">Columns: Performance</option>
            <option value="delivery">Columns: Delivery and clicks</option>
          </select>
          <select
            value={tab === "ad" ? "none" : breakdown}
            disabled={tab === "ad" || !result}
            onChange={(e) => setBreakdown(e.target.value as BreakdownKey)}
            className="rounded-md border border-[#CCD0D5] bg-white px-2 py-1.5 text-[13px] font-semibold disabled:opacity-40"
            aria-label="Breakdown"
          >
            <option value="none">Breakdown</option>
            <option value="age">By age</option>
            <option value="gender">By gender</option>
            <option value="placement">By placement</option>
            <option value="day">By day</option>
          </select>
        </div>

        {/* Level tabs */}
        <div className="flex border-b border-[#DADDE1] bg-[#F7F8FA]" role="tablist">
          {(
            [
              ["campaign", "Campaigns", FolderOpen, ""],
              ["adset", "Ad sets", Layers, " for 1 campaign"],
              ["ad", "Ads", ImageIcon, " for 1 campaign"],
            ] as const
          ).map(([key, label, Icon, suffix]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                onTab(key);
                setChecked(null);
              }}
              className={`-mb-px inline-flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold sm:flex-none sm:justify-start sm:px-5 ${tab === key ? "border-[#1877F2] bg-white text-[#1877F2]" : "border-transparent text-[#65676B] hover:bg-[#EEF0F3]"}`}
            >
              <Icon className="h-4 w-4" /> {label}
              <span className="hidden font-normal lg:inline">{suffix}</span>
            </button>
          ))}
        </div>

        {/* The table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-b border-[#DADDE1] bg-white">
                <th className="w-10 px-3 py-2 text-left text-[12px] font-semibold text-[#1C1E21]" aria-label="Select" />
                <th className="w-14 whitespace-nowrap px-1 py-2 text-left text-[12px] font-semibold text-[#1C1E21]">Off / On</th>
                <th className="sticky left-0 z-10 min-w-[220px] bg-white px-3 py-2 text-left text-[12px] font-semibold text-[#1C1E21]">
                  {tab === "campaign" ? "Campaign" : tab === "adset" ? "Ad set" : "Ad"}
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-semibold text-[#1C1E21]">Delivery</th>
                {cols.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 text-right text-[12px] font-semibold text-[#1C1E21]">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const selected = checked === row.id && !row.child;
                return (
                  <tr key={`${row.id}-${i}`} className={`group border-b border-[#EBEDF0] ${row.child ? "bg-[#F7F8FA]" : selected ? "bg-[#E7F3FF]" : "bg-white hover:bg-[#F7F8FA]"}`}>
                    <td className="px-3 py-2 text-[13px]">
                      {!row.child && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={selected}
                          onChange={() => setChecked(selected ? null : row.id)}
                          className="h-4 w-4 accent-[#1877F2]"
                        />
                      )}
                    </td>
                    <td className="px-1 py-2 text-[13px]">
                      {!row.child && row.level !== "campaign" && (
                        <Toggle
                          on={row.on}
                          disabled={row.level === "ad" && row.set?.paused}
                          label={`${row.on ? "Switch off" : "Switch on"} ${row.name}`}
                          onChange={() => (row.ad && row.set ? onToggleAd(row.set, row.ad) : row.set && onToggleAdSet(row.set))}
                        />
                      )}
                    </td>
                    <td className={`sticky left-0 z-10 px-3 py-2 text-[13px] ${row.child ? "bg-[#F7F8FA] pl-8 text-[#65676B]" : selected ? "bg-[#E7F3FF]" : "bg-white group-hover:bg-[#F7F8FA]"}`}>
                      {row.child ? (
                        row.name
                      ) : (
                        <>
                          <button type="button" onClick={() => editRow(row)} className="max-w-[260px] truncate text-left font-semibold text-[#1C1E21] hover:text-[#1877F2] hover:underline">
                            {row.name}
                          </button>
                          {row.sub && <span className="block max-w-[260px] truncate text-[12px] text-[#65676B]">{row.sub}</span>}
                          {row.badge && (
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#E9F7E4] px-2 py-0.5 text-[11px] font-semibold text-[#2E7D1E]">
                              <Trophy className="h-3 w-3" /> {row.badge}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[13px]">{!row.child && <DeliveryCell state={row.state} />}</td>
                    {cols.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right text-[13px]">
                        {row.child && (c.key === "bid" || c.key === "budget" || c.key === "ends") ? "" : c.render(row.m, row.extra)}
                        {c.key === "results" && row.resultLabel && !row.child && <span className="block text-[11px] text-[#65676B]">{row.resultLabel}</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={4 + cols.length} className="px-3 py-6 text-center text-[13px] text-[#65676B]">
                    Nothing matches your search.
                  </td>
                </tr>
              )}
            </tbody>
            {top.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#DADDE1] bg-white">
                  <td />
                  <td />
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 text-[13px] font-semibold">
                    Results from {top.length} {levelName}
                    {top.length === 1 ? "" : "s"}
                  </td>
                  <td />
                  {cols.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right text-[13px] font-semibold">
                      {c.key === "bid" || c.key === "budget" || c.key === "ends" ? "" : c.render(sum, { price })}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      <p className="text-[12px] text-[#65676B]">
        Tip: switch off ad sets or ads that do badly, change things, then publish again. Hover a delivery status to see what it means.
      </p>
    </div>
  );
}

// ------------------------------------------------------------- edit view

function EditView({
  campaign,
  config,
  selection,
  mediaEnabled,
  problems,
  running,
  runsLeft,
  error,
  onCampaignChange,
  onAdSetChange,
  onAdChange,
  onSelect,
  onAddAdSet,
  onDeleteAdSet,
  onAddAd,
  onDeleteAd,
  onToggleAdSet,
  onToggleAd,
  onChangeObjective,
  onClose,
  onPublish,
}: {
  campaign: Campaign;
  config: SimConfig;
  selection: Selection;
  mediaEnabled: boolean;
  problems: string[];
  running: boolean;
  runsLeft: number | null;
  error: string | null;
  onCampaignChange: (campaign: Campaign) => void;
  onAdSetChange: (id: string, patch: Partial<AdSet>) => void;
  onAdChange: (setId: string, adId: string, patch: Partial<Creative>) => void;
  onSelect: (selection: Selection) => void;
  onAddAdSet: (copyOf?: AdSet) => void;
  onDeleteAdSet: (set: AdSet) => void;
  onAddAd: (set: AdSet, copyOf?: Creative) => void;
  onDeleteAd: (set: AdSet, ad: Creative) => void;
  onToggleAdSet: (set: AdSet) => void;
  onToggleAd: (set: AdSet, ad: Creative) => void;
  onChangeObjective: () => void;
  onClose: () => void;
  onPublish: () => void;
}) {
  const [showProblems, setShowProblems] = useState(false);
  const selectedSet = selection.level !== "campaign" ? campaign.adSets.find((s) => s.id === selection.setId) : undefined;
  const selectedAd = selection.level === "ad" ? selectedSet?.ads.find((a) => a.id === selection.adId) : undefined;
  const level: Level = selection.level === "ad" && selectedAd ? "ad" : selection.level !== "campaign" && selectedSet ? "adset" : "campaign";
  const previewAd = selectedAd ?? selectedSet?.ads[0] ?? campaign.adSets[0]?.ads[0];

  return (
    <div className="flex min-h-[640px] flex-col">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_340px]">
        <StructurePanel
          campaign={campaign}
          level={level}
          selection={selection}
          onSelect={onSelect}
          onAddAdSet={onAddAdSet}
          onDeleteAdSet={onDeleteAdSet}
          onAddAd={onAddAd}
          onDeleteAd={onDeleteAd}
          onToggleAdSet={onToggleAdSet}
          onToggleAd={onToggleAd}
        />
        <div className="min-w-0 space-y-3 p-4">
          {level === "campaign" && <CampaignEditor campaign={campaign} config={config} onChange={onCampaignChange} onChangeObjective={onChangeObjective} />}
          {level === "adset" && selectedSet && (
            <AdSetEditor campaign={campaign} adSet={selectedSet} hasApp={config.hasApp ?? false} onChange={(patch) => onAdSetChange(selectedSet.id, patch)} />
          )}
          {level === "ad" && selectedSet && selectedAd && (
            <AdEditor ad={selectedAd} businessName={config.business.name} mediaEnabled={mediaEnabled} onChange={(patch) => onAdChange(selectedSet.id, selectedAd.id, patch)} />
          )}
        </div>
        <aside className="min-w-0 space-y-3 border-t border-[#DADDE1] p-4 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0">
          {level === "adset" && selectedSet ? (
            <AudienceDefinition adSet={selectedSet} />
          ) : level === "campaign" ? (
            <CampaignSummary campaign={campaign} limit={config.maxTotalBudget} />
          ) : null}
          {previewAd && (
            <div className={`${panel} p-3`}>
              <p className="mb-2 text-[14px] font-bold">Ad preview</p>
              <AdPreview ad={previewAd} businessName={config.business.name} />
            </div>
          )}
        </aside>
      </div>

      {/* Bottom bar, like an ads manager's editing pane */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-[#DADDE1] bg-white px-4 py-2.5">
        <button type="button" onClick={onClose} className={`${button} ${GREY}`}>
          <X className="h-4 w-4" /> Close
        </button>
        <span className="text-[13px] text-[#65676B]">
          {naira(plannedSpend(campaign))} planned of {naira(config.maxTotalBudget)}
        </span>
        {problems.length > 0 ? (
          <button type="button" onClick={() => setShowProblems(!showProblems)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#B76E00]">
            <Info className="h-4 w-4" /> {problems.length} thing{problems.length === 1 ? "" : "s"} to fix
            <ChevronDown className={`h-4 w-4 transition ${showProblems ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2E7D1E]">
            <Check className="h-4 w-4" /> Ready to publish
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          {runsLeft !== null && <span className="text-[12px] text-[#65676B]">{runsLeft} publishes left</span>}
          <button type="button" disabled={running || problems.length > 0 || runsLeft === 0} onClick={onPublish} className={`${button} ${BLUE} px-5 py-2`}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Publishing…" : "Publish"}
          </button>
        </span>
        {showProblems && problems.length > 0 && (
          <ul className="w-full list-disc space-y-0.5 pl-6 text-[12px] text-[#B76E00]">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {error && (
          <p className="w-full text-[13px] font-semibold text-[#E41E3F]" role="alert">
            {error}
          </p>
        )}
        {running && <p className="w-full text-[12px] text-[#65676B]">Reviewing your ads and running the campaign. This can take up to a minute.</p>}
      </div>
    </div>
  );
}

function StructurePanel({
  campaign,
  level,
  selection,
  onSelect,
  onAddAdSet,
  onDeleteAdSet,
  onAddAd,
  onDeleteAd,
  onToggleAdSet,
  onToggleAd,
}: {
  campaign: Campaign;
  level: Level;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onAddAdSet: (copyOf?: AdSet) => void;
  onDeleteAdSet: (set: AdSet) => void;
  onAddAd: (set: AdSet, copyOf?: Creative) => void;
  onDeleteAd: (set: AdSet, ad: Creative) => void;
  onToggleAdSet: (set: AdSet) => void;
  onToggleAd: (set: AdSet, ad: Creative) => void;
}) {
  const totalAds = allAds(campaign).length;
  const isSelected = (kind: Level, id?: string) =>
    kind === level &&
    (kind === "campaign" ||
      (kind === "adset" && selection.level !== "campaign" && selection.setId === id) ||
      (kind === "ad" && selection.level === "ad" && selection.adId === id));
  const row = (active: boolean, dim = false) =>
    `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${active ? "bg-[#E7F3FF] font-semibold text-[#1877F2]" : "hover:bg-[#F2F3F5]"} ${dim ? "opacity-50" : ""}`;
  const icon = "rounded p-1 text-[#65676B] hover:bg-[#E4E6EB] disabled:opacity-30";

  return (
    <nav aria-label="Campaign structure" className="border-b border-[#DADDE1] bg-white p-3 lg:border-b-0 lg:border-r">
      <button type="button" onClick={() => onSelect({ level: "campaign" })} className={row(isSelected("campaign"))}>
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">{campaign.name || "Campaign"}</span>
      </button>
      <ul className="ml-4 mt-1 space-y-1 border-l border-[#DADDE1] pl-2">
        {campaign.adSets.map((item) => (
          <li key={item.id}>
            <div className="flex items-center gap-1">
              <Toggle on={!item.paused} label={`${item.paused ? "Switch on" : "Switch off"} ${item.name}`} onChange={() => onToggleAdSet(item)} />
              <button type="button" onClick={() => onSelect({ level: "adset", setId: item.id })} className={row(isSelected("adset", item.id), item.paused)}>
                <Layers className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
              <button
                type="button"
                title="Duplicate"
                aria-label={`Duplicate ${item.name}`}
                disabled={campaign.adSets.length >= MAX_AD_SETS || totalAds + item.ads.length > MAX_TOTAL_ADS}
                onClick={() => onAddAdSet(item)}
                className={icon}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button type="button" title="Delete" aria-label={`Delete ${item.name}`} disabled={campaign.adSets.length === 1} onClick={() => onDeleteAdSet(item)} className={icon}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-[#DADDE1] pl-2">
              {item.ads.map((ad) => (
                <li key={ad.id} className="flex items-center gap-1">
                  <Toggle on={!ad.paused} disabled={item.paused} label={`${ad.paused ? "Switch on" : "Switch off"} ${ad.name}`} onChange={() => onToggleAd(item, ad)} />
                  <button type="button" onClick={() => onSelect({ level: "ad", setId: item.id, adId: ad.id })} className={row(isSelected("ad", ad.id), ad.paused || item.paused)}>
                    <ImageIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{ad.name}</span>
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    aria-label={`Duplicate ${ad.name}`}
                    disabled={item.ads.length >= MAX_CREATIVES || totalAds >= MAX_TOTAL_ADS}
                    onClick={() => onAddAd(item, ad)}
                    className={icon}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="Delete" aria-label={`Delete ${ad.name}`} disabled={item.ads.length === 1} onClick={() => onDeleteAd(item, ad)} className={icon}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  disabled={item.ads.length >= MAX_CREATIVES || totalAds >= MAX_TOTAL_ADS}
                  onClick={() => onAddAd(item)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#1877F2] hover:bg-[#E7F3FF] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" /> Create ad
                </button>
              </li>
            </ul>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={campaign.adSets.length >= MAX_AD_SETS}
            onClick={() => onAddAdSet()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold text-[#1877F2] hover:bg-[#E7F3FF] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Create ad set
          </button>
        </li>
      </ul>
      <p className="mt-3 px-2 text-[11px] leading-4 text-[#8A8D91]">
        Up to {MAX_AD_SETS} ad sets, {MAX_CREATIVES} ads each, {MAX_TOTAL_ADS} ads in all. Switched-off items aren&apos;t published.
      </p>
    </nav>
  );
}

// ----------------------------------------------------------- form pieces

function Section({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className={`${panel} space-y-4 p-4`}>
      <div>
        <p role="heading" aria-level={3} className="text-[16px] font-bold">{title}</p>
        {help && <p className="mt-0.5 text-[13px] text-[#65676B]">{help}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[13px] font-semibold text-[#1C1E21]">{children}</span>;
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      {children}
      {help && <span className="mt-1 block text-[12px] leading-4 text-[#65676B]">{help}</span>}
    </label>
  );
}

function Chips({ options, selected, onToggle }: { options: Array<{ id: string; label: string }>; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${on ? "border-[#1877F2] bg-[#E7F3FF] font-semibold text-[#1877F2]" : "border-[#CCD0D5] text-[#1C1E21] hover:bg-[#F2F3F5]"}`}
          >
            {on && <Check className="h-3 w-3" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Radio({ checked, onSelect, title, help, disabled }: { checked: boolean; onSelect: () => void; title: string; help: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-md border p-3 text-left disabled:opacity-50 ${checked ? "border-[#1877F2] bg-[#E7F3FF]" : "border-[#DADDE1] hover:bg-[#F7F8FA]"}`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-[#1877F2]" : "border-[#8A8D91]"}`}>
        {checked && <span className="h-2 w-2 rounded-full bg-[#1877F2]" />}
      </span>
      <span>
        <strong className="block text-[13px]">{title}</strong>
        <span className="mt-0.5 block text-[12px] leading-4 text-[#65676B]">{help}</span>
      </span>
    </button>
  );
}

const toggle = <T extends string>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

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
          <input type="number" min={0} step={strategy === "ROAS_GOAL" ? 0.1 : 50} value={amount ?? 0} onChange={(e) => onChange(strategy, Number(e.target.value))} className={inputClass} />
        </Field>
      )}
    </div>
  );
}

// -------------------------------------------------------------- campaign

function ObjectiveDialog({ value, onCancel, onContinue }: { value: Objective; onCancel: () => void; onContinue: (objective: Objective) => void }) {
  const [choice, setChoice] = useState<Objective>(value);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="objective-title">
      <div className="w-full max-w-[720px] overflow-hidden rounded-lg bg-white text-[#1C1E21] shadow-2xl" style={{ fontFamily: "Helvetica, Arial, 'Segoe UI', sans-serif" }}>
        <div className="flex items-center justify-between border-b border-[#DADDE1] px-5 py-4">
          <p role="heading" aria-level={2} id="objective-title" className="text-[20px] font-bold">
            Choose a campaign objective
          </p>
          <button type="button" onClick={onCancel} aria-label="Close" className="rounded-full p-1.5 text-[#65676B] hover:bg-[#F2F3F5]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2">
          <div className="space-y-1 p-3">
            {(Object.keys(OBJECTIVES) as Objective[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setChoice(key)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[15px] ${choice === key ? "bg-[#E7F3FF]" : "hover:bg-[#F2F3F5]"}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${choice === key ? "border-[#1877F2]" : "border-[#8A8D91]"}`}>
                  {choice === key && <span className="h-2.5 w-2.5 rounded-full bg-[#1877F2]" />}
                </span>
                <span className="font-semibold">{OBJECTIVES[key].label}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-[#DADDE1] bg-[#F7F8FA] p-5 sm:border-l sm:border-t-0">
            <p className="text-[17px] font-bold">{OBJECTIVES[choice].label}</p>
            <p className="mt-2 text-[14px] leading-6">{OBJECTIVES[choice].help}</p>
            <p className="mt-4 text-[13px] font-semibold">Good for:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-[#65676B]">
              {OBJECTIVE_DESTINATIONS[choice].length ? (
                OBJECTIVE_DESTINATIONS[choice].map((d) => <li key={d}>{DESTINATIONS[d].label}</li>)
              ) : (
                <li>Reach and ad recall (no conversion location)</li>
              )}
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#DADDE1] px-5 py-3">
          <button type="button" onClick={onCancel} className={`${button} ${GREY}`}>
            Cancel
          </button>
          <button type="button" onClick={() => onContinue(choice)} className={`${button} ${BLUE}`}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignEditor({
  campaign,
  config,
  onChange,
  onChangeObjective,
}: {
  campaign: Campaign;
  config: SimConfig;
  onChange: (campaign: Campaign) => void;
  onChangeObjective: () => void;
}) {
  const set = (patch: Partial<Campaign>) => onChange({ ...campaign, ...patch });
  const days = campaignDays(campaign);
  return (
    <>
      <Section title="Campaign name">
        <input value={campaign.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
      </Section>

      <Section title="Special ad categories" help="Declare if your ads are about credit, employment, housing, or social issues, elections or politics.">
        <Field
          label="Category"
          help={`${SPECIAL_CATEGORIES[campaign.specialCategory].help} Ads in these categories must be declared and have restricted targeting (ages 18–65+, all genders, no detailed targeting or lookalikes). Undeclared ones get rejected.`}
        >
          <select value={campaign.specialCategory} onChange={(e) => set({ specialCategory: e.target.value as SpecialCategory })} className={inputClass}>
            {(Object.keys(SPECIAL_CATEGORIES) as SpecialCategory[]).map((key) => (
              <option key={key} value={key}>
                {key === "NONE" ? "No categories declared" : SPECIAL_CATEGORIES[key].label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Campaign details">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#F7F8FA] px-3 py-2.5">
          <span className="text-[13px]">
            <span className="text-[#65676B]">Campaign objective</span>
            <strong className="ml-2">{OBJECTIVES[campaign.objective].label}</strong>
          </span>
          <button type="button" onClick={onChangeObjective} className={`${button} ${GREY}`}>
            Change
          </button>
        </div>
      </Section>

      <Section title="Budget" help="Choose who controls how the money is shared between ad sets.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Radio
            checked={campaign.budgetMode === "CAMPAIGN"}
            onSelect={() => set({ budgetMode: "CAMPAIGN", abTest: false })}
            title="Campaign budget"
            help="One budget; the system moves money to the ad sets getting the best results."
          />
          <Radio checked={campaign.budgetMode === "AD_SET"} onSelect={() => set({ budgetMode: "AD_SET" })} title="Ad set budget" help="Set a budget on each ad set yourself." />
        </div>
        {campaign.budgetMode === "CAMPAIGN" && (
          <>
            <BudgetFields budget={campaign.budget} days={days} onChange={(budget) => set({ budget })} />
            <BidFields strategy={campaign.bidStrategy} amount={campaign.bidAmount} objective={campaign.objective} onChange={(bidStrategy, bidAmount) => set({ bidStrategy, bidAmount })} />
          </>
        )}
        <p className="text-[13px] text-[#65676B]">
          Planned spend <strong className="text-[#1C1E21]">{naira(plannedSpend(campaign))}</strong> of your practice budget of {naira(config.maxTotalBudget)}.
        </p>
      </Section>

      <Section title="A/B test" help="Find out which of your ad sets works better.">
        <label className="flex items-start gap-3 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#1877F2]"
            checked={campaign.abTest}
            disabled={campaign.adSets.length < 2}
            onChange={(e) => set({ abTest: e.target.checked, ...(e.target.checked ? { budgetMode: "AD_SET" as const } : {}) })}
          />
          <span>
            <strong>Create A/B test</strong>
            <span className="block text-[12px] leading-4 text-[#65676B]">
              {campaign.adSets.length < 2
                ? "Create a second ad set (for example a different audience) to test one against the other."
                : "The audience is split so each person sees only one ad set; each keeps its own budget. Change one thing between them to learn what works."}
            </span>
          </span>
        </label>
      </Section>
    </>
  );
}

function CampaignSummary({ campaign, limit }: { campaign: Campaign; limit: number }) {
  const total = plannedSpend(campaign);
  const live = campaign.adSets.filter((s) => !s.paused);
  return (
    <div className={`${panel} p-4 text-[13px]`}>
      <p className="text-[14px] font-bold">Campaign summary</p>
      <ul className="mt-2 space-y-1.5">
        <li>
          <span className="text-[#65676B]">Objective:</span> {OBJECTIVES[campaign.objective].label}
        </li>
        <li>
          <span className="text-[#65676B]">Ad sets:</span> {live.length} on
          {campaign.adSets.length > live.length ? `, ${campaign.adSets.length - live.length} off` : ""}
        </li>
        <li>
          <span className="text-[#65676B]">Ads:</span> {allAds(campaign).filter((a) => !a.paused).length} on
        </li>
        <li>
          <span className="text-[#65676B]">Budget:</span> {campaign.budgetMode === "CAMPAIGN" ? "campaign budget" : "ad set budgets"}
        </li>
        <li>
          <span className="text-[#65676B]">Schedule:</span> up to {campaignDays(campaign)} days
        </li>
      </ul>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E4E6EB]">
        <div className={`h-full rounded-full ${total > limit ? "bg-[#FA383E]" : "bg-[#1877F2]"}`} style={{ width: `${Math.min(100, (total / Math.max(1, limit)) * 100)}%` }} />
      </div>
      <p className="mt-1 text-[12px] text-[#65676B]">
        {naira(total)} of the {naira(limit)} practice budget
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- ad set

function AdSetEditor({ campaign, adSet, hasApp, onChange }: { campaign: Campaign; adSet: AdSet; hasApp: boolean; onChange: (patch: Partial<AdSet>) => void }) {
  const a = adSet.audience;
  const setAudience = (patch: Partial<AdSetAudience>) => onChange({ audience: { ...a, ...patch } });
  const destinations = OBJECTIVE_DESTINATIONS[campaign.objective];
  const goals = goalsFor(campaign.objective, adSet.destination);
  const special = campaign.specialCategory !== "NONE";

  return (
    <>
      <Section title="Ad set name">
        <input value={adSet.name} maxLength={60} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </Section>

      <Section title="Conversion" help="Where you want people to go, and what the system should get you most of.">
        {destinations.length > 0 ? (
          <div>
            <Label>Conversion location</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {destinations.map((key) => (
                <Radio
                  key={key}
                  checked={adSet.destination === key}
                  disabled={key === "APP" && !hasApp}
                  onSelect={() => {
                    const options = goalsFor(campaign.objective, key);
                    onChange({ destination: key, performanceGoal: options.includes(adSet.performanceGoal) ? adSet.performanceGoal : options[0] });
                  }}
                  title={`${DESTINATIONS[key].label}${key === "APP" && !hasApp ? " (no app)" : ""}`}
                  help={DESTINATIONS[key].help}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#65676B]">Awareness ads are shown on their own: there&apos;s no conversion location.</p>
        )}
        <Field label="Performance goal" help={`Results will count ${PERFORMANCE_GOALS[adSet.performanceGoal].result.toLowerCase()}.`}>
          <select value={adSet.performanceGoal} onChange={(e) => onChange({ performanceGoal: e.target.value as PerformanceGoal })} className={inputClass}>
            {goals.map((key) => (
              <option key={key} value={key}>
                {PERFORMANCE_GOALS[key].label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Budget & schedule">
        {campaign.budgetMode === "AD_SET" ? (
          <>
            <BudgetFields budget={adSet.budget} days={adSet.days} onChange={(budget) => onChange({ budget })} />
            <BidFields strategy={adSet.bidStrategy} amount={adSet.bidAmount} objective={campaign.objective} onChange={(bidStrategy, bidAmount) => onChange({ bidStrategy, bidAmount })} />
          </>
        ) : (
          <p className="text-[13px] text-[#65676B]">This campaign uses a campaign budget: the system decides how much this ad set spends.</p>
        )}
        <Field label="Run for (days)" help={campaign.budgetMode === "AD_SET" ? `Spends about ${naira(adSetPlannedSpend(adSet))} in total.` : undefined}>
          <input type="number" min={1} max={30} value={adSet.days} onChange={(e) => onChange({ days: Number(e.target.value) })} className={`${inputClass} sm:w-40`} />
        </Field>
      </Section>

      <Section title="Audience" help="Define who you want to see your ads.">
        <label className="flex items-start gap-3 rounded-md border border-[#DADDE1] p-3 text-[13px]">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1877F2]" checked={a.advantage} onChange={(e) => setAudience({ advantage: e.target.checked })} />
          <span>
            <strong>Automatic audience</strong>
            <span className="block text-[12px] leading-4 text-[#65676B]">
              Your targeting becomes a suggestion: the system may also show ads to people outside it when they&apos;re likely to act.
            </span>
          </span>
        </label>

        <div>
          <Label>Custom audiences</Label>
          <div className="space-y-1.5">
            {(Object.keys(CUSTOM_AUDIENCES) as CustomAudience[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1877F2]" checked={a.custom.includes(key)} onChange={() => setAudience({ custom: toggle(a.custom, key) })} />
                <span>
                  {CUSTOM_AUDIENCES[key].label}
                  <span className="block text-[12px] text-[#65676B]">
                    {CUSTOM_AUDIENCES[key].help} About {count(CUSTOM_AUDIENCES[key].size)} people.
                  </span>
                </span>
              </label>
            ))}
          </div>
          {a.custom.length > 0 && <p className="mt-1 text-[12px] text-[#B76E00]">With a custom audience, only those people (and any lookalike) see the ads.</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lookalike audience" help={special ? "Not available with special ad categories." : "People similar to your customers. Smaller % = closer match, fewer people."}>
            <select value={a.lookalike} disabled={special} onChange={(e) => setAudience({ lookalike: Number(e.target.value) })} className={inputClass}>
              <option value={0}>None</option>
              {Object.entries(LOOKALIKES).map(([key, info]) => (
                <option key={key} value={key}>
                  Customers · {info.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-start gap-2 self-end pb-2 text-[13px]">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1877F2]" checked={a.excludeCustomers} onChange={(e) => setAudience({ excludeCustomers: e.target.checked })} />
            <span>
              Exclude past customers
              <span className="block text-[12px] text-[#65676B]">Find new customers only.</span>
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
          <Label>Detailed targeting</Label>
          <p className="mb-1.5 text-[12px] text-[#65676B]">Include people who match at least ONE of these interests.</p>
          {special ? (
            <p className="text-[13px] text-[#65676B]">Not available with special ad categories.</p>
          ) : (
            <Chips options={INTERESTS.map((i) => ({ id: i, label: i }))} selected={a.interests} onToggle={(id) => setAudience({ interests: toggle(a.interests, id).slice(0, 10) })} />
          )}
        </div>
      </Section>

      <Section title="Placements" help="Where your ads appear.">
        <div className="grid gap-2 sm:grid-cols-2">
          <Radio
            checked={adSet.placementMode === "AUTO"}
            onSelect={() => onChange({ placementMode: "AUTO" })}
            title="Automatic placements (recommended)"
            help="The system shows your ads wherever they're likely to do best, at a lower cost."
          />
          <Radio checked={adSet.placementMode === "MANUAL"} onSelect={() => onChange({ placementMode: "MANUAL" })} title="Manual placements" help="Choose exactly where your ads appear." />
        </div>
        {adSet.placementMode === "MANUAL" && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(PLACEMENTS) as Placement[]).map((key) => (
              <label key={key} className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#1877F2]" checked={adSet.placements.includes(key)} onChange={() => onChange({ placements: toggle(adSet.placements, key) })} />
                <span>
                  {PLACEMENTS[key].label}
                  <span className="block text-[12px] text-[#65676B]">{PLACEMENTS[key].help}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

/** The audience size gauge an ads manager shows beside the targeting. */
function AudienceDefinition({ adSet }: { adSet: AdSet }) {
  const size = adSetAudienceSize(adSet.audience);
  const none = !adSet.audience.locations.length;
  // Needle: specific (left) to broad (right), on a log scale.
  const position = none ? 0 : Math.min(1, Math.max(0, (Math.log10(Math.max(size, 1)) - 3.5) / 4));
  const angle = -90 + position * 180;
  const verdict = none ? "Choose a location" : size < 200_000 ? "Your audience is fairly specific." : size > 8_000_000 ? "Your audience is very broad." : "Your audience is well defined.";
  return (
    <div className={`${panel} p-4 text-[13px]`}>
      <p className="text-[14px] font-bold">Audience definition</p>
      <svg viewBox="0 0 200 110" className="mx-auto mt-2 w-48" aria-hidden>
        <path d="M20 100 A80 80 0 0 1 73 26" stroke="#F7B928" strokeWidth="14" fill="none" />
        <path d="M75 25 A80 80 0 0 1 125 25" stroke="#42B72A" strokeWidth="14" fill="none" />
        <path d="M127 26 A80 80 0 0 1 180 100" stroke="#FA383E" strokeWidth="14" fill="none" />
        <g transform={`rotate(${angle} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="34" stroke="#1C1E21" strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill="#1C1E21" />
      </svg>
      <div className="flex justify-between text-[11px] text-[#65676B]">
        <span>Specific</span>
        <span>Broad</span>
      </div>
      <p className="mt-2 font-semibold">{verdict}</p>
      {!none && (
        <p className="mt-1 text-[#65676B]">
          Estimated audience size:{" "}
          <strong className="text-[#1C1E21]">
            {compact(size * 0.85)} – {compact(size * 1.15)}
          </strong>
        </p>
      )}
      <p className="mt-2 text-[12px] text-[#65676B]">
        Placements: {adSet.placementMode === "AUTO" ? "automatic" : activePlacements(adSet).map((p) => PLACEMENTS[p].label).join(", ")}
      </p>
    </div>
  );
}

// -------------------------------------------------------------------- ad

function AdEditor({ ad, businessName, mediaEnabled, onChange }: { ad: Creative; businessName: string; mediaEnabled: boolean; onChange: (patch: Partial<Creative>) => void }) {
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
    <>
      <Section title="Ad name">
        <input value={ad.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value })} className={inputClass} />
      </Section>

      <Section title="Identity" help="The page your ad runs from.">
        <div className="flex items-center gap-2 rounded-md bg-[#F7F8FA] px-3 py-2.5 text-[13px]">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1C1E21] text-[12px] font-bold text-white">{businessName.slice(0, 1).toUpperCase()}</span>
          <strong>{businessName}</strong>
          <span className="text-[#65676B]">(practice page)</span>
        </div>
      </Section>

      <Section title="Ad setup" help="Choose how to show your ad.">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(FORMATS) as AdFormat[]).map((key) => (
            <Radio
              key={key}
              checked={ad.format === key}
              onSelect={() => changeFormat(key)}
              title={FORMATS[key]}
              help={key === "IMAGE" ? "One image." : key === "VIDEO" ? "One video (cover image and script)." : "2 or more scrollable cards."}
            />
          ))}
        </div>
      </Section>

      <Section title="Ad creative" help="The media and words people see. Make your ads genuinely different so the system can find the best.">
        {ad.format === "CAROUSEL" ? (
          <div>
            <Label>
              Cards ({ad.cards.length} of {MAX_CARDS})
            </Label>
            <div className="space-y-2">
              {ad.cards.map((item, index) => (
                <div key={index} className="flex gap-3 rounded-md border border-[#DADDE1] p-2.5">
                  <ImagePicker value={item.image} enabled={mediaEnabled} small onChange={(image) => onChange({ cards: ad.cards.map((c, i) => (i === index ? { ...c, image } : c)) })} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      value={item.headline}
                      maxLength={60}
                      onChange={(e) => onChange({ cards: ad.cards.map((c, i) => (i === index ? { ...c, headline: e.target.value } : c)) })}
                      placeholder={`Card ${index + 1} headline`}
                      className={inputClass}
                    />
                    {ad.cards.length > 2 && (
                      <button type="button" onClick={() => onChange({ cards: ad.cards.filter((_, i) => i !== index) })} className="text-[12px] font-semibold text-[#E41E3F]">
                        Remove card
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {ad.cards.length < MAX_CARDS && (
              <button type="button" onClick={() => onChange({ cards: [...ad.cards, { image: "", headline: "" }] })} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[#1877F2]">
                <Plus className="h-4 w-4" /> Add card
              </button>
            )}
          </div>
        ) : (
          <div>
            <Label>{ad.format === "VIDEO" ? "Video cover image (first frame)" : "Image"}</Label>
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

        <Field label="Primary text" help={`${ad.primaryText.length}/600 · Tell people what your ad is about.`}>
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
            <Field label="Headline" help={`${ad.headline.length}/80`}>
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
      </Section>
    </>
  );
}

/** Uploads an image (shrunk in the browser first) and shows it. */
function ImagePicker({ value, onChange, enabled, small = false }: { value: string; onChange: (ref: string) => void; enabled: boolean; small?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = small ? "h-20 w-20" : "h-40 w-40";

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
      <div className={`${box} flex shrink-0 items-center justify-center rounded-md border border-dashed border-[#CCD0D5] p-2 text-center text-[11px] text-[#8A8D91]`}>
        Image uploads aren&apos;t available yet; describe it below.
      </div>
    );

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || !enabled}
        className={`${box} relative flex items-center justify-center overflow-hidden rounded-md border border-dashed border-[#CCD0D5] bg-[#F7F8FA] text-[#65676B] hover:border-[#1877F2]`}
        aria-label={value ? "Replace image" : "Upload image"}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaSrc(value, "thumb")} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
            <ImagePlus className="h-5 w-5" /> Add media
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-[#1877F2]" />
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
      {value && !small && enabled && (
        <button type="button" onClick={() => onChange("")} className="mt-1 block text-[12px] font-semibold text-[#E41E3F]">
          Remove image
        </button>
      )}
      {error && <p className={`mt-1 text-[11px] text-[#E41E3F] ${small ? "w-20" : "w-40"}`}>{error}</p>}
    </div>
  );
}

/** A generic sponsored-post mock-up (our own design). */
function AdPreview({ ad, businessName }: { ad: Creative; businessName: string }) {
  const [view, setView] = useState<"feed" | "story">("feed");
  const [cardIndexRaw, setCard] = useState(0);
  const cardIndex = Math.min(cardIndexRaw, Math.max(0, ad.cards.length - 1));
  const image = ad.format === "CAROUSEL" ? ad.cards[cardIndex]?.image : ad.image;

  const visual = (shape: string) => (
    <div className={`relative flex ${shape} items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C1E21] to-[#1877F2] text-center`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaSrc(image)} alt={ad.visual || "Ad image"} className="h-full w-full object-cover" />
      ) : (
        <p className="p-5 text-[12px] italic leading-5 text-white/90">{ad.visual || "Add media or describe it."}</p>
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
          <button type="button" aria-label="Previous card" onClick={() => setCard(Math.max(0, cardIndex - 1))} className="absolute left-1.5 rounded-full bg-white/90 p-1 text-[#1C1E21] disabled:opacity-30" disabled={cardIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next card"
            onClick={() => setCard(Math.min(ad.cards.length - 1, cardIndex + 1))}
            className="absolute right-1.5 rounded-full bg-white/90 p-1 text-[#1C1E21] disabled:opacity-30"
            disabled={cardIndex === ad.cards.length - 1}
          >
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
      <select value={view} onChange={(e) => setView(e.target.value as "feed" | "story")} className="w-full rounded-md border border-[#CCD0D5] bg-white px-2 py-1.5 text-[13px]" aria-label="Preview placement">
        <option value="feed">Feeds</option>
        <option value="story">Stories and Reels</option>
      </select>
      {view === "feed" ? (
        <div className="overflow-hidden rounded-lg border border-[#DADDE1] bg-white">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1C1E21] text-[13px] font-bold text-white">{businessName.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="text-[13px] font-semibold text-[#050505]">{businessName}</p>
              <p className="text-[12px] text-[#65676B]">Sponsored</p>
            </div>
          </div>
          <p className="whitespace-pre-line px-3 pb-2 text-[13px] leading-5 text-[#050505]">
            {ad.primaryText || <span className="text-[#BCC0C4]">Your primary text appears here.</span>}
          </p>
          {visual("aspect-square")}
          <div className="flex items-center justify-between gap-3 bg-[#F0F2F5] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#050505]">{headline || "Your headline"}</p>
              {ad.description && <p className="truncate text-[12px] text-[#65676B]">{ad.description}</p>}
            </div>
            <span className="shrink-0 rounded-md bg-[#E4E6EB] px-3 py-1.5 text-[13px] font-semibold text-[#050505]">{ad.cta}</span>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto w-[230px] overflow-hidden rounded-xl bg-black">
          {visual("aspect-[9/16]")}
          <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 py-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#1C1E21]">{businessName.slice(0, 1).toUpperCase()}</span>
            <p className="text-[11px] font-bold text-white">{businessName} · Sponsored</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8">
            <p className="line-clamp-2 text-[11px] leading-4 text-white">{ad.primaryText}</p>
            <span className="mt-2 block rounded-full bg-white py-1.5 text-center text-[11px] font-bold text-[#1C1E21]">{ad.cta}</span>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-4 text-[#65676B]">
        {view === "story" ? "Stories and Reels show your media tall (9:16): keep key details in the middle." : "Feeds show it square. Check both when you use several placements."}
      </p>
    </div>
  );
}

// --------------------------------------------------------------- report

/** One run's coaching report: score, goals, results, notes and advice. */
export function RunReport({ run: raw, price }: { run: SimRun; price: number }) {
  const run = useMemo(() => prepare(raw), [raw]);
  const { result, feedback } = run;
  const { goals, ratings, notes, score, totals } = result;

  return (
    <div className="space-y-4 text-[#1C1E21]">
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[#1C1E21] p-4 text-white">
        <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-[#1877F2]">
          <span className="text-xl font-bold">{score}</span>
          <span className="text-[9px] text-white/60">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/70">
            {run.campaign.name} · {OBJECTIVES[run.campaign.objective].label} · spent {naira(totals.spend)} of {naira(totals.plannedBudget)}
          </p>
          <p className="mt-1 text-[14px]">{feedback.summary}</p>
        </div>
      </div>

      {result.delivery === "REJECTED" && <p className="rounded-lg border border-[#FA383E]/40 bg-[#FFEBEE] px-4 py-3 text-[13px] font-semibold text-[#C4111D]">{notes[0]}</p>}

      {result.abTest && (
        <p className={`flex items-start gap-2 rounded-lg px-4 py-3 text-[13px] ${result.abTest.winnerId ? "bg-[#E9F7E4] text-[#2E7D1E]" : "bg-[#FFF5D6] text-[#8A6100]"}`}>
          <Trophy className="mt-0.5 h-4 w-4 shrink-0" /> {result.abTest.summary}
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal, index) => (
          <li key={index} className={`flex items-start gap-2 rounded-md px-3 py-2 text-[13px] ${goal.met ? "bg-[#E9F7E4] text-[#2E7D1E]" : "bg-[#FFEBEE] text-[#C4111D]"}`}>
            {goal.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {goal.label}: <strong>{formatGoalValue(goal.metric, goal.actual)}</strong>
              <span className="block text-[11px] opacity-75">
                target {GOAL_METRICS[goal.metric].op === "gte" ? "≥" : "≤"} {formatGoalValue(goal.metric, goal.target)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ReportTable run={run} price={price} />

      {notes.length > 0 && (
        <div className="rounded-lg border border-[#F7B928]/50 bg-[#FFF9E6] p-3">
          <p className="mb-1 text-[13px] font-bold">What happened</p>
          <ul className="list-disc space-y-1 pl-5 text-[13px]">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
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

      <p className="flex items-center gap-1 text-[11px] text-[#8A8D91]">
        <Sparkles className="h-3 w-3" />
        {ratings.source === "ai" ? "Plan and images judged by AI." : "Plan judged by simple rules."} Results come from a training simulation, not real ads.
      </p>
    </div>
  );
}

/** Ad sets and their ads in a compact table (report and admin view). */
function ReportTable({ run, price }: { run: SimRun; price: number }) {
  const { result } = run;
  const rows = (result.adSets ?? []).flatMap((set) => [
    { key: set.id, name: set.name, delivery: set.delivery, m: set as Metrics, label: set.resultLabel, child: false, winner: result.abTest?.winnerId === set.id },
    ...set.ads.map((ad) => ({ key: ad.id, name: ad.name, delivery: set.delivery, m: ad as Metrics, label: "", child: true, winner: false })),
  ]);
  const cell = "whitespace-nowrap px-3 py-2 text-right text-[12px]";
  const head = "whitespace-nowrap px-3 py-2 text-right text-[12px] font-semibold";
  return (
    <div className="overflow-x-auto rounded-lg border border-[#DADDE1]">
      <table className="w-full min-w-[760px] border-collapse text-[#1C1E21]">
        <thead>
          <tr className="border-b border-[#DADDE1] bg-[#F7F8FA]">
            <th className={`${head} text-left!`}>Ad set / ad</th>
            <th className={`${head} text-left!`}>Delivery</th>
            <th className={head}>Results</th>
            <th className={head}>Cost per result</th>
            <th className={head}>Amount spent</th>
            <th className={head}>Impressions</th>
            <th className={head}>Link clicks</th>
            <th className={head}>CTR</th>
            <th className={head}>Conversions</th>
            <th className={head}>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`border-b border-[#EBEDF0] ${row.child ? "bg-[#FAFBFC] text-[#65676B]" : ""}`}>
              <td className={`px-3 py-2 text-left text-[12px] ${row.child ? "pl-7" : "font-semibold"}`}>
                {row.name}
                {row.winner && <span className="ml-2 rounded-full bg-[#E9F7E4] px-2 py-0.5 text-[10px] font-semibold text-[#2E7D1E]">A/B winner</span>}
              </td>
              <td className="px-3 py-2 text-[12px]">{!row.child && <DeliveryCell state={row.delivery} />}</td>
              <td className={cell}>
                {count(row.m.results)}
                {row.label && <span className="block text-[10px] text-[#65676B]">{row.label}</span>}
              </td>
              <td className={cell}>{per(row.m.spend, row.m.results, 2)}</td>
              <td className={cell}>{naira(row.m.spend)}</td>
              <td className={cell}>{count(row.m.impressions)}</td>
              <td className={cell}>{count(row.m.clicks)}</td>
              <td className={cell}>{row.m.impressions ? `${((row.m.clicks / row.m.impressions) * 100).toFixed(2)}%` : "—"}</td>
              <td className={cell}>{count(row.m.conversions)}</td>
              <td className={cell}>{row.m.spend ? ((row.m.conversions * price) / row.m.spend).toFixed(2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipsByItem({ run }: { run: SimRun }) {
  const items = [
    ...(run.feedback.adSets ?? []).map((item) => ({ ...item, kind: "Ad set" })),
    ...(run.feedback.ads ?? []).map((item) => ({ ...item, kind: "Ad" })),
  ].filter((item) => item.tips.length);
  if (!items.length) return null;
  return (
    <details className="rounded-lg border border-[#DADDE1] p-3">
      <summary className="cursor-pointer text-[13px] font-bold">
        <FileText className="mr-1 inline h-4 w-4" /> Tips for each ad set and ad ({items.length})
      </summary>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className="text-[13px]">
            <strong>
              {item.kind}: {item.name}
            </strong>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-[#65676B]">
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
    <div className="rounded-md bg-[#F7F8FA] p-3">
      <div className="flex justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-[#65676B]">{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E4E6EB]">
        <div className={`h-full rounded-full ${percent >= 70 ? "bg-[#42B72A]" : percent >= 45 ? "bg-[#F7B928]" : "bg-[#FA383E]"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Advice({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-[#DADDE1] p-3">
      <p className="text-[13px] font-bold">{title}</p>
      {items.length ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-5">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] text-[#8A8D91]">Nothing to change here.</p>
      )}
    </div>
  );
}
