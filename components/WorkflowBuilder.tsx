"use client";

import {
  ArrowDown,
  ArrowUp,
  Bell,
  ClipboardList,
  Contact,
  GitBranch,
  Mail,
  MessageSquareText,
  Plus,
  Sheet,
  Smartphone,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  ACTIONS,
  choicesFor,
  newId,
  OPERATORS,
  TRIGGERS,
  variableNames,
  type ActionKind,
  type Field,
  type Operator,
  type Step,
  type TriggerId,
  type Workflow,
} from "@/lib/automation-sim/model";

// Block editor for an automation workflow: a trigger, then steps in order.
// Conditions hold a "Yes" and a "No" branch, each its own list of steps.
// Used by interns in the Practice Lab and by admins for the model workflow.

export type BuilderLists = {
  fields: Field[];
  channels: string[];
  sheets: string[];
  stages: string[];
  team: string[];
};

type Ctx = {
  lists: BuilderLists;
  variables: Array<{ key: string; label: string }>;
  /** Steps the selected record went through, with what happened there. */
  path: Map<string, string> | null;
  readOnly: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52] disabled:bg-slate-50";

const ACTION_ICON: Record<ActionKind, typeof Mail> = {
  EMAIL: Mail,
  CHAT: MessageSquareText,
  SHEET: Sheet,
  CRM: Contact,
  SMS: Smartphone,
  TASK: ClipboardList,
};

export default function WorkflowBuilder({
  workflow,
  onChange,
  lists,
  path = null,
  readOnly = false,
}: {
  workflow: Workflow;
  onChange: (workflow: Workflow) => void;
  lists: BuilderLists;
  path?: Map<string, string> | null;
  readOnly?: boolean;
}) {
  const ctx: Ctx = {
    lists,
    variables: variableNames(lists.fields, workflow),
    path,
    readOnly,
  };
  return (
    <div className="space-y-0">
      <div className="rounded-xl border-2 border-[#1C1D52]/15 bg-[#f8fbff] p-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1C1D52]">
          <Zap className="h-4 w-4 text-amber-500" /> Trigger: when this happens…
        </p>
        <select
          value={workflow.trigger}
          disabled={readOnly}
          onChange={(event) =>
            onChange({ ...workflow, trigger: event.target.value as TriggerId | "" })
          }
          className={`${inputClass} mt-2`}
        >
          <option value="">Choose a trigger</option>
          {(Object.keys(TRIGGERS) as TriggerId[]).map((trigger) => (
            <option key={trigger} value={trigger}>
              {TRIGGERS[trigger].label}
            </option>
          ))}
        </select>
        {workflow.trigger && (
          <p className="mt-1 text-[10px] text-slate-500">
            {TRIGGERS[workflow.trigger].help}
          </p>
        )}
      </div>
      <StepList
        steps={workflow.steps}
        onChange={(steps) => onChange({ ...workflow, steps })}
        ctx={ctx}
      />
    </div>
  );
}

function blankStep(type: Step["type"], lists: BuilderLists): Step {
  if (type === "IF")
    return {
      id: newId(),
      type: "IF",
      match: "ALL",
      rules: [{ field: lists.fields[0]?.key ?? "", op: "EQUALS", value: "" }],
      then: [],
      else: [],
    };
  if (type === "AI")
    return {
      id: newId(),
      type: "AI",
      input: lists.fields[0] ? `{{${lists.fields[0].key}}}` : "",
      categories: "",
      output: "category",
    };
  return { id: newId(), type: "ACTION", action: "EMAIL", target: "", subject: "", text: "" };
}

function StepList({
  steps,
  onChange,
  ctx,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  ctx: Ctx;
}) {
  const replace = (index: number, step: Step) =>
    onChange(steps.map((s, i) => (i === index ? step : s)));
  const move = (index: number, by: number) => {
    const next = [...steps];
    const [step] = next.splice(index, 1);
    next.splice(index + by, 0, step);
    onChange(next);
  };
  const insert = (index: number, type: Step["type"]) => {
    const next = [...steps];
    next.splice(index, 0, blankStep(type, ctx.lists));
    onChange(next);
  };

  return (
    <div>
      {steps.map((step, index) => (
        <div key={step.id}>
          <Connector />
          <StepCard
            step={step}
            onChange={(next) => replace(index, next)}
            onRemove={() => onChange(steps.filter((_, i) => i !== index))}
            onMove={(by) => move(index, by)}
            first={index === 0}
            last={index === steps.length - 1}
            ctx={ctx}
          />
        </div>
      ))}
      {!ctx.readOnly && (
        <>
          <Connector />
          <AddStep onAdd={(type) => insert(steps.length, type)} />
        </>
      )}
    </div>
  );
}

function Connector() {
  return <div className="ml-5 h-4 border-l-2 border-dashed border-slate-300" aria-hidden />;
}

function AddStep({ onAdd }: { onAdd: (type: Step["type"]) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[11px] font-semibold text-[#1C1D52] hover:border-[#5FBB46] hover:bg-[#f3fbf1]"
      >
        <Plus className="h-3.5 w-3.5" /> Add step
      </button>
    );
  const choice = (type: Step["type"], icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => {
        onAdd(type);
        setOpen(false);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-[#1C1D52] shadow-sm ring-1 ring-slate-200 hover:ring-[#5FBB46]"
    >
      {icon} {label}
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
      {choice("IF", <GitBranch className="h-3.5 w-3.5 text-violet-600" />, "Condition (if / else)")}
      {choice("AI", <Sparkles className="h-3.5 w-3.5 text-[#5FBB46]" />, "AI: sort into categories")}
      {choice("ACTION", <Bell className="h-3.5 w-3.5 text-blue-600" />, "Action")}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2 py-2 text-[11px] text-slate-500"
      >
        Cancel
      </button>
    </div>
  );
}

function StepCard({
  step,
  onChange,
  onRemove,
  onMove,
  first,
  last,
  ctx,
}: {
  step: Step;
  onChange: (step: Step) => void;
  onRemove: () => void;
  onMove: (by: number) => void;
  first: boolean;
  last: boolean;
  ctx: Ctx;
}) {
  const visited = ctx.path?.get(step.id);
  const dimmed = ctx.path && visited === undefined;
  const [icon, title] =
    step.type === "IF"
      ? [<GitBranch key="i" className="h-4 w-4 text-violet-600" />, "Condition"]
      : step.type === "AI"
        ? [<Sparkles key="i" className="h-4 w-4 text-[#5FBB46]" />, "AI: sort into categories"]
        : (() => {
            const Icon = ACTION_ICON[step.action];
            return [<Icon key="i" className="h-4 w-4 text-blue-600" />, ACTIONS[step.action].label];
          })();

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-sm transition ${visited !== undefined ? "border-[#5FBB46] ring-2 ring-[#5FBB46]/30" : "border-slate-200"} ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold text-[#1C1D52]">
          {icon} {title}
        </p>
        {!ctx.readOnly && (
          <div className="flex items-center">
            <IconButton label="Move up" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Move down" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Delete step" onClick={onRemove} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}
      </div>
      {visited && (
        <p className="mt-1 rounded bg-[#e8f7eb] px-2 py-1 text-[10px] font-semibold text-[#397d3a]">
          {visited}
        </p>
      )}
      <div className="mt-2">
        {step.type === "IF" ? (
          <ConditionEditor step={step} onChange={onChange} ctx={ctx} />
        ) : step.type === "AI" ? (
          <AiEditor step={step} onChange={onChange} ctx={ctx} />
        ) : (
          <ActionEditor step={step} onChange={onChange} ctx={ctx} />
        )}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-1.5 disabled:opacity-30 ${danger ? "text-red-500 hover:bg-red-50" : "text-slate-500 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

function ConditionEditor({
  step,
  onChange,
  ctx,
}: {
  step: Extract<Step, { type: "IF" }>;
  onChange: (step: Step) => void;
  ctx: Ctx;
}) {
  const setRule = (index: number, patch: Partial<(typeof step.rules)[number]>) =>
    onChange({
      ...step,
      rules: step.rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    });
  return (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        Continue down “Yes” if
        <select
          value={step.match}
          disabled={ctx.readOnly}
          onChange={(event) => onChange({ ...step, match: event.target.value as "ALL" | "ANY" })}
          className={`${inputClass} w-auto`}
        >
          <option value="ALL">all of these are true</option>
          <option value="ANY">any of these is true</option>
        </select>
      </label>
      {step.rules.map((rule, index) => (
        <div key={index} className="grid gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            value={rule.field}
            disabled={ctx.readOnly}
            onChange={(event) => setRule(index, { field: event.target.value })}
            className={inputClass}
            aria-label="What to check"
          >
            <option value="">Choose…</option>
            {ctx.variables.map((variable) => (
              <option key={variable.key} value={variable.key}>
                {variable.label}
              </option>
            ))}
          </select>
          <select
            value={rule.op}
            disabled={ctx.readOnly}
            onChange={(event) => setRule(index, { op: event.target.value as Operator })}
            className={inputClass}
            aria-label="Comparison"
          >
            {(Object.keys(OPERATORS) as Operator[]).map((op) => (
              <option key={op} value={op}>
                {OPERATORS[op].label}
              </option>
            ))}
          </select>
          {OPERATORS[rule.op].needsValue ? (
            <input
              value={rule.value}
              disabled={ctx.readOnly}
              onChange={(event) => setRule(index, { value: event.target.value })}
              placeholder="Value"
              className={inputClass}
              aria-label="Value"
            />
          ) : (
            <span className="hidden sm:block" />
          )}
          {!ctx.readOnly && (
            <IconButton
              label="Remove rule"
              danger
              disabled={step.rules.length === 1}
              onClick={() => onChange({ ...step, rules: step.rules.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      ))}
      {!ctx.readOnly && step.rules.length < 6 && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...step, rules: [...step.rules, { field: "", op: "EQUALS", value: "" }] })
          }
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
        >
          <Plus className="h-3 w-3" /> Add rule
        </button>
      )}
      <Branch tone="yes" label="Yes" steps={step.then} onChange={(then) => onChange({ ...step, then })} ctx={ctx} />
      <Branch tone="no" label="No (otherwise)" steps={step.else} onChange={(otherwise) => onChange({ ...step, else: otherwise })} ctx={ctx} />
    </div>
  );
}

function Branch({
  tone,
  label,
  steps,
  onChange,
  ctx,
}: {
  tone: "yes" | "no";
  label: string;
  steps: Step[];
  onChange: (steps: Step[]) => void;
  ctx: Ctx;
}) {
  return (
    <div className={`mt-2 border-l-4 pl-3 ${tone === "yes" ? "border-[#5FBB46]" : "border-slate-300"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${tone === "yes" ? "text-[#397d3a]" : "text-slate-500"}`}>
        {label}
      </p>
      {steps.length === 0 && ctx.readOnly && (
        <p className="mt-1 text-[11px] text-slate-400">Nothing happens.</p>
      )}
      <StepList steps={steps} onChange={onChange} ctx={ctx} />
    </div>
  );
}

function AiEditor({
  step,
  onChange,
  ctx,
}: {
  step: Extract<Step, { type: "AI" }>;
  onChange: (step: Step) => void;
  ctx: Ctx;
}) {
  return (
    <div className="space-y-2">
      <Labelled label="Text for the AI to read">
        <TemplateField
          value={step.input}
          onChange={(input) => onChange({ ...step, input })}
          ctx={ctx}
          placeholder="e.g. {{message}}"
        />
      </Labelled>
      <Labelled label="Categories, one per line (Name: what it means)">
        <textarea
          rows={3}
          value={step.categories}
          disabled={ctx.readOnly}
          onChange={(event) => onChange({ ...step, categories: event.target.value })}
          placeholder={"Complaint: the customer is unhappy\nQuestion: asks about our service"}
          className={inputClass}
        />
      </Labelled>
      <Labelled label="Save the AI's answer as">
        <input
          value={step.output}
          disabled={ctx.readOnly}
          onChange={(event) => onChange({ ...step, output: event.target.value.replace(/\s/g, "_") })}
          placeholder="e.g. topic"
          className={`${inputClass} max-w-[200px]`}
        />
      </Labelled>
      <p className="text-[10px] text-slate-500">
        The AI picks one category name (or “Other” if none fits). Use it in a
        condition, or in a message as {`{{${step.output || "name"}}}`}.
      </p>
    </div>
  );
}

function ActionEditor({
  step,
  onChange,
  ctx,
}: {
  step: Extract<Step, { type: "ACTION" }>;
  onChange: (step: Step) => void;
  ctx: Ctx;
}) {
  const action = ACTIONS[step.action];
  const choices = choicesFor(step.action, { ...ctx.lists, maxSteps: 0 });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Labelled label="Action">
        <select
          value={step.action}
          disabled={ctx.readOnly}
          onChange={(event) =>
            onChange({ ...step, action: event.target.value as ActionKind, target: "" })
          }
          className={inputClass}
        >
          {(Object.keys(ACTIONS) as ActionKind[]).map((kind) => (
            <option key={kind} value={kind}>
              {ACTIONS[kind].label}
            </option>
          ))}
        </select>
      </Labelled>
      <Labelled label={action.targetLabel}>
        {choices ? (
          <select
            value={step.target}
            disabled={ctx.readOnly}
            onChange={(event) => onChange({ ...step, target: event.target.value })}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        ) : (
          <TemplateField
            value={step.target}
            onChange={(target) => onChange({ ...step, target })}
            ctx={ctx}
            placeholder={step.action === "SMS" ? "e.g. {{phone}}" : "e.g. {{email}} or sales@company.ng"}
          />
        )}
      </Labelled>
      {action.subject && (
        <div className="sm:col-span-2">
          <Labelled label="Subject">
            <TemplateField
              value={step.subject}
              onChange={(subject) => onChange({ ...step, subject })}
              ctx={ctx}
            />
          </Labelled>
        </div>
      )}
      <div className="sm:col-span-2">
        <Labelled label={action.textLabel}>
          <TemplateField
            value={step.text}
            onChange={(text) => onChange({ ...step, text })}
            ctx={ctx}
            multiline
          />
        </Labelled>
      </div>
    </div>
  );
}

/** Text input with an "Insert field" picker that adds {{field}} at the cursor. */
function TemplateField({
  value,
  onChange,
  ctx,
  placeholder,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  ctx: Ctx;
  placeholder?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const insert = (key: string) => {
    const element = ref.current;
    const at = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? at;
    const token = `{{${key}}}`;
    onChange(value.slice(0, at) + token + value.slice(end));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const common = {
    ref,
    value,
    disabled: ctx.readOnly,
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    className: inputClass,
  };
  return (
    <div>
      {multiline ? <textarea rows={2} {...common} /> : <input {...common} />}
      {!ctx.readOnly && (
        <select
          value=""
          onChange={(event) => event.target.value && insert(event.target.value)}
          className="mt-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600"
          aria-label="Insert a field"
        >
          <option value="">+ Insert field</option>
          {ctx.variables.map((variable) => (
            <option key={variable.key} value={variable.key}>
              {variable.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

// A div, not a label: some fields hold two controls (text plus the field picker).
function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </span>
      {children}
    </div>
  );
}
