"use client";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Play,
  Send,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import {
  describeEffect,
  workflowProblems,
  type ExpectedEffect,
  type PublicAutomationConfig,
  type RecordOutcome,
  type Workflow,
} from "@/lib/automation-sim/model";
import type { AutomationRun } from "@/lib/practice-lab";

// The AI automation exercise: the brief and sample data, the workflow
// builder, test runs on the samples (with each record's path through the
// workflow), and submit (which also runs the hidden test records).

export default function AutomationSimulator({
  config,
  workflow,
  onWorkflowChange,
  runs,
  maxRuns,
  onRun,
  onSubmit,
  submitLabel = "Submit",
}: {
  config: PublicAutomationConfig;
  workflow: Workflow;
  onWorkflowChange: (workflow: Workflow) => void;
  runs: AutomationRun[];
  /** Test runs allowed; unlimited when not set (admin test). */
  maxRuns?: number;
  onRun: (workflow: Workflow) => Promise<string | null>;
  onSubmit?: () => Promise<void>;
  submitLabel?: string;
}) {
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<number | null>(null);
  const [pathFor, setPathFor] = useState<string | null>(null);

  const problems = workflowProblems(workflow, config);
  const testsUsed = runs.filter((run) => !run.full).length;
  const outOfRuns = maxRuns !== undefined && testsUsed >= maxRuns;
  const runIndex = selectedRun ?? runs.length - 1;
  const run = runs[runIndex];

  const path = useMemo(() => {
    const outcome = run?.result.outcomes.find((o) => o.recordId === pathFor);
    if (!outcome) return null;
    const map = new Map<string, string>();
    for (const item of outcome.trace)
      map.set(item.stepId, map.has(item.stepId) ? `${map.get(item.stepId)} · ${item.note}` : item.note);
    return map;
  }, [run, pathFor]);
  const pathLabel = run?.result.outcomes.find((o) => o.recordId === pathFor)?.label;

  async function test() {
    setRunning(true);
    setError(null);
    const failure = await onRun(workflow);
    setRunning(false);
    if (failure) setError(failure);
    else {
      setSelectedRun(null);
      setPathFor(null);
    }
  }

  async function submit() {
    if (!onSubmit) return;
    setConfirming(false);
    setSubmitting(true);
    setError(null);
    await onSubmit();
    setSubmitting(false);
    setSelectedRun(null);
    setPathFor(null);
  }

  return (
    <div className="space-y-5">
      <Card title={config.business.name} subtitle="The brief">
        <p className="whitespace-pre-line text-xs leading-5 text-slate-600">
          {config.business.description}
        </p>
      </Card>

      <Card
        title="Sample data"
        subtitle={`Each record is one time the trigger fires. Test your workflow on these and compare with what should happen.${config.hiddenCount ? ` When you submit, ${config.hiddenCount} hidden test record${config.hiddenCount === 1 ? "" : "s"} are run too.` : ""}`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.06em] text-slate-500">
                <th className="py-2 pr-3 font-bold">Record</th>
                {config.fields.map((field) => (
                  <th key={field.key} className="py-2 pr-3 font-bold">
                    {field.label}
                    <span className="block font-mono font-normal normal-case tracking-normal text-slate-400">
                      {`{{${field.key}}}`}
                    </span>
                  </th>
                ))}
                <th className="py-2 pr-3 font-bold">What should happen</th>
              </tr>
            </thead>
            <tbody>
              {config.samples.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold text-[#1C1D52]">{record.label}</td>
                  {config.fields.map((field) => (
                    <td key={field.key} className="max-w-[240px] py-2 pr-3 text-slate-600">
                      {record.data[field.key] || <span className="text-slate-300">empty</span>}
                    </td>
                  ))}
                  <td className="min-w-[200px] py-2 pr-3">
                    <ExpectedList expected={record.expected} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Your workflow"
        subtitle="Pick the trigger, then add steps. Conditions split the flow into Yes and No. Insert {{fields}} into messages to fill them from each record."
      >
        {path && (
          <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#e8f7eb] px-3 py-2 text-[11px] text-[#397d3a]">
            <Eye className="h-3.5 w-3.5" /> Showing the path for “{pathLabel}”.
            <button type="button" onClick={() => setPathFor(null)} className="inline-flex items-center gap-1 font-semibold underline">
              <EyeOff className="h-3 w-3" /> Hide
            </button>
          </p>
        )}
        <WorkflowBuilder
          workflow={workflow}
          onChange={(next) => {
            setError(null);
            onWorkflowChange(next);
          }}
          lists={config}
          path={path}
        />

        {problems.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 rounded-lg bg-amber-50 py-3 pl-8 pr-3 text-[11px] text-amber-900">
            {problems.slice(0, 6).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={running || submitting || problems.length > 0 || outOfRuns}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? "Running…" : "Test on sample data"}
          </button>
          {onSubmit &&
            (confirming ? (
              <span className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600">
                Submit runs every record, hidden ones too.
                <button
                  type="button"
                  onClick={() => void submit()}
                  className="rounded-lg bg-[#5FBB46] px-3 py-1.5 text-xs font-bold text-[#14204f]"
                >
                  Yes, submit
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="px-2 py-1.5 text-xs font-semibold">
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={running || submitting || problems.length > 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? "Submitting…" : submitLabel}
              </button>
            ))}
          {maxRuns !== undefined && (
            <span className="text-[10px] text-slate-500">
              Test runs: {testsUsed} of {maxRuns}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">
            {error}
          </p>
        )}
      </Card>

      {run && (
        <Card title="Results" subtitle="What your workflow did with each record, next to what should happen.">
          {runs.length > 1 && (
            <select
              value={runIndex}
              onChange={(event) => {
                setSelectedRun(Number(event.target.value));
                setPathFor(null);
              }}
              className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
              aria-label="Choose a run"
            >
              {runs.map((r, index) => (
                <option key={r.at} value={index}>
                  {r.full ? "Submitted" : `Test ${runs.slice(0, index + 1).filter((x) => !x.full).length}`} ·{" "}
                  {r.result.passed}/{r.result.total} correct
                </option>
              ))}
            </select>
          )}
          <RunResult
            key={run.at}
            run={run}
            pathFor={pathFor}
            onShowPath={(recordId) => setPathFor(recordId)}
          />
        </Card>
      )}
    </div>
  );
}

export function RunResult({
  run,
  pathFor,
  onShowPath,
}: {
  run: AutomationRun;
  pathFor?: string | null;
  onShowPath?: (recordId: string) => void;
}) {
  const { result } = run;
  const [open, setOpen] = useState<string | null>(
    result.outcomes.find((o) => !o.passed && !o.hidden)?.recordId ?? null,
  );
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-[#1C1D52]">
          {run.full ? "All records (submitted)" : "Sample records"}: {result.passed} of {result.total} handled correctly ·{" "}
          {result.score}%
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#5FBB46]" style={{ width: `${result.score}%` }} />
        </div>
        {!result.triggerOk && (
          <p className="mt-2 text-[11px] font-semibold text-red-600">
            The workflow never started: that trigger doesn&apos;t fire for these records. Re-read the brief.
          </p>
        )}
      </div>
      <ul className="space-y-2">
        {result.outcomes.map((outcome) => (
          <OutcomeRow
            key={outcome.recordId}
            outcome={outcome}
            open={open === outcome.recordId}
            onToggle={() => setOpen(open === outcome.recordId ? null : outcome.recordId)}
            showingPath={pathFor === outcome.recordId}
            onShowPath={onShowPath}
          />
        ))}
      </ul>
    </div>
  );
}

function OutcomeRow({
  outcome,
  open,
  onToggle,
  showingPath,
  onShowPath,
}: {
  outcome: RecordOutcome;
  open: boolean;
  onToggle: () => void;
  showingPath: boolean;
  onShowPath?: (recordId: string) => void;
}) {
  const badge = outcome.passed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7eb] px-2 py-0.5 text-[10px] font-bold text-[#397d3a]">
      <CheckCircle2 className="h-3 w-3" /> Correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
      <XCircle className="h-3 w-3" /> Not right
    </span>
  );
  if (outcome.hidden && outcome.trace.length === 0 && outcome.expected.length === 0 && outcome.effects.length === 0)
    return (
      <li className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-xs">
        <span className="font-semibold text-slate-500">{outcome.label}</span>
        {badge}
      </li>
    );
  return (
    <li className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs"
      >
        <span className="flex items-center gap-1.5 font-semibold text-[#1C1D52]">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {outcome.label}
          {outcome.hidden && <span className="font-normal text-slate-400">(hidden)</span>}
        </span>
        {badge}
      </button>
      {open && (
        <div className="grid gap-3 border-t border-slate-100 px-3 py-3 text-[11px] leading-5 md:grid-cols-2">
          <div>
            <p className="font-bold text-[#1C1D52]">Your workflow did</p>
            {outcome.effects.length ? (
              <ul className="mt-1 space-y-1">
                {outcome.effects.map((effect, index) => (
                  <li key={index} className="rounded bg-slate-50 px-2 py-1">
                    <span className="font-semibold text-[#1C1D52]">{describeEffect(effect)}</span>
                    {effect.text && <span className="block whitespace-pre-line text-slate-500">{effect.text}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-slate-500">Nothing.</p>
            )}
          </div>
          <div>
            <p className="font-bold text-[#1C1D52]">Should happen</p>
            <div className="mt-1">
              <ExpectedList expected={outcome.expected} />
            </div>
          </div>
          {outcome.problems.length > 0 && (
            <ul className="list-disc space-y-0.5 rounded-lg bg-red-50 py-2 pl-6 pr-2 text-red-700 md:col-span-2">
              {outcome.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {onShowPath && outcome.trace.length > 0 && (
            <button
              type="button"
              onClick={() => onShowPath(outcome.recordId)}
              disabled={showingPath}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 md:col-span-2"
            >
              <Eye className="h-3.5 w-3.5" /> {showingPath ? "Path shown in your workflow" : "Show this record's path in your workflow"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function ExpectedList({ expected }: { expected: ExpectedEffect[] }) {
  if (!expected.length) return <p className="text-slate-500">Nothing: no action.</p>;
  return (
    <ul className="space-y-1">
      {expected.map((effect, index) => (
        <li key={index} className="rounded bg-[#f8fbff] px-2 py-1 text-[#1C1D52]">
          {describeEffect(effect)}
          {effect.mentions.length > 0 && (
            <span className="block text-[10px] text-slate-500">
              Include: {effect.mentions.map((m) => m.field).join(", ")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <h2 className="text-sm font-bold text-[#1C1D52]">{title}</h2>
      <p className="mb-4 text-[10px] leading-4 text-slate-500">{subtitle}</p>
      {children}
    </section>
  );
}
