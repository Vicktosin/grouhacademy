// AI automation workflow simulator (pure; safe in the browser).
//
// An intern builds a workflow from blocks: one trigger, then conditions
// (if/else branches), AI steps that sort a message into categories, and
// actions (email, team chat, sheet row, CRM stage, SMS, task). The workflow
// runs on sample records and its actions are compared with what the
// admin's model workflow does on the same records. Submitting also runs
// hidden test records, so a workflow can't be tailored to the samples.
//
// Apps have generic names on purpose (no real-product branding).

export type TriggerId = "FORM" | "EMAIL" | "ORDER" | "SHEET_ROW" | "CHAT_MESSAGE" | "SCHEDULE";
export type FieldType = "text" | "number" | "email" | "phone";
export type Operator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "EMPTY"
  | "NOT_EMPTY";
export type ActionKind = "EMAIL" | "CHAT" | "SHEET" | "CRM" | "SMS" | "TASK";
/** Where an action's target comes from. */
type TargetSource = "template" | "channels" | "sheets" | "stages" | "team";

export const TRIGGERS: Record<TriggerId, { label: string; help: string }> = {
  FORM: { label: "New form submission", help: "Someone fills in a form on the website." },
  EMAIL: { label: "New email received", help: "An email arrives in the shared inbox." },
  ORDER: { label: "New order placed", help: "A customer places an order in the online shop." },
  SHEET_ROW: { label: "New row in a sheet", help: "A row is added to a spreadsheet." },
  CHAT_MESSAGE: { label: "New chat message", help: "A customer sends a message on the website chat." },
  SCHEDULE: { label: "On a schedule", help: "Runs at set times, e.g. every morning." },
};

export const OPERATORS: Record<Operator, { label: string; needsValue: boolean }> = {
  EQUALS: { label: "is", needsValue: true },
  NOT_EQUALS: { label: "is not", needsValue: true },
  CONTAINS: { label: "contains", needsValue: true },
  NOT_CONTAINS: { label: "doesn't contain", needsValue: true },
  GT: { label: "is more than", needsValue: true },
  GTE: { label: "is at least", needsValue: true },
  LT: { label: "is less than", needsValue: true },
  LTE: { label: "is at most", needsValue: true },
  EMPTY: { label: "is empty", needsValue: false },
  NOT_EMPTY: { label: "is not empty", needsValue: false },
};

export const ACTIONS: Record<
  ActionKind,
  {
    label: string;
    /** "Email to x@y.com", for describing a result. */
    verb: string;
    targetLabel: string;
    target: TargetSource;
    textLabel: string;
    subject: boolean;
  }
> = {
  EMAIL: { label: "Send an email", verb: "Email to", targetLabel: "To", target: "template", textLabel: "Message", subject: true },
  CHAT: { label: "Post in team chat", verb: "Team chat message in", targetLabel: "Channel", target: "channels", textLabel: "Message", subject: false },
  SHEET: { label: "Add a row to a sheet", verb: "Row added to", targetLabel: "Sheet", target: "sheets", textLabel: "Row values", subject: false },
  CRM: { label: "Add to CRM", verb: "Added to CRM stage", targetLabel: "Pipeline stage", target: "stages", textLabel: "Note", subject: false },
  SMS: { label: "Send an SMS", verb: "SMS to", targetLabel: "To (phone)", target: "template", textLabel: "Message", subject: false },
  TASK: { label: "Create a task", verb: "Task for", targetLabel: "Assign to", target: "team", textLabel: "Task title", subject: false },
};

export type Field = { key: string; label: string; type: FieldType };
export type SampleRecord = {
  id: string;
  label: string;
  /** Hidden records are only run on submit; interns never see them. */
  hidden: boolean;
  data: Record<string, string>;
};

export type Rule = { field: string; op: Operator; value: string };
export type Step =
  | {
      id: string;
      type: "IF";
      match: "ALL" | "ANY";
      rules: Rule[];
      then: Step[];
      else: Step[];
    }
  | {
      id: string;
      type: "AI";
      /** Text to sort, e.g. "{{message}}". */
      input: string;
      /** One category per line, "Name: what it means". */
      categories: string;
      /** Variable the chosen category is stored in. */
      output: string;
    }
  | {
      id: string;
      type: "ACTION";
      action: ActionKind;
      target: string;
      subject: string;
      text: string;
    };
export type Workflow = { trigger: TriggerId | ""; steps: Step[] };

export type AutomationConfig = {
  business: { name: string; description: string };
  /** The trigger that fits the brief (hidden from interns). */
  trigger: TriggerId;
  fields: Field[];
  records: SampleRecord[];
  channels: string[];
  sheets: string[];
  stages: string[];
  team: string[];
  /** The admin's model workflow; it decides the right result. */
  solution: Workflow;
  /** What the model workflow does for each record (worked out on save). */
  expected: Record<string, ExpectedEffect[]> | null;
  maxSteps: number;
  maxRuns: number;
};

/** One thing the workflow did, e.g. a chat message in #sales. */
export type Effect = { action: ActionKind; target: string; text: string };
/** One thing the workflow should do, with record values the message must include. */
export type ExpectedEffect = {
  action: ActionKind;
  target: string;
  /** Field labels and values the text must include. */
  mentions: Array<{ field: string; value: string }>;
};

export type TraceItem = { stepId: string; note: string };

export type RecordOutcome = {
  recordId: string;
  label: string;
  hidden: boolean;
  passed: boolean;
  effects: Effect[];
  expected: ExpectedEffect[];
  problems: string[];
  trace: TraceItem[];
};

export type AutomationResult = {
  /** Percentage of records handled correctly. */
  score: number;
  passed: number;
  total: number;
  triggerOk: boolean;
  outcomes: RecordOutcome[];
};

/** AI step results: stepId → recordId → category. */
export type AiLabels = Record<string, Record<string, string>>;

export const MAX_CATEGORIES = 8;
export const MAX_AI_STEPS = 3;
const MAX_DEPTH = 4;
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_]{0,29}$/;
export const OTHER_CATEGORY = "Other";

// ---------------------------------------------------------------------------
// Parsing (everything from the browser or the database goes through here)
// ---------------------------------------------------------------------------

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const keys = <T extends string>(record: Record<T, unknown>) => Object.keys(record) as T[];
const oneOf = <T extends string>(value: unknown, options: T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const list = (value: unknown, max: number, fallback: string[]) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => text(v, 60).trim()).filter(Boolean))].slice(0, max)
    : fallback;

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseSteps(value: unknown, depth: number, budget: { left: number }): Step[] {
  if (!Array.isArray(value) || depth > MAX_DEPTH) return [];
  const steps: Step[] = [];
  for (const item of value) {
    if (budget.left <= 0) break;
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = text(raw.id, 20) || newId();
    budget.left--;
    if (raw.type === "IF") {
      const rules = Array.isArray(raw.rules)
        ? raw.rules.slice(0, 6).map((rule) => {
            const r = rule && typeof rule === "object" ? (rule as Record<string, unknown>) : {};
            return {
              field: text(r.field, 30),
              op: oneOf(r.op, keys(OPERATORS), "EQUALS"),
              value: text(r.value, 200),
            };
          })
        : [];
      steps.push({
        id,
        type: "IF",
        match: raw.match === "ANY" ? "ANY" : "ALL",
        rules,
        then: parseSteps(raw.then, depth + 1, budget),
        else: parseSteps(raw.else, depth + 1, budget),
      });
    } else if (raw.type === "AI") {
      steps.push({
        id,
        type: "AI",
        input: text(raw.input, 300),
        categories: text(raw.categories, 1500),
        output: text(raw.output, 30),
      });
    } else if (raw.type === "ACTION") {
      steps.push({
        id,
        type: "ACTION",
        action: oneOf(raw.action, keys(ACTIONS), "EMAIL"),
        target: text(raw.target, 200),
        subject: text(raw.subject, 200),
        text: text(raw.text, 1000),
      });
    }
  }
  return steps;
}

export function parseWorkflow(value: unknown): Workflow {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    trigger: raw.trigger === "" ? "" : oneOf(raw.trigger, keys(TRIGGERS), "" as TriggerId),
    steps: parseSteps(raw.steps, 1, { left: 60 }),
  };
}

export const BLANK_WORKFLOW: Workflow = { trigger: "", steps: [] };

function parseFields(value: unknown): Field[] {
  if (!Array.isArray(value)) return DEFAULT_AUTOMATION_CONFIG.fields;
  const seen = new Set<string>();
  return value
    .map((item) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        key: text(raw.key, 30).trim(),
        label: text(raw.label, 60).trim(),
        type: oneOf(raw.type, ["text", "number", "email", "phone"] as FieldType[], "text"),
      };
    })
    .filter((field) => {
      if (!IDENTIFIER.test(field.key) || seen.has(field.key)) return false;
      seen.add(field.key);
      return true;
    })
    .map((field) => ({ ...field, label: field.label || field.key }))
    .slice(0, 12);
}

function parseRecords(value: unknown, fields: Field[]): SampleRecord[] {
  if (!Array.isArray(value)) return DEFAULT_AUTOMATION_CONFIG.records;
  const seen = new Set<string>();
  return value
    .slice(0, 30)
    .map((item, index) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const data = raw.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : {};
      let id = text(raw.id, 20) || newId();
      if (seen.has(id)) id = `${id}-${index}`;
      seen.add(id);
      return {
        id,
        label: text(raw.label, 80).trim() || `Record ${index + 1}`,
        hidden: raw.hidden === true,
        data: Object.fromEntries(fields.map((field) => [field.key, text(data[field.key], 1000)])),
      };
    });
}

function parseExpected(value: unknown): AutomationConfig["expected"] {
  if (!value || typeof value !== "object") return null;
  const out: Record<string, ExpectedEffect[]> = {};
  for (const [recordId, effects] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(effects)) continue;
    out[recordId] = effects.slice(0, 20).map((effect) => {
      const raw = effect && typeof effect === "object" ? (effect as Record<string, unknown>) : {};
      return {
        action: oneOf(raw.action, keys(ACTIONS), "EMAIL"),
        target: text(raw.target, 200),
        mentions: Array.isArray(raw.mentions)
          ? raw.mentions.slice(0, 10).map((m) => {
              const r = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
              return { field: text(r.field, 60), value: text(r.value, 1000) };
            })
          : [],
      };
    });
  }
  return out;
}

export function parseAutomationConfig(value: unknown): AutomationConfig {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const d = DEFAULT_AUTOMATION_CONFIG;
  const business = raw.business && typeof raw.business === "object" ? (raw.business as Record<string, unknown>) : {};
  const fields = parseFields(raw.fields);
  return {
    business: {
      name: text(business.name, 80) || d.business.name,
      description: text(business.description, 2000),
    },
    trigger: oneOf(raw.trigger, keys(TRIGGERS), d.trigger),
    fields,
    records: parseRecords(raw.records, fields),
    channels: list(raw.channels, 10, d.channels),
    sheets: list(raw.sheets, 10, d.sheets),
    stages: list(raw.stages, 10, d.stages),
    team: list(raw.team, 10, d.team),
    solution: raw.solution ? parseWorkflow(raw.solution) : d.solution,
    expected: parseExpected(raw.expected),
    maxSteps: clampInt(raw.maxSteps, 3, 40, d.maxSteps),
    maxRuns: clampInt(raw.maxRuns, 1, 100, d.maxRuns),
  };
}

/** What interns see: no hidden records, no model workflow, no correct trigger. */
export function publicAutomationConfig(config: AutomationConfig) {
  const samples = config.records.filter((record) => !record.hidden);
  return {
    business: config.business,
    fields: config.fields,
    samples: samples.map((record) => ({
      ...record,
      expected: config.expected?.[record.id] ?? [],
    })),
    hiddenCount: config.records.length - samples.length,
    channels: config.channels,
    sheets: config.sheets,
    stages: config.stages,
    team: config.team,
    maxSteps: config.maxSteps,
    maxRuns: config.maxRuns,
  };
}
export type PublicAutomationConfig = ReturnType<typeof publicAutomationConfig>;

// ---------------------------------------------------------------------------
// Checking a workflow before it runs
// ---------------------------------------------------------------------------

export function countSteps(steps: Step[]): number {
  return steps.reduce(
    (total, step) =>
      total + 1 + (step.type === "IF" ? countSteps(step.then) + countSteps(step.else) : 0),
    0,
  );
}

/** Every step, depth first. */
export function allSteps(steps: Step[]): Step[] {
  return steps.flatMap((step) =>
    step.type === "IF" ? [step, ...allSteps(step.then), ...allSteps(step.else)] : [step],
  );
}

export function parseCategories(value: string) {
  const lines = value.includes("\n") ? value.split("\n") : value.split(",");
  const seen = new Set<string>();
  return lines
    .map((line) => {
      const [name, ...rest] = line.split(":");
      return { name: name.trim().slice(0, 40), description: rest.join(":").trim().slice(0, 200) };
    })
    .filter((category) => {
      const key = category.name.toLowerCase();
      if (!category.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_CATEGORIES);
}

/** Field keys and AI output names a step can use. */
export function variableNames(fields: Field[], workflow: Workflow) {
  return [
    ...fields.map((field) => ({ key: field.key, label: field.label })),
    ...allSteps(workflow.steps)
      .filter((step): step is Extract<Step, { type: "AI" }> => step.type === "AI" && IDENTIFIER.test(step.output))
      .map((step) => ({ key: step.output, label: `${step.output} (AI)` })),
  ];
}

type Lists = Pick<AutomationConfig, "fields" | "channels" | "sheets" | "stages" | "team" | "maxSteps">;

export function choicesFor(action: ActionKind, lists: Lists) {
  const source = ACTIONS[action].target;
  return source === "template" ? null : lists[source];
}

/** Problems that stop a workflow from running, in plain words. */
export function workflowProblems(workflow: Workflow, lists: Lists): string[] {
  const problems: string[] = [];
  if (!workflow.trigger) problems.push("Choose a trigger: what starts the workflow?");
  if (!workflow.steps.length) problems.push("Add at least one step after the trigger.");
  const total = countSteps(workflow.steps);
  if (total > lists.maxSteps) problems.push(`Use at most ${lists.maxSteps} steps (you have ${total}).`);
  const fieldKeys = new Set(lists.fields.map((field) => field.key));
  const steps = allSteps(workflow.steps);
  const aiSteps = steps.filter((step) => step.type === "AI");
  if (aiSteps.length > MAX_AI_STEPS) problems.push(`Use at most ${MAX_AI_STEPS} AI steps.`);
  const outputs = new Set<string>();
  const known = new Set([...fieldKeys, ...aiSteps.map((step) => step.output)]);

  steps.forEach((step, index) => {
    const name = `Step ${index + 1}`;
    if (step.type === "IF") {
      if (!step.rules.length) problems.push(`${name} (condition): add a rule.`);
      step.rules.forEach((rule) => {
        if (!known.has(rule.field)) problems.push(`${name} (condition): choose what to check in every rule.`);
        else if (OPERATORS[rule.op].needsValue && !rule.value.trim())
          problems.push(`${name} (condition): give a value to compare “${rule.field}” with.`);
      });
    } else if (step.type === "AI") {
      if (!step.input.trim()) problems.push(`${name} (AI): choose the text the AI should read.`);
      if (parseCategories(step.categories).length < 2) problems.push(`${name} (AI): list at least 2 categories, one per line.`);
      if (!IDENTIFIER.test(step.output))
        problems.push(`${name} (AI): name the result with letters, numbers or _ (e.g. topic).`);
      else if (fieldKeys.has(step.output) || outputs.has(step.output))
        problems.push(`${name} (AI): the result name “${step.output}” is already used.`);
      outputs.add(step.output);
    } else {
      const choices = choicesFor(step.action, lists);
      if (!step.target.trim()) problems.push(`${name} (${ACTIONS[step.action].label}): fill in “${ACTIONS[step.action].targetLabel}”.`);
      else if (choices && !choices.includes(step.target))
        problems.push(`${name} (${ACTIONS[step.action].label}): choose one of the listed options.`);
      if (!step.text.trim()) problems.push(`${name} (${ACTIONS[step.action].label}): write the ${ACTIONS[step.action].textLabel.toLowerCase()}.`);
    }
  });
  return [...new Set(problems)];
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Fills {{name}} placeholders from the record and AI results. */
export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(PLACEHOLDER, (_, key: string) => vars[key] ?? "");
}

const toNumber = (value: string) => {
  const n = Number(value.replace(/[₦$,\s]/g, ""));
  return Number.isFinite(n) && value.trim() !== "" ? n : null;
};
const norm = (value: string) => value.trim().toLowerCase();

export function ruleMatches(rule: Rule, vars: Record<string, string>) {
  const actual = vars[rule.field] ?? "";
  const expected = fillTemplate(rule.value, vars);
  switch (rule.op) {
    case "EQUALS":
      return norm(actual) === norm(expected);
    case "NOT_EQUALS":
      return norm(actual) !== norm(expected);
    case "CONTAINS":
      return norm(expected) !== "" && norm(actual).includes(norm(expected));
    case "NOT_CONTAINS":
      return !norm(actual).includes(norm(expected)) || norm(expected) === "";
    case "EMPTY":
      return actual.trim() === "";
    case "NOT_EMPTY":
      return actual.trim() !== "";
    default: {
      const a = toNumber(actual);
      const b = toNumber(expected);
      if (a === null || b === null) return false;
      return rule.op === "GT" ? a > b : rule.op === "GTE" ? a >= b : rule.op === "LT" ? a < b : a <= b;
    }
  }
}

function describeRule(rule: Rule) {
  return `${rule.field} ${OPERATORS[rule.op].label}${OPERATORS[rule.op].needsValue ? ` “${rule.value}”` : ""}`;
}

function execute(
  steps: Step[],
  vars: Record<string, string>,
  record: SampleRecord,
  labels: AiLabels,
  effects: Effect[],
  trace: TraceItem[],
) {
  for (const step of steps) {
    if (step.type === "IF") {
      const results = step.rules.map((rule) => ruleMatches(rule, vars));
      const yes = step.match === "ANY" ? results.some(Boolean) : results.every(Boolean);
      trace.push({
        stepId: step.id,
        note: `${yes ? "Yes" : "No"}: ${step.rules.map(describeRule).join(step.match === "ANY" ? " or " : " and ")}`,
      });
      execute(yes ? step.then : step.else, vars, record, labels, effects, trace);
    } else if (step.type === "AI") {
      const category = labels[step.id]?.[record.id] ?? OTHER_CATEGORY;
      vars[step.output] = category;
      trace.push({ stepId: step.id, note: `AI sorted it as “${category}”` });
    } else {
      const effect: Effect = {
        action: step.action,
        target: fillTemplate(step.target, vars).trim(),
        text: [step.subject && ACTIONS[step.action].subject ? fillTemplate(step.subject, vars) : "", fillTemplate(step.text, vars)]
          .filter(Boolean)
          .join("\n"),
      };
      effects.push(effect);
      trace.push({ stepId: step.id, note: describeEffect(effect) });
    }
  }
}

/** Runs the workflow on one record. A different trigger never fires. */
export function runOnRecord(
  workflow: Workflow,
  trigger: TriggerId,
  record: SampleRecord,
  labels: AiLabels,
) {
  const effects: Effect[] = [];
  const trace: TraceItem[] = [];
  if (workflow.trigger === trigger)
    execute(workflow.steps, { ...record.data }, record, labels, effects, trace);
  return { effects, trace };
}

/** The model workflow's actions as expected results, with the values each message must include. */
export function expectedFrom(
  solution: Workflow,
  config: Pick<AutomationConfig, "trigger" | "fields" | "records">,
  labels: AiLabels,
): Record<string, ExpectedEffect[]> {
  const out: Record<string, ExpectedEffect[]> = {};
  const fieldLabel = new Map(config.fields.map((field) => [field.key, field.label]));
  const actionSteps = new Map(
    allSteps(solution.steps)
      .filter((step): step is Extract<Step, { type: "ACTION" }> => step.type === "ACTION")
      .map((step) => [step.id, step]),
  );
  for (const record of config.records) {
    const { trace, effects } = runOnRecord(solution, config.trigger, record, labels);
    // Pair each effect with the action step that made it (same order).
    const made = trace.map((item) => actionSteps.get(item.stepId)).filter(Boolean) as Array<Extract<Step, { type: "ACTION" }>>;
    out[record.id] = effects.map((effect, index) => {
      const step = made[index];
      const used = new Set(
        [...`${step?.subject ?? ""} ${step?.text ?? ""}`.matchAll(PLACEHOLDER)].map((m) => m[1]),
      );
      return {
        action: effect.action,
        target: effect.target,
        mentions: [...used]
          .filter((key) => fieldLabel.has(key) && (record.data[key] ?? "").trim().length >= 2)
          .map((key) => ({ field: fieldLabel.get(key)!, value: record.data[key].trim() })),
      };
    });
  }
  return out;
}

export function describeEffect(effect: { action: ActionKind; target: string }) {
  const action = ACTIONS[effect.action];
  const target = action.target === "sheets" || action.target === "stages" ? `“${effect.target}”` : effect.target;
  return `${action.verb} ${target || "(nobody)"}`;
}

/** Compares what the workflow did for a record with what it should do. */
export function compareOutcome(effects: Effect[], expected: ExpectedEffect[]) {
  const problems: string[] = [];
  const unused = [...effects];
  for (const want of expected) {
    const index = unused.findIndex(
      (effect) => effect.action === want.action && norm(effect.target) === norm(want.target),
    );
    if (index === -1) {
      problems.push(`Missing: ${describeEffect(want)}.`);
      continue;
    }
    const [got] = unused.splice(index, 1);
    const missing = want.mentions.filter((m) => !norm(got.text).includes(norm(m.value)));
    if (missing.length)
      problems.push(
        `${describeEffect(want)} should include the ${missing.map((m) => m.field.toLowerCase()).join(" and ")}.`,
      );
  }
  for (const extra of unused) problems.push(`Shouldn't happen: ${describeEffect(extra)}.`);
  return problems;
}

/** Runs the workflow on records and checks every result. */
export function scoreWorkflow(
  workflow: Workflow,
  config: Pick<AutomationConfig, "trigger" | "records">,
  expected: Record<string, ExpectedEffect[]>,
  labels: AiLabels,
  records: SampleRecord[] = config.records,
): AutomationResult {
  const triggerOk = workflow.trigger === config.trigger;
  const outcomes = records.map((record) => {
    const { effects, trace } = runOnRecord(workflow, config.trigger, record, labels);
    const want = expected[record.id] ?? [];
    const problems = triggerOk
      ? compareOutcome(effects, want)
      : ["The workflow never started: this trigger doesn't fire for these records.", ...compareOutcome(effects, want)];
    return {
      recordId: record.id,
      label: record.label,
      hidden: record.hidden,
      passed: problems.length === 0,
      effects,
      expected: want,
      problems,
      trace,
    };
  });
  const passed = outcomes.filter((outcome) => outcome.passed).length;
  return {
    score: outcomes.length ? Math.round((passed / outcomes.length) * 100) : 0,
    passed,
    total: outcomes.length,
    triggerOk,
    outcomes,
  };
}

/** A result safe to show an intern: hidden records keep only pass/fail. */
export function publicResult(result: AutomationResult): AutomationResult {
  let hiddenNumber = 0;
  return {
    ...result,
    outcomes: result.outcomes.map((outcome) =>
      outcome.hidden
        ? {
            recordId: `hidden-${++hiddenNumber}`,
            label: `Hidden test ${hiddenNumber}`,
            hidden: true,
            passed: outcome.passed,
            effects: [],
            expected: [],
            problems: [],
            trace: [],
          }
        : outcome,
    ),
  };
}

// ---------------------------------------------------------------------------
// Example exercise (what a new exercise starts from)
// ---------------------------------------------------------------------------

const SAMPLE_SOLUTION: Workflow = {
  trigger: "FORM",
  steps: [
    {
      id: "ai1",
      type: "AI",
      input: "{{message}}",
      categories:
        "Complaint: unhappy about a late, damaged or missing parcel or package, poor service, or wants a refund\nSales enquiry: wants to send or book a delivery, or asks for a price or quote\nQuestion: any other question",
      output: "topic",
    },
    {
      id: "if1",
      type: "IF",
      match: "ALL",
      rules: [{ field: "topic", op: "EQUALS", value: "Complaint" }],
      then: [
        { id: "a1", type: "ACTION", action: "CHAT", target: "#support", subject: "", text: "Complaint from {{name}}: {{message}}" },
        { id: "a2", type: "ACTION", action: "EMAIL", target: "{{email}}", subject: "We're sorry, {{name}}", text: "Hi {{name}}, we're sorry about this. Our support team is on it and will reply within 2 hours." },
      ],
      else: [
        {
          id: "if2",
          type: "IF",
          match: "ALL",
          rules: [{ field: "topic", op: "EQUALS", value: "Sales enquiry" }],
          then: [
            {
              id: "if3",
              type: "IF",
              match: "ALL",
              rules: [{ field: "orderValue", op: "GTE", value: "100000" }],
              then: [
                { id: "a3", type: "ACTION", action: "CRM", target: "Hot lead", subject: "", text: "{{name}}" },
                { id: "a4", type: "ACTION", action: "CHAT", target: "#sales", subject: "", text: "Hot lead: {{name}} wants ₦{{orderValue}} of deliveries. Call today." },
              ],
              else: [{ id: "a5", type: "ACTION", action: "CRM", target: "New lead", subject: "", text: "{{name}}" }],
            },
          ],
          else: [
            { id: "a6", type: "ACTION", action: "EMAIL", target: "{{email}}", subject: "Thanks for your question", text: "Hi {{name}}, thanks for reaching out. We'll answer within 24 hours." },
          ],
        },
      ],
    },
  ],
};

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  business: {
    name: "SwiftBox Logistics",
    description:
      "A Lagos delivery company. Every message from the website contact form is read by hand, so complaints wait for hours and big customers go cold.\n\nAutomate the contact form:\n• Complaints: post in #support with the customer's name and their message, and email the customer an apology.\n• Sales enquiries worth ₦100,000 or more: add to the CRM as a “Hot lead” and alert #sales with the name and order value.\n• Smaller sales enquiries: add to the CRM as a “New lead”.\n• Any other question: email the customer that we'll answer within 24 hours.",
  },
  trigger: "FORM",
  fields: [
    { key: "name", label: "Name", type: "text" },
    { key: "email", label: "Email", type: "email" },
    { key: "city", label: "City", type: "text" },
    { key: "orderValue", label: "Order value (₦)", type: "number" },
    { key: "message", label: "Message", type: "text" },
  ],
  records: [
    { id: "r1", label: "Damaged parcel", hidden: false, data: { name: "Chiamaka Obi", email: "chiamaka.obi@example.com", city: "Lagos", orderValue: "0", message: "My parcel arrived with the box torn and the phone screen is cracked. I want a refund." } },
    { id: "r2", label: "Big delivery contract", hidden: false, data: { name: "Tunde Bakare", email: "tunde@bakarefoods.example.com", city: "Ibadan", orderValue: "450000", message: "We need you to deliver 200 cartons of noodles to our shops every month. Please send a quote." } },
    { id: "r3", label: "Small booking", hidden: false, data: { name: "Halima Yusuf", email: "halima.y@example.com", city: "Abuja", orderValue: "15000", message: "How much to send two bags of clothes from Abuja to Kano? I'd like to book for Friday." } },
    { id: "r4", label: "General question", hidden: false, data: { name: "Emeka Nwosu", email: "emeka.n@example.com", city: "Enugu", orderValue: "", message: "Do you have an office in Enugu I can visit?" } },
    { id: "r5", label: "Late delivery", hidden: false, data: { name: "Funke Adeyemi", email: "funke.a@example.com", city: "Lagos", orderValue: "", message: "It's been 9 days and my package still hasn't arrived. This is very poor service." } },
    { id: "h1", label: "Hidden: big quote", hidden: true, data: { name: "Ibrahim Musa", email: "ibrahim@musafarms.example.com", city: "Kaduna", orderValue: "100000", message: "Price for weekly deliveries of farm produce from Kaduna to Abuja?" } },
    { id: "h2", label: "Hidden: missing item", hidden: true, data: { name: "Grace Eze", email: "grace.eze@example.com", city: "Port Harcourt", orderValue: "", message: "One of the three items I sent is missing. Who do I talk to?" } },
    { id: "h3", label: "Hidden: opening hours", hidden: true, data: { name: "Bola Ade", email: "bola.ade@example.com", city: "Lagos", orderValue: "", message: "What time do you close on Saturdays?" } },
  ],
  channels: ["#support", "#sales", "#general"],
  sheets: ["Complaints log", "Leads"],
  stages: ["New lead", "Hot lead", "Customer"],
  team: ["Tunde (Support lead)", "Ngozi (Sales)"],
  solution: SAMPLE_SOLUTION,
  expected: null,
  maxSteps: 20,
  maxRuns: 30,
};
