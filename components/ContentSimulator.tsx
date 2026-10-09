"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Loader2,
  MessageCircle,
  PenLine,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  checkRule,
  CONTENT_MODES,
  countWords,
  MAX_PROMPT_CHARS,
  MAX_TEXT_CHARS,
  ruleLabel,
  type ContentRun,
  type ContentWork,
  type PublicContentConfig,
} from "@/lib/content-sim/model";

const card = "rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]";

/** The AI content workspace: Prompt Lab, Brief Studio or Fact-check. */
export default function ContentSimulator({
  config,
  work,
  onWorkChange,
  runs,
  onRun,
  onSubmit,
  submitLabel = "Submit",
  aiEnabled,
  runLabel,
}: {
  config: PublicContentConfig;
  work: ContentWork;
  onWorkChange: (work: ContentWork) => void;
  runs: ContentRun[];
  /** Returns an error message, or null when the run was added. */
  onRun: (work: ContentWork) => Promise<string | null>;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel?: string;
  aiEnabled: boolean;
  /** Admin test runs aren't counted. */
  runLabel?: string;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(runs.length - 1);
  const shownIndex = Math.min(Math.max(shown, 0), runs.length - 1);
  const left = config.maxRuns - runs.length;
  const prompting = config.mode === "PROMPT";
  const blocked = prompting && !aiEnabled;

  const run = async () => {
    setRunning(true);
    setError(null);
    const failure = await onRun(work);
    setRunning(false);
    if (failure) setError(failure);
    else setShown(Number.MAX_SAFE_INTEGER);
  };

  return (
    <div className="space-y-4">
      <ClientBrief config={config} />

      {config.mode === "FACTCHECK" ? (
        <FactCheckEditor config={config} work={work} onWorkChange={onWorkChange} />
      ) : (
        config.pieces.map((piece) => {
          const value = work.texts[piece.id] ?? "";
          return (
            <section key={piece.id} className={`${card} space-y-3`}>
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
                  {prompting ? <Wand2 className="h-4 w-4 text-[#5FBB46]" /> : <PenLine className="h-4 w-4 text-[#5FBB46]" />}
                  {piece.label}
                </h2>
                <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">{piece.instructions}</p>
              </div>
              {(piece.rules.length > 0 || config.rubric.length > 0) && (
                <div className="rounded-xl bg-[#f8fbff] p-3 text-[11px] leading-5 text-slate-600">
                  <p className="font-bold text-[#1C1D52]">{prompting ? "The AI's output is marked on" : "Marked on"}</p>
                  <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                    {piece.rules.map((rule) => {
                      // Brief Studio: the rules are checked as they type.
                      const live = !prompting && value.trim() ? checkRule(rule, value) : null;
                      return (
                        <li key={rule.id} className={live ? (live.passed ? "text-[#397d3a]" : "text-red-600") : ""}>
                          {live ? (live.passed ? "✓" : "✗") : "•"} {ruleLabel(rule)}
                          {live && <span className="text-slate-400"> ({live.detail})</span>}
                        </li>
                      );
                    })}
                    {config.rubric.map((criterion) => (
                      <li key={criterion}>
                        <Sparkles className="mr-1 inline h-3 w-3 text-[#5FBB46]" />
                        {criterion} <span className="text-slate-400">(AI judge)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {prompting ? "Your prompt" : `Your ${piece.label.toLowerCase()}`}
                </span>
                <textarea
                  value={value}
                  rows={prompting ? 6 : 10}
                  maxLength={prompting ? MAX_PROMPT_CHARS : MAX_TEXT_CHARS}
                  onChange={(e) => onWorkChange({ ...work, texts: { ...work.texts, [piece.id]: e.target.value } })}
                  placeholder={
                    prompting
                      ? "Tell the AI what to write: who it's for, the details to include, the tone, the length and the format. Don't write the answer yourself."
                      : "Write (or paste) your finished piece here. You can use any AI tools to help."
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs leading-5 text-[#1C1D52]"
                />
                <span className="block text-right text-[10px] text-slate-400">
                  {countWords(value)} words · {value.length}/{prompting ? MAX_PROMPT_CHARS : MAX_TEXT_CHARS} characters
                </span>
              </label>
            </section>
          );
        })
      )}

      {config.mode !== "PROMPT" && (
        <section className={card}>
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
              {config.mode === "FACTCHECK" ? "What you changed and why (optional, for your mentor)" : "How you used AI (optional, for your mentor)"}
            </span>
            <textarea
              value={work.notes}
              rows={3}
              maxLength={3000}
              onChange={(e) => onWorkChange({ ...work, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs leading-5 text-[#1C1D52]"
            />
          </label>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || left <= 0 || blocked}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : prompting ? <Wand2 className="h-4 w-4" /> : config.mode === "FACTCHECK" ? <FileSearch className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {running
            ? prompting
              ? "Running your prompts…"
              : "Marking…"
            : prompting
              ? "Run my prompts"
              : config.mode === "FACTCHECK"
                ? "Check my edit"
                : "Get it marked"}
        </button>
        <span className="text-xs text-slate-500">
          {runLabel ?? `${Math.max(left, 0)} of ${config.maxRuns} runs left`}
          {running && " · this can take up to a minute"}
        </span>
      </div>
      {blocked && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          The AI isn&apos;t available right now, so prompts can&apos;t run. Please try again later.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">
          {error}
        </p>
      )}

      {runs.length > 0 && (
        <Results
          config={config}
          runs={runs}
          shownIndex={shownIndex}
          onSelect={setShown}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}

function ClientBrief({ config }: { config: PublicContentConfig }) {
  const c = config.client;
  return (
    <section className={`${card} space-y-2`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
        {CONTENT_MODES[config.mode].label} · Client brief
      </p>
      <h2 className="text-base font-bold text-[#1C1D52]">{c.name}</h2>
      {c.about && <p className="whitespace-pre-line text-xs leading-5 text-slate-600">{c.about}</p>}
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {c.voice && (
          <div className="rounded-lg bg-[#f8fbff] p-3">
            <dt className="font-bold text-[#1C1D52]">Brand voice</dt>
            <dd className="mt-1 text-slate-600">{c.voice}</dd>
          </div>
        )}
        {c.audience && (
          <div className="rounded-lg bg-[#f8fbff] p-3">
            <dt className="font-bold text-[#1C1D52]">Audience</dt>
            <dd className="mt-1 text-slate-600">{c.audience}</dd>
          </div>
        )}
      </dl>
      <p className="text-[11px] text-slate-500">
        {config.mode === "PROMPT"
          ? "Write a prompt for each piece. Your prompts run on a real AI model, and its output is marked against the brief. Improve your prompts and run them again."
          : config.mode === "BRIEF"
            ? "Write each piece the client wants. Use AI tools if you like, but check and edit everything: you're marked on the finished work."
            : `This draft was written by AI and has ${config.errorCount} error${config.errorCount === 1 ? "" : "s"} in it. Check it against the client's notes, then fix the errors in your edited draft. Keep the parts that are right.`}
      </p>
    </section>
  );
}

function FactCheckEditor({
  config,
  work,
  onWorkChange,
}: {
  config: PublicContentConfig;
  work: ContentWork;
  onWorkChange: (work: ContentWork) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} space-y-3`}>
        <h2 className="text-sm font-bold text-[#1C1D52]">The client&apos;s notes</h2>
        <p className="whitespace-pre-line rounded-xl bg-[#f8fbff] p-3 text-xs leading-5 text-slate-700">
          {config.reference || "No notes: use what you know and what the brief says."}
        </p>
        <details className="text-xs">
          <summary className="cursor-pointer font-bold text-[#1C1D52]">The AI&apos;s original draft</summary>
          <p className="mt-2 whitespace-pre-line rounded-xl bg-slate-50 p-3 leading-5 text-slate-600">{config.draft}</p>
        </details>
      </section>
      <section className={`${card} space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#1C1D52]">Your edited draft</h2>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Put the original draft back? Your edits will be lost.")) onWorkChange({ ...work, edited: config.draft });
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        </div>
        <textarea
          value={work.edited}
          rows={18}
          onChange={(e) => onWorkChange({ ...work, edited: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs leading-5 text-[#1C1D52]"
        />
      </section>
    </div>
  );
}

function Results({
  config,
  runs,
  shownIndex,
  onSelect,
  onSubmit,
  submitLabel,
}: {
  config: PublicContentConfig;
  runs: ContentRun[];
  shownIndex: number;
  onSelect: (index: number) => void;
  onSubmit?: (runIndex: number) => Promise<void> | void;
  submitLabel: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { result } = runs[shownIndex];
  const best = runs.reduce((b, r, i) => (r.result.score > runs[b].result.score ? i : b), 0);
  return (
    <>
      <section className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#1C1D52]">Results</h2>
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
            <span className="text-xl font-bold">{result.score}</span>
            <span className="text-[9px] text-white/60">/100</span>
          </div>
          <div className="min-w-0 flex-1 space-y-1 text-sm">
            <p>{result.summary}</p>
            {result.kept !== undefined && (
              <p className="text-xs text-white/70">You kept {Math.round(result.kept * 100)}% of the draft&apos;s correct text.</p>
            )}
          </div>
        </div>

        {result.improvements.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <p className="font-bold">To improve</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.improvements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {config.mode === "FACTCHECK" ? (
          <ul className="space-y-2">
            {result.errors.map((error) => (
              <li
                key={error.id}
                className={`rounded-lg px-3 py-2 text-xs ${error.caught ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}
              >
                <p className="flex items-center gap-2 font-semibold">
                  {error.caught ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                  {error.label}: {error.caught ? "fixed" : "still in the draft"}
                </p>
                {error.why && <p className="mt-1 pl-6 text-slate-600">{error.why}</p>}
                {error.fix && <p className="mt-1 pl-6 text-slate-500">Your fix: {error.fix}</p>}
              </li>
            ))}
          </ul>
        ) : (
          result.pieces.map((piece) => <PieceCard key={piece.pieceId} piece={piece} />)
        )}

        <p className="text-[11px] text-slate-400">
          {result.judged ? "Marked by the rules and an AI judge." : "Marked by the rules only (the AI judge wasn't available)."} This is a
          training simulation.
        </p>
      </section>

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
          {submitting ? "Submitting…" : `${submitLabel} (run ${shownIndex + 1})`}
        </button>
      )}
    </>
  );
}

export function PieceCard({ piece }: { piece: ContentRun["result"]["pieces"][number] }) {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1C1D52]">{piece.label}</h3>
        <span className="rounded-full bg-[#e8f7eb] px-2.5 py-1 text-xs font-bold text-[#397d3a]">{piece.score}/100</span>
      </div>
      {piece.prompt !== undefined && (
        <div className="text-xs">
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            className="inline-flex items-center gap-1 font-semibold text-slate-500"
          >
            {showPrompt ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} The prompt
          </button>
          {showPrompt && <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-slate-600">{piece.prompt}</p>}
        </div>
      )}
      <div>
        {piece.prompt !== undefined && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">The AI wrote</p>}
        <p className="whitespace-pre-line rounded-lg bg-[#f8fbff] p-3 text-xs leading-5 text-slate-700">
          {piece.output || "(nothing)"}
        </p>
      </div>
      {piece.feedback && <p className={`text-xs ${piece.copied ? "font-semibold text-red-700" : "text-slate-600"}`}>{piece.feedback}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {piece.rules.map((rule) => (
          <li
            key={rule.label}
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${rule.passed ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}
          >
            {rule.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {rule.label} <span className="opacity-70">({rule.detail})</span>
            </span>
          </li>
        ))}
        {piece.criteria.map((c) => (
          <li
            key={c.criterion}
            className={`rounded-lg px-3 py-2 text-xs ${c.score >= 7 ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-amber-50 text-amber-800"}`}
          >
            <p className="font-semibold">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {c.criterion}: {c.score}/10
            </p>
            {c.comment && <p className="mt-0.5 text-slate-600">{c.comment}</p>}
          </li>
        ))}
      </ul>
      {piece.reactions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">How the audience might react</p>
          {piece.reactions.map((reaction) => (
            <p key={reaction} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {reaction}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
