"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LabWorkspace from "@/components/LabWorkspace";
import AdsConfigEditor from "@/components/AdsConfigEditor";
import SocialConfigEditor from "@/components/SocialConfigEditor";
import AutomationConfigEditor from "@/components/AutomationConfigEditor";
import BackendConfigEditor from "@/components/BackendConfigEditor";
import WordPressConfigEditor from "@/components/WordPressConfigEditor";
import ContentConfigEditor from "@/components/ContentConfigEditor";
import { PieceCard } from "@/components/ContentSimulator";
import {
  DEFAULT_CONTENT_CONFIGS,
  parseContentConfig,
  type ContentConfig,
  type ContentRun,
} from "@/lib/content-sim/model";
import { DEFAULT_WP_CONFIG, parseWpConfig, parseWpWork, type WpConfig, type WpWork } from "@/lib/wp-sim/model";
import { TestResultsList } from "@/components/BackendSimulator";
import { RunResult } from "@/components/AutomationSimulator";
import { RunReport } from "@/components/AdsSimulator";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import type { AutomationRun, BackendRun, SocialRun } from "@/lib/practice-lab";
import {
  DEFAULT_BACKEND_CONFIG,
  DEFAULT_SOLUTION as DEFAULT_BACKEND_SOLUTION,
  DEFAULT_STARTER as DEFAULT_BACKEND_STARTER,
  parseBackendConfig,
  type BackendConfig,
} from "@/lib/backend-sim/model";
import {
  DEFAULT_AUTOMATION_CONFIG,
  parseAutomationConfig,
  type AutomationConfig,
} from "@/lib/automation-sim/model";
import {
  DAYS,
  DEFAULT_SOCIAL_CONFIG,
  formatSocialGoal,
  parseSocialConfig,
  PLATFORMS,
  type SocialConfig,
} from "@/lib/social-sim/model";
import type { SimRun } from "@/components/AdsSimulator";
import {
  DEFAULT_ADS_CONFIG,
  OBJECTIVES,
  parseCampaign,
  type AdsConfig,
} from "@/lib/ads-sim/model";
import {
  DEFAULT_STARTER,
  EXAMPLE_CHECKS,
  LAB_KIND_LABEL,
  type AnyLabKind,
  type LabCheck,
  type LabFiles,
  type LabKindKey,
} from "@/lib/lab-shared";

// Admin builder for a Practice Lab exercise: details, then either starter
// code, checks and a model answer (code kinds) or the brief, goals and a
// test run (ad campaign and social media simulators), or the records and
// model workflow (AI automation), or the database, API tests, starter code
// and model answer (backend API).

type Option = { id: string; name: string };
type Draft = {
  programId: string;
  levelId: string;
  kind: AnyLabKind;
  title: string;
  brief: string;
  starterFiles: LabFiles;
  solutionFiles: LabFiles | null;
  checks: LabCheck[];
  config?: AdsConfig | SocialConfig | AutomationConfig | BackendConfig | WpConfig | ContentConfig;
  published: boolean;
};

const blank = (kind: LabKindKey = "WEB"): Draft => ({
  programId: "",
  levelId: "",
  kind,
  title: "",
  brief: "",
  starterFiles: DEFAULT_STARTER[kind],
  solutionFiles: null,
  checks: EXAMPLE_CHECKS[kind],
  published: false,
});

export default function LabScenarioBuilder({ id }: { id?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(id ? null : blank());
  const [tracks, setTracks] = useState<Option[]>([]);
  const [mediaEnabled, setMediaEnabled] = useState(false);
  const [levels, setLevels] = useState<Option[]>([]);
  const [tab, setTab] = useState<"starter" | "solution">("starter");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/lab", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        setTracks(body.tracks ?? []);
        setMediaEnabled(body.mediaEnabled === true);
        setLevels(body.levels ?? []);
        setDraft((current) =>
          current && !id
            ? {
                ...current,
                programId: current.programId || body.tracks?.[0]?.id || "",
                levelId: current.levelId || body.levels?.[0]?.id || "",
              }
            : current,
        );
      })
      .catch(() => setMessage({ text: "Unable to load tracks.", error: true }));
    if (!id) return;
    fetch(`/api/admin/internship/lab/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load.");
        // Ad exercises come without files or checks.
        setDraft({
          starterFiles: {},
          solutionFiles: null,
          checks: [],
          ...body,
        } as Draft);
      })
      .catch((loadError: unknown) =>
        setMessage({
          text:
            loadError instanceof Error ? loadError.message : "Unable to load.",
          error: true,
        }),
      );
  }, [id]);

  if (!draft)
    return (
      <p className="p-6 text-sm text-slate-500">
        {message?.text ?? "Loading…"}
      </p>
    );

  const change = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setMessage(null);
  };

  const changeKind = (kind: AnyLabKind) => {
    if (kind === draft.kind) return;
    // Backend APIs: the example database, tests, starter and model answer.
    if (kind === "BACKEND") {
      change({
        kind,
        config: DEFAULT_BACKEND_CONFIG,
        starterFiles: DEFAULT_BACKEND_STARTER,
        solutionFiles: DEFAULT_BACKEND_SOLUTION,
        checks: [],
      });
      return;
    }
    // AI content: the Prompt Lab example (the editor switches modes).
    if (kind === "CONTENT") {
      change({ kind, config: DEFAULT_CONTENT_CONFIGS.PROMPT, starterFiles: {}, solutionFiles: null, checks: [] });
      return;
    }
    // WordPress: the example site and checks.
    if (kind === "WORDPRESS") {
      change({ kind, config: DEFAULT_WP_CONFIG, starterFiles: {}, solutionFiles: null, checks: [] });
      return;
    }
    // Simulators: start from that simulator's example settings.
    if (kind === "ADS" || kind === "SOCIAL" || kind === "AUTOMATION") {
      change({
        kind,
        config:
          kind === "ADS"
            ? DEFAULT_ADS_CONFIG
            : kind === "SOCIAL"
              ? DEFAULT_SOCIAL_CONFIG
              : DEFAULT_AUTOMATION_CONFIG,
      });
      return;
    }
    // Different kinds have different files; start from that kind's example.
    change({
      kind,
      starterFiles: DEFAULT_STARTER[kind],
      solutionFiles: null,
      checks: EXAMPLE_CHECKS[kind],
    });
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(
        id ? `/api/admin/internship/lab/${id}` : "/api/admin/internship/lab",
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save.");
      if (!id) {
        router.replace(`/admin/internship/lab/${body.id}`);
        return;
      }
      setMessage({ text: "Saved.", error: false });
    } catch (saveError) {
      setMessage({
        text:
          saveError instanceof Error ? saveError.message : "Unable to save.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !id ||
      !window.confirm("Delete this exercise and every intern's attempts at it?")
    )
      return;
    const response = await fetch(`/api/admin/internship/lab/${id}`, {
      method: "DELETE",
    });
    if (response.ok) router.replace("/admin/internship/lab");
    else setMessage({ text: "Unable to delete.", error: true });
  }

  const updateCheck = (index: number, patch: Partial<LabCheck>) =>
    change({
      checks: draft.checks.map((check, i) =>
        i === index ? { ...check, ...patch } : check,
      ),
    });

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link
        href="/admin/internship/lab"
        className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Practice Lab
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-semibold text-[#1C1D52]">
          {id ? "Edit exercise" : "New exercise"}
        </h1>
        <div className="flex gap-2">
          {id && (
            <button
              type="button"
              onClick={() => void remove()}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {message && (
        <p
          className={`rounded-lg px-4 py-3 text-xs font-semibold ${message.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <section className="grid gap-4 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] md:grid-cols-2">
        <Labelled label="Title">
          <input
            value={draft.title}
            onChange={(event) => change({ title: event.target.value })}
            placeholder="e.g. Build a responsive pricing card"
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52]"
          />
        </Labelled>
        <Labelled label="Kind">
          <select
            value={draft.kind}
            onChange={(event) => changeKind(event.target.value as AnyLabKind)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
          >
            {(Object.keys(LAB_KIND_LABEL) as AnyLabKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {LAB_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Track">
          <select
            value={draft.programId}
            onChange={(event) => change({ programId: event.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Level">
          <select
            value={draft.levelId}
            onChange={(event) => change({ levelId: event.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
          >
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </Labelled>
        <div className="md:col-span-2">
          <Labelled label="Brief (what the intern should build)">
            <textarea
              value={draft.brief}
              rows={5}
              onChange={(event) => change({ brief: event.target.value })}
              placeholder={
                draft.kind === "BACKEND"
                  ? "What the API should do, e.g.\nBuild the Lagos Bookshop API:\n• GET /api/books lists every book (?inStock=true: only books in stock)\n• GET /api/books/:id gets one book, or 404 with { error }\n• POST /api/books adds a book (title, author, price in naira); 400 with { error } if anything is missing or invalid\n• DELETE /api/books/:id removes a book: 204, or 404"
                  : draft.kind === "AUTOMATION"
                  ? "What the intern should automate, e.g.\nSwiftBox reads every contact form by hand. Build a workflow that routes each message the way the brief below says."
                  : draft.kind === "ADS"
                    ? "Set the scene, e.g.\nMama Put Express wants more lunch orders in Lagos this week. Plan a campaign that hits the goals below without overspending."
                  : "Describe the task, requirements and any details the checks look for, e.g.\n- A heading that says “Pro plan”\n- A button with the text “Subscribe”"
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs leading-5 text-[#1C1D52]"
            />
          </Labelled>
        </div>
        <label className="flex items-center gap-2 text-xs text-[#1C1D52]">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(event) => change({ published: event.target.checked })}
            className="accent-[#5FBB46]"
          />
          Published (interns can see it)
        </label>
      </section>

      {draft.kind === "BACKEND" ? (
        <BackendConfigEditor
          config={parseBackendConfig(draft.config ?? DEFAULT_BACKEND_CONFIG)}
          onChange={(config) => change({ config })}
          starterFiles={draft.starterFiles}
          solutionFiles={draft.solutionFiles}
          onStarterChange={(starterFiles) => change({ starterFiles })}
          onSolutionChange={(solutionFiles) => change({ solutionFiles })}
        />
      ) : draft.kind === "ADS" ? (
        <AdsConfigEditor
          config={(draft.config as AdsConfig | undefined) ?? DEFAULT_ADS_CONFIG}
          onChange={(config) => change({ config })}
          mediaEnabled={mediaEnabled}
        />
      ) : draft.kind === "AUTOMATION" ? (
        <AutomationConfigEditor
          config={parseAutomationConfig(draft.config ?? DEFAULT_AUTOMATION_CONFIG)}
          onChange={(config) => change({ config })}
        />
      ) : draft.kind === "CONTENT" ? (
        <ContentConfigEditor
          config={parseContentConfig(draft.config ?? DEFAULT_CONTENT_CONFIGS.PROMPT)}
          onChange={(config) => change({ config })}
        />
      ) : draft.kind === "WORDPRESS" ? (
        <WordPressConfigEditor
          config={parseWpConfig(draft.config ?? DEFAULT_WP_CONFIG)}
          onChange={(config) => change({ config })}
        />
      ) : draft.kind === "SOCIAL" ? (
        <SocialConfigEditor
          config={parseSocialConfig(draft.config ?? DEFAULT_SOCIAL_CONFIG)}
          onChange={(config) => change({ config })}
        />
      ) : (
        <CodeSections
          kind={draft.kind}
          draft={draft}
          change={change}
          tab={tab}
          setTab={setTab}
          updateCheck={updateCheck}
        />
      )}

      {id && <Attempts id={id} kind={draft.kind} config={draft.config} />}
    </div>
  );
}

/** Checks, starter code and model answer for code exercises. */
function CodeSections({
  kind,
  draft,
  change,
  tab,
  setTab,
  updateCheck,
}: {
  kind: LabKindKey;
  draft: Draft;
  change: (patch: Partial<Draft>) => void;
  tab: "starter" | "solution";
  setTab: (tab: "starter" | "solution") => void;
  updateCheck: (index: number, patch: Partial<LabCheck>) => void;
}) {
  return (
    <>
      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">Checks</h2>
            <p className="text-[10px] leading-4 text-slate-500">
              JavaScript run in the preview after it loads. Return true to pass.
              You can use <code>document</code>, click elements and{" "}
              <code>await</code>. Checks run in order, so earlier clicks carry
              over.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              change({
                checks: [
                  ...draft.checks,
                  { label: "New check", code: "return true;" },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
          >
            <Plus className="h-3 w-3" /> Add check
          </button>
        </div>
        <ol className="space-y-2">
          {draft.checks.map((check, index) => (
            <CheckEditor
              key={index}
              index={index}
              check={check}
              onChange={(patch) => updateCheck(index, patch)}
              onRemove={() =>
                change({ checks: draft.checks.filter((_, i) => i !== index) })
              }
            />
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div className="flex gap-2">
          {(["starter", "solution"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab === key ? "bg-[#1C1D52] text-white" : "bg-white text-slate-600"}`}
            >
              {key === "starter"
                ? "Starter code (what interns get)"
                : "Model answer (test your checks)"}
            </button>
          ))}
        </div>
        {tab === "starter" ? (
          <LabWorkspace
            key={`starter-${kind}`}
            kind={kind}
            files={draft.starterFiles}
            onFilesChange={(starterFiles) => change({ starterFiles })}
            checks={draft.checks}
            checksLabel="Run checks on starter"
          />
        ) : (
          <>
            {!draft.solutionFiles && (
              <p className="rounded-lg bg-sky-50 px-4 py-3 text-xs text-sky-800">
                Write a working solution here, then run the checks: they should
                all pass. Interns never see the model answer.
              </p>
            )}
            <LabWorkspace
              key={`solution-${kind}`}
              kind={kind}
              files={draft.solutionFiles ?? draft.starterFiles}
              onFilesChange={(solutionFiles) => change({ solutionFiles })}
              checks={draft.checks}
              checksLabel="Run checks on model answer"
            />
          </>
        )}
      </section>
    </>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckEditor({
  index,
  check,
  onChange,
  onRemove,
}: {
  index: number;
  check: LabCheck;
  onChange: (patch: Partial<LabCheck>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <span className="w-5 text-[10px] font-bold text-slate-400">
          {index + 1}
        </span>
        <input
          value={check.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="What this checks (shown to interns)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52]"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove check"
          className="rounded p-1.5 text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={check.code}
        rows={3}
        spellCheck={false}
        onChange={(event) => onChange({ code: event.target.value })}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-[#101426] px-3 py-2 font-mono text-[11px] leading-5 text-white/90"
      />
    </li>
  );
}

/** A short summary per intern; the full work loads when opened. */
type AttemptRow = {
  id: string;
  intern: string;
  email: string;
  status: string;
  checksPassed: number | null;
  checksTotal: number | null;
  /** Code exercises: the AI review's rating. */
  rating: number | null;
  /** Simulators: the submitted run and its score. */
  submittedRun: number | null;
  submittedScore: number | null;
  runCount: number;
  bestScore: number | null;
  /** Signs a code submission's passing checks may be faked. */
  flagCount: number;
  submittedAt: string | null;
  updatedAt: string;
};

type AttemptDetail = {
  files: Record<string, string>;
  runs: Array<SimRun | SocialRun | AutomationRun | BackendRun | ContentRun>;
  review: { summary?: string; flags?: string[] } | null;
  checkResults?: Array<{ label: string; passed: boolean; detail?: string }> | null;
};

function attemptSummary(attempt: AttemptRow, kind: AnyLabKind) {
  if (kind === "BACKEND") {
    if (attempt.status !== "SUBMITTED") return "Draft";
    const rating = attempt.rating !== null ? ` · review ${attempt.rating}/10` : "";
    return `${attempt.runCount} submission${attempt.runCount === 1 ? "" : "s"} · last: ${attempt.checksPassed ?? 0}/${attempt.checksTotal ?? 0} tests (${attempt.submittedScore ?? 0}%)${rating}`;
  }
  if (kind === "AUTOMATION") {
    if (attempt.status === "SUBMITTED" && attempt.submittedScore !== null)
      return `submitted: ${attempt.checksPassed ?? 0}/${attempt.checksTotal ?? 0} records correct (${attempt.submittedScore}%)`;
    return attempt.runCount
      ? `${attempt.runCount} test run${attempt.runCount === 1 ? "" : "s"} · not submitted`
      : "Draft";
  }
  if (kind === "ADS" || kind === "SOCIAL" || kind === "CONTENT") {
    const runs = `${attempt.runCount} run${attempt.runCount === 1 ? "" : "s"}`;
    if (attempt.status === "SUBMITTED" && attempt.submittedScore !== null)
      return `${runs} · submitted run ${(attempt.submittedRun ?? 0) + 1}: ${attempt.submittedScore}/100 · ${attempt.checksPassed ?? 0}/${attempt.checksTotal ?? 0} goals`;
    return attempt.runCount
      ? `${runs} · best ${attempt.bestScore ?? 0}/100 · not submitted`
      : "Draft";
  }
  if (attempt.status !== "SUBMITTED") return "Draft";
  const rating = attempt.rating !== null ? ` · ${attempt.rating}/10` : "";
  return `${attempt.checksPassed ?? 0}/${attempt.checksTotal ?? 0} checks${rating}`;
}

function Attempts({
  id,
  kind,
  config,
}: {
  id: string;
  kind: AnyLabKind;
  config?: Draft["config"];
}) {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // Full work, fetched once per intern when first opened.
  const [details, setDetails] = useState<Record<string, AttemptDetail | "error">>({});

  useEffect(() => {
    fetch(`/api/admin/internship/lab/${id}/attempts`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setAttempts(body.attempts ?? []))
      .catch(() => setAttempts([]));
  }, [id]);

  function toggle(attemptId: string) {
    const opening = open !== attemptId;
    setOpen(opening ? attemptId : null);
    if (!opening || details[attemptId]) return;
    fetch(`/api/admin/internship/lab/${id}/attempts/${attemptId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as AttemptDetail;
      })
      .then((detail) => setDetails((current) => ({ ...current, [attemptId]: detail })))
      .catch(() => setDetails((current) => ({ ...current, [attemptId]: "error" })));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <h2 className="text-sm font-bold text-[#1C1D52]">Interns&apos; work</h2>
      {!attempts ? (
        <p className="mt-2 text-xs text-slate-500">Loading…</p>
      ) : attempts.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          No one has started this exercise yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {attempts.map((attempt) => {
            const detail = details[attempt.id];
            return (
              <li key={attempt.id} className="rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggle(attempt.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-xs"
                >
                  <span>
                    <span className="font-semibold text-[#1C1D52]">
                      {attempt.intern}
                    </span>
                    <span className="ml-2 text-slate-400">{attempt.email}</span>
                  </span>
                  <span className="flex items-center gap-3 text-slate-500">
                    {attempt.flagCount > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        ⚠ Check this
                      </span>
                    )}
                    {attemptSummary(attempt, kind)}
                    {open === attempt.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                </button>
                {open === attempt.id && (
                  <div className="space-y-2 border-t border-slate-100 px-4 py-3">
                    {!detail ? (
                      <p className="text-xs text-slate-500">Loading their work…</p>
                    ) : detail === "error" ? (
                      <p className="text-xs text-red-600">Unable to load this intern&apos;s work.</p>
                    ) : (
                      <>
                        {(detail.review?.flags ?? []).map((flag) => (
                          <p
                            key={flag}
                            className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"
                          >
                            ⚠ {flag} If this was for a task, the result went to a mentor to confirm.
                          </p>
                        ))}
                        {detail.review?.summary && (
                          <p className="text-xs text-slate-600">{detail.review.summary}</p>
                        )}
                        {(kind === "ADS" || kind === "SOCIAL") &&
                          (detail.runs.length ? (
                            detail.runs.map((run, index) =>
                              kind === "SOCIAL" ? (
                                <SocialRunSummary key={run.at} run={run as SocialRun} index={index} />
                              ) : (
                                <AdsRunSummary
                                  key={run.at}
                                  run={{ ...(run as SimRun), campaign: parseCampaign((run as SimRun).campaign) }}
                                  index={index}
                                  price={(config as AdsConfig | undefined)?.product?.price ?? 0}
                                />
                              ),
                            )
                          ) : (
                            <p className="text-xs text-slate-500">No runs yet.</p>
                          ))}
                        {kind === "AUTOMATION" &&
                          (detail.runs.length ? (
                            detail.runs.map((run, index) => (
                              <AutomationRunSummary
                                key={run.at}
                                run={run as AutomationRun}
                                index={index}
                                config={parseAutomationConfig(config)}
                              />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">No runs yet.</p>
                          ))}
                        {kind === "BACKEND" &&
                          detail.runs.length > 0 &&
                          (detail.runs as BackendRun[])
                            .map((run, index) => ({ run, index }))
                            .reverse()
                            .map(({ run, index }) => (
                              <details
                                key={run.at}
                                open={index === detail.runs.length - 1}
                                className="rounded-lg bg-[#f8fbff] p-3 text-[11px] text-slate-600"
                              >
                                <summary className="cursor-pointer font-bold text-[#1C1D52]">
                                  Submission {index + 1} · {run.result.passed}/{run.result.total} tests ·{" "}
                                  {run.result.score}% · {new Date(run.at).toLocaleString()}
                                </summary>
                                <div className="mt-2">
                                  <TestResultsList results={run.result.tests} />
                                </div>
                              </details>
                            ))}
                        {kind === "CONTENT" &&
                          (detail.runs.length ? (
                            (detail.runs as ContentRun[]).map((run, index) => (
                              <ContentRunSummary key={run.at} run={run} index={index} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500">No runs yet.</p>
                          ))}
                        {kind === "WORDPRESS" && (
                          <WordPressWork work={parseWpWork(detail.files)} results={detail.checkResults ?? []} />
                        )}
                        {kind !== "ADS" &&
                          kind !== "SOCIAL" &&
                          kind !== "AUTOMATION" &&
                          kind !== "WORDPRESS" &&
                          kind !== "CONTENT" &&
                          Object.entries(detail.files ?? {}).map(([name, contents]) => (
                            <div key={name}>
                              <p className="text-[10px] font-bold text-slate-500">{name}</p>
                              <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-[#101426] p-3 text-[11px] leading-5 text-white/90">
                                {contents}
                              </pre>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** One marked run of AI content: the score, marks and the work itself. */
function ContentRunSummary({ run, index }: { run: ContentRun; index: number }) {
  const { result, work } = run;
  return (
    <details className="rounded-lg bg-[#f8fbff] p-3 text-[11px] leading-5 text-slate-600">
      <summary className="cursor-pointer font-bold text-[#1C1D52]">
        Run {index + 1} · {result.score}/100 · {result.goals.filter((g) => g.met).length}/{result.goals.length} marks met ·{" "}
        {new Date(run.at).toLocaleString()}
      </summary>
      <div className="mt-2 space-y-2">
        <p>{result.summary}</p>
        {result.errors.length > 0 && (
          <>
            <ul>
              {result.errors.map((error) => (
                <li key={error.id}>
                  {error.caught ? "✓" : "✗"} {error.label}
                  {error.fix && <span className="text-slate-400"> · {error.fix}</span>}
                </li>
              ))}
            </ul>
            <p>Kept {Math.round((result.kept ?? 0) * 100)}% of the correct text.</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3">{work.edited}</pre>
          </>
        )}
        {result.pieces.map((piece) => (
          <PieceCard key={piece.pieceId} piece={piece} />
        ))}
        {work.notes.trim() && <p className="whitespace-pre-line">Notes: {work.notes}</p>}
      </div>
    </details>
  );
}

/** A submitted WordPress site: check results, a summary and their files. */
function WordPressWork({ work, results }: { work: WpWork; results: Array<{ label: string; passed: boolean; detail?: string }> }) {
  const s = work.summary;
  return (
    <div className="space-y-2 text-[11px] leading-5 text-slate-600">
      {results.length > 0 && (
        <ul className="space-y-0.5">
          {results.map((result) => (
            <li key={result.label}>
              {result.passed ? "✓" : "✗"} {result.label}
              {result.detail && <span className="text-slate-400"> · {result.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {s ? (
        <div className="rounded-lg bg-[#f8fbff] p-3">
          <p>
            <strong className="text-[#1C1D52]">{s.title || "(no title)"}</strong>
            {s.tagline && ` · ${s.tagline}`}
          </p>
          <p>
            Theme: {s.theme || "unknown"}
            {s.plugins.length > 0 && ` · Plugins: ${s.plugins.join(", ")}`}
          </p>
          <p>
            Pages: {s.pages.join(", ") || "none"} · Posts: {s.posts}
          </p>
          {s.menus.map((menu) => (
            <p key={menu.name}>
              Menu “{menu.name}”: {menu.items.join(", ") || "(empty)"}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">No site summary (not submitted yet).</p>
      )}
      {Object.entries(work.files).map(([path, contents]) => (
        <div key={path}>
          <p className="text-[10px] font-bold text-slate-500">wp-content/{path}</p>
          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-[#101426] p-3 text-[11px] leading-5 text-white/90">
            {contents}
          </pre>
        </div>
      ))}
    </div>
  );
}

function AutomationRunSummary({
  run,
  index,
  config,
}: {
  run: AutomationRun;
  index: number;
  config: AutomationConfig;
}) {
  return (
    <details className="rounded-lg bg-[#f8fbff] p-3 text-[11px] leading-5 text-slate-600">
      <summary className="cursor-pointer font-bold text-[#1C1D52]">
        {run.full ? "Submitted" : "Test"} run {index + 1} ·{" "}
        {run.result.passed}/{run.result.total} records correct · {run.result.score}%
      </summary>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-bold text-[#1C1D52]">Their workflow</p>
          <WorkflowBuilder
            workflow={run.workflow}
            onChange={() => {}}
            lists={config}
            readOnly
          />
        </div>
        <RunResult run={run} />
      </div>
    </details>
  );
}

function SocialRunSummary({ run, index }: { run: SocialRun; index: number }) {
  const { result, plan, feedback, comments } = run;
  const t = result.totals;
  const n = (v: number) => Math.round(v).toLocaleString("en-NG");
  return (
    <details className="rounded-lg bg-[#f8fbff] p-3 text-[11px] leading-5 text-slate-600">
      <summary className="cursor-pointer font-bold text-[#1C1D52]">
        Week {index + 1} · {result.score}/100 · {t.posts} posts · reach {n(t.reach)} ·{" "}
        {t.engagementRate}% engagement · {n(t.followers)} followers
        {t.community !== null ? ` · replies ${t.community}/100` : " · not replied"}
      </summary>
      <p className="mt-2">
        Goals:{" "}
        {result.goals
          .map(
            (goal) =>
              `${goal.pending ? "…" : goal.met ? "✓" : "✗"} ${goal.label} ${goal.pending ? "(no replies)" : formatSocialGoal(goal.metric, goal.actual)}`,
          )
          .join(" · ")}
      </p>
      <p className="mt-1">{feedback.summary}</p>
      <ul className="mt-2 space-y-1.5">
        {plan.posts.map((post) => (
          <li key={post.id} className="rounded bg-white p-2">
            <strong className="text-[#1C1D52]">
              {DAYS[post.day]} {post.time} · {PLATFORMS[post.platform].label}
            </strong>
            <span className="block whitespace-pre-line">{post.caption}</span>
          </li>
        ))}
      </ul>
      {comments.some((c) => c.reply) && (
        <ul className="mt-2 space-y-1.5">
          {comments.map((c) => (
            <li key={c.id} className="rounded bg-white p-2">
              <strong>{c.author}:</strong> {c.text}
              <span className="block text-[#1C1D52]">
                → {c.reply || "(no reply)"}
                {c.grade ? ` [${c.grade.score}/10]` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

/** One intern ad run: the same report the intern saw, folded. */
function AdsRunSummary({ run, index, price }: { run: SimRun; index: number; price: number }) {
  const { campaign, result } = run;
  return (
    <details className="rounded-lg bg-[#f8fbff] p-3 text-[11px] leading-5 text-slate-600">
      <summary className="cursor-pointer font-bold text-[#1C1D52]">
        Run {index + 1} · {result.score}/100 · {OBJECTIVES[campaign.objective].label} · {campaign.adSets.length} ad set
        {campaign.adSets.length === 1 ? "" : "s"} · spent ₦{Math.round(result.totals.spend).toLocaleString("en-NG")} ·{" "}
        {result.totals.conversions} conversions
      </summary>
      <div className="mt-3">
        <RunReport run={run} price={price} />
      </div>
    </details>
  );
}
