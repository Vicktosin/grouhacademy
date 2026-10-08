"use client";

import { CheckCircle2, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import AutomationSimulator, { ExpectedList } from "@/components/AutomationSimulator";
import WorkflowBuilder from "@/components/WorkflowBuilder";
import {
  BLANK_WORKFLOW,
  newId,
  publicAutomationConfig,
  TRIGGERS,
  workflowProblems,
  type AiLabels,
  type AutomationConfig,
  type ExpectedEffect,
  type FieldType,
  type TriggerId,
  type Workflow,
} from "@/lib/automation-sim/model";
import type { AutomationRun } from "@/lib/practice-lab";

// Admin settings for an AI automation exercise: the brief, the trigger and
// data fields, the sample and hidden test records, the apps (chat channels,
// sheets, CRM stages, team), and the model workflow that decides the right
// result for every record. Plus a check of the model answers and a test run.

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]";

const FIELD_TYPES: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  email: "Email",
  phone: "Phone",
};

/** Lists are edited one per line; blank lines are dropped on save. */
const clean = (list: string[]) => list.map((item) => item.trim()).filter(Boolean);

export default function AutomationConfigEditor({
  config,
  onChange,
}: {
  config: AutomationConfig;
  onChange: (config: AutomationConfig) => void;
}) {
  // Any change makes the saved answers out of date; they're redone on save.
  const set = (patch: Partial<AutomationConfig>) => onChange({ ...config, ...patch, expected: null });
  const lists = {
    fields: config.fields,
    channels: clean(config.channels),
    sheets: clean(config.sheets),
    stages: clean(config.stages),
    team: clean(config.team),
  };

  const setField = (index: number, patch: Partial<AutomationConfig["fields"][number]>) => {
    const old = config.fields[index];
    const fields = config.fields.map((field, i) => (i === index ? { ...field, ...patch } : field));
    // Renaming a field's key keeps each record's value.
    const records =
      patch.key !== undefined && patch.key !== old.key
        ? config.records.map((record) => {
            const data = { ...record.data, [patch.key!]: record.data[old.key] ?? "" };
            delete data[old.key];
            return { ...record, data };
          })
        : config.records;
    set({ fields, records });
  };

  const setRecord = (index: number, patch: Partial<AutomationConfig["records"][number]>) =>
    set({ records: config.records.map((record, i) => (i === index ? { ...record, ...patch } : record)) });

  const modelProblems = workflowProblems(config.solution, { ...lists, maxSteps: config.maxSteps });

  return (
    <div className="space-y-5">
      <Card title="The business and brief" help="Interns see this. Spell out what should happen in each situation; the model workflow below must do exactly that.">
        <div className="grid gap-4">
          <Field label="Business name">
            <input value={config.business.name} onChange={(e) => set({ business: { ...config.business, name: e.target.value } })} className={inputClass} />
          </Field>
          <Field label="Situation and rules">
            <textarea rows={8} value={config.business.description} onChange={(e) => set({ business: { ...config.business, description: e.target.value } })} className={inputClass} />
          </Field>
        </div>
      </Card>

      <Card title="Trigger and data" help="The right trigger is hidden from interns: they must pick it from the brief. Fields are the data each record carries; interns use them as {{key}}.">
        <Field label="Correct trigger">
          <select value={config.trigger} onChange={(e) => set({ trigger: e.target.value as TriggerId, solution: { ...config.solution, trigger: e.target.value as TriggerId } })} className={`${inputClass} max-w-[320px]`}>
            {(Object.keys(TRIGGERS) as TriggerId[]).map((trigger) => (
              <option key={trigger} value={trigger}>{TRIGGERS[trigger].label}</option>
            ))}
          </select>
        </Field>
        <Small>Fields</Small>
        <ul className="space-y-2">
          {config.fields.map((field, index) => (
            <li key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
              <input value={field.label} onChange={(e) => setField(index, { label: e.target.value })} placeholder="Label, e.g. Order value (₦)" className={inputClass} aria-label="Field label" />
              <input value={field.key} onChange={(e) => setField(index, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} placeholder="Key, e.g. orderValue" className={`${inputClass} font-mono`} aria-label="Field key" />
              <select value={field.type} onChange={(e) => setField(index, { type: e.target.value as FieldType })} className={inputClass} aria-label="Field type">
                {(Object.keys(FIELD_TYPES) as FieldType[]).map((type) => (
                  <option key={type} value={type}>{FIELD_TYPES[type]}</option>
                ))}
              </select>
              <button type="button" aria-label="Remove field" onClick={() => set({ fields: config.fields.filter((_, i) => i !== index) })} className="rounded p-2 text-red-500 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {config.fields.length < 12 && (
          <button type="button" onClick={() => set({ fields: [...config.fields, { key: `field${config.fields.length + 1}`, label: "", type: "text" }] })} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]">
            <Plus className="h-3 w-3" /> Add field
          </button>
        )}
      </Card>

      <Card title="Apps in this exercise" help="The choices interns get for each action. One per line.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ListField label="Team chat channels" value={config.channels} onChange={(channels) => set({ channels })} />
          <ListField label="Sheets" value={config.sheets} onChange={(sheets) => set({ sheets })} />
          <ListField label="CRM pipeline stages" value={config.stages} onChange={(stages) => set({ stages })} />
          <ListField label="Team members (for tasks)" value={config.team} onChange={(team) => set({ team })} />
        </div>
      </Card>

      <Card title="Records" help="Each record is one time the trigger fires. Interns see the sample records and what should happen; hidden records only run when they submit, so the workflow must follow the rules, not the samples. Include tricky cases, e.g. a value exactly on a limit.">
        <ul className="space-y-3">
          {config.records.map((record, index) => (
            <li key={record.id} className={`rounded-xl border p-3 ${record.hidden ? "border-violet-200 bg-violet-50/40" : "border-slate-200"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input value={record.label} onChange={(e) => setRecord(index, { label: e.target.value })} placeholder="Short name, e.g. Damaged parcel" className={`${inputClass} max-w-[280px]`} aria-label="Record name" />
                <label className="inline-flex items-center gap-1.5 text-xs text-[#1C1D52]">
                  <input type="checkbox" className="accent-violet-600" checked={record.hidden} onChange={(e) => setRecord(index, { hidden: e.target.checked })} />
                  Hidden test
                </label>
                <span className="ml-auto flex">
                  <button type="button" aria-label="Copy record" title="Copy" onClick={() => config.records.length < 30 && set({ records: [...config.records.slice(0, index + 1), { ...record, id: newId(), label: `${record.label} (copy)` }, ...config.records.slice(index + 1)] })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label="Remove record" title="Remove" onClick={() => set({ records: config.records.filter((_, i) => i !== index) })} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {config.fields.map((field) => (
                  <Field key={field.key} label={field.label || field.key}>
                    <input
                      value={record.data[field.key] ?? ""}
                      inputMode={field.type === "number" ? "decimal" : undefined}
                      onChange={(e) => setRecord(index, { data: { ...record.data, [field.key]: e.target.value } })}
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {config.records.length < 30 && (
          <button type="button" onClick={() => set({ records: [...config.records, { id: newId(), label: `Record ${config.records.length + 1}`, hidden: false, data: {} }] })} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]">
            <Plus className="h-3 w-3" /> Add record
          </button>
        )}
      </Card>

      <Card title="Model workflow (hidden from interns)" help="Build the workflow that does the right thing. Its result on each record is the answer interns are checked against. Any {{field}} you use in a message becomes something the intern's message must include too.">
        <WorkflowBuilder workflow={config.solution} onChange={(solution) => set({ solution: { ...solution, trigger: config.trigger } })} lists={lists} />
        {modelProblems.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 rounded-lg bg-amber-50 py-3 pl-8 pr-3 text-[11px] text-amber-900">
            {modelProblems.slice(0, 6).map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Most steps allowed">
            <input type="number" min={3} max={40} value={config.maxSteps} onChange={(e) => set({ maxSteps: Number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Test runs per intern">
            <input type="number" min={1} max={100} value={config.maxRuns} onChange={(e) => set({ maxRuns: Number(e.target.value) })} className={inputClass} />
          </Field>
        </div>
      </Card>

      <ModelAnswers config={config} disabled={modelProblems.length > 0} />
      <TestRun config={config} lists={lists} />
    </div>
  );
}

/** Runs the model workflow on every record so the admin can check the answers. */
function ModelAnswers({ config, disabled }: { config: AutomationConfig; disabled: boolean }) {
  const [state, setState] = useState<
    { loading: true } | { error: string } | { expected: Record<string, ExpectedEffect[]>; labels: AiLabels } | null
  >(null);

  async function check() {
    setState({ loading: true });
    const response = await fetch("/api/admin/internship/lab/test-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "AUTOMATION", config }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setState(response?.ok ? { expected: body.expected, labels: body.labels } : { error: body?.error ?? "Unable to check." });
  }

  return (
    <Card title="Check the model answers" help="See what the model workflow does with every record, including what its AI steps decide. Fix the records or the workflow until every answer is right; answers are worked out again when you save.">
      <button type="button" onClick={() => void check()} disabled={disabled || (state !== null && "loading" in state)} className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
        {state && "loading" in state ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Check model answers
      </button>
      {state && "error" in state && <p className="mt-3 text-xs font-semibold text-red-600">{state.error}</p>}
      {state && "expected" in state && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.06em] text-slate-500">
                <th className="py-2 pr-3">Record</th>
                <th className="py-2 pr-3">AI decided</th>
                <th className="py-2 pr-3">Should happen</th>
              </tr>
            </thead>
            <tbody>
              {config.records.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold text-[#1C1D52]">
                    {record.label}
                    {record.hidden && <span className="ml-1 font-normal text-violet-600">(hidden)</span>}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {Object.values(state.labels).map((byRecord) => byRecord[record.id]).filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="min-w-[220px] py-2 pr-3">
                    <ExpectedList expected={state.expected[record.id] ?? []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Try the exercise as an intern, against every record; nothing is saved. */
type Lists = Pick<AutomationConfig, "fields" | "channels" | "sheets" | "stages" | "team">;

function TestRun({ config, lists }: { config: AutomationConfig; lists: Lists }) {
  const [workflow, setWorkflow] = useState<Workflow>(BLANK_WORKFLOW);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  // The saved answers (cleared by any edit until the next save).
  const shown = publicAutomationConfig({ ...config, ...lists });

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[#1C1D52]">Test run</h2>
        <p className="text-[10px] leading-4 text-slate-500">
          Try the exercise as an intern with your current settings (no need to save first). Test runs here check every record, hidden ones included. “What should happen” in the sample table fills in once the exercise is saved. Nothing here is stored.
        </p>
      </div>
      <AutomationSimulator
        config={shown}
        workflow={workflow}
        onWorkflowChange={setWorkflow}
        runs={runs}
        onRun={async (next) => {
          const response = await fetch("/api/admin/internship/lab/test-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "AUTOMATION", config, workflow: next }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok) return body?.error ?? "Unable to run.";
          setRuns((current) => [...current, body.run as AutomationRun]);
          return null;
        }}
      />
    </section>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <Field label={label}>
      <textarea rows={4} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} className={inputClass} />
    </Field>
  );
}

function Card({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <h2 className="text-sm font-bold text-[#1C1D52]">{title}</h2>
      <p className="mb-4 text-[10px] leading-4 text-slate-500">{help}</p>
      {children}
    </section>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 mt-4 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
