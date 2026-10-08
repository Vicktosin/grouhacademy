"use client";

import { sql } from "@codemirror/lang-sql";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Database,
  EyeOff,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import BackendSimulator from "@/components/BackendSimulator";
import {
  configProblems,
  EXPECT_OPS,
  LIMITS,
  METHODS,
  newId,
  type ApiTest,
  type BackendConfig,
  type BackendFiles,
  type ExpectOp,
  type Expectation,
  type HttpMethod,
  type TestStep,
} from "@/lib/backend-sim/model";

// Admin settings for a backend API exercise: the database every server and
// test starts from, environment variables, the API tests, and the starter
// code and model answer (run every test on it to check the tests are right).

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

const input = "w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52]";
const mono = "w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[11px] text-[#1C1D52]";

export default function BackendConfigEditor({
  config,
  onChange,
  starterFiles,
  solutionFiles,
  onStarterChange,
  onSolutionChange,
}: {
  config: BackendConfig;
  onChange: (config: BackendConfig) => void;
  starterFiles: BackendFiles;
  solutionFiles: BackendFiles | null;
  onStarterChange: (files: BackendFiles) => void;
  onSolutionChange: (files: BackendFiles) => void;
}) {
  const [tab, setTab] = useState<"starter" | "solution">("solution");
  const [open, setOpen] = useState<string | null>(config.tests[0]?.id ?? null);
  const sqlExtensions = useMemo(() => [sql()], []);
  const problems = configProblems(config);

  const setTest = (id: string, patch: Partial<ApiTest>) =>
    onChange({ ...config, tests: config.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const move = (index: number, by: number) => {
    const tests = [...config.tests];
    const [item] = tests.splice(index, 1);
    tests.splice(Math.max(0, Math.min(tests.length, index + by)), 0, item);
    onChange({ ...config, tests });
  };
  const addTest = () => {
    const test: ApiTest = {
      id: newId(),
      label: "New test",
      hidden: false,
      points: 1,
      hint: "",
      setupSql: "",
      steps: [requestStep()],
    };
    onChange({ ...config, tests: [...config.tests, test] });
    setOpen(test.id);
  };

  return (
    <>
      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <Database className="h-4 w-4 text-[#5FBB46]" /> Exercise database
          </h2>
          <p className="text-[10px] leading-4 text-slate-500">
            SQLite. Creates the tables and sample rows; every server start and every test begins from
            this. Interns can read it but not change it. Leave it empty if interns should design the
            tables themselves in schema.sql.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 text-[12px]">
          <CodeMirror
            value={config.databaseSql}
            minHeight="180px"
            maxHeight="420px"
            extensions={sqlExtensions}
            basicSetup={{ tabSize: 2 }}
            onChange={(databaseSql) => onChange({ ...config, databaseSql })}
          />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            Environment variables (process.env, shown to interns)
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {config.env.map((variable, index) => (
              <li key={index} className="flex gap-2">
                <input
                  value={variable.key}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      env: config.env.map((e, i) =>
                        i === index ? { ...e, key: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") } : e,
                      ),
                    })
                  }
                  placeholder="JWT_SECRET"
                  className={`${mono} max-w-[200px]`}
                />
                <input
                  value={variable.value}
                  onChange={(event) =>
                    onChange({
                      ...config,
                      env: config.env.map((e, i) => (i === index ? { ...e, value: event.target.value } : e)),
                    })
                  }
                  placeholder="value"
                  className={mono}
                />
                <RemoveButton
                  label="Remove variable"
                  onClick={() => onChange({ ...config, env: config.env.filter((_, i) => i !== index) })}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange({ ...config, env: [...config.env, { key: "", value: "" }] })}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
          >
            <Plus className="h-3 w-3" /> Add variable
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">API tests</h2>
            <p className="max-w-2xl text-[10px] leading-4 text-slate-500">
              Each test starts the intern&apos;s server with a fresh database (plus the test&apos;s own
              rows), runs its steps in order and stops at the first failed check. The score is the
              share of points from tests passed. Hidden tests only run on submit; interns see whether
              they passed and your hint. Use hidden tests with different data, edge cases and
              security checks so code can&apos;t be written just for the visible ones. Paths read the
              response: <code>status</code>, <code>body.id</code>, <code>body[0].title</code>,{" "}
              <code>body.length</code>, <code>headers.content-type</code>; database checks read{" "}
              <code>rows[0].count</code>. Save a value (e.g. <code>body.token</code> as{" "}
              <code>token</code>) to use it later as <code>{"{{token}}"}</code>;{" "}
              <code>{"{{random}}"}</code> gives a fresh random string.
            </p>
          </div>
          <button
            type="button"
            onClick={addTest}
            disabled={config.tests.length >= LIMITS.maxTests}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Add test
          </button>
        </div>
        {problems.length > 0 && (
          <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-[11px] text-amber-800">
            {problems.slice(0, 5).map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        <ol className="space-y-2">
          {config.tests.map((test, index) => (
            <li key={test.id} className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOpen(open === test.id ? null : test.id)}
                  aria-label={open === test.id ? "Close test" : "Open test"}
                  className="text-slate-400"
                >
                  {open === test.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span className="w-5 text-[10px] font-bold text-slate-400">{index + 1}</span>
                <input
                  value={test.label}
                  onChange={(event) => setTest(test.id, { label: event.target.value })}
                  placeholder="What this tests (shown to interns)"
                  className={`${input} min-w-[200px] flex-1`}
                />
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={test.hidden}
                    onChange={(event) => setTest(test.id, { hidden: event.target.checked })}
                    className="accent-[#5FBB46]"
                  />
                  <EyeOff className="h-3 w-3" /> Hidden
                </label>
                <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                  Points
                  <select
                    value={test.points}
                    onChange={(event) => setTest(test.id, { points: Number(event.target.value) })}
                    className="rounded border border-slate-200 bg-white px-1 py-1 text-[11px]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <IconButton label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label="Move down"
                  onClick={() => move(index, 1)}
                  disabled={index === config.tests.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconButton>
                <RemoveButton
                  label="Delete test"
                  onClick={() => {
                    if (window.confirm(`Delete “${test.label}”?`))
                      onChange({ ...config, tests: config.tests.filter((t) => t.id !== test.id) });
                  }}
                />
              </div>
              {open === test.id && (
                <TestEditor test={test} onChange={(patch) => setTest(test.id, patch)} />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["solution", "starter"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab === key ? "bg-[#1C1D52] text-white" : "bg-white text-slate-600"}`}
            >
              {key === "starter" ? "Starter code (what interns get)" : "Model answer (test your tests)"}
            </button>
          ))}
        </div>
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-xs text-sky-800">
          {tab === "solution"
            ? "Write a working answer and run the tests: every test, hidden ones included, should pass. Interns never see the model answer."
            : "What interns start with. Run the tests: most should fail until the intern does the work."}
        </p>
        <BackendSimulator
          key={tab}
          files={tab === "starter" ? starterFiles : (solutionFiles ?? starterFiles)}
          onFilesChange={tab === "starter" ? onStarterChange : onSolutionChange}
          databaseSql={config.databaseSql}
          env={config.env}
          tests={config.tests}
          testsLabel={tab === "starter" ? "Run all tests on the starter" : "Run all tests on the model answer"}
        />
      </section>
    </>
  );
}

function requestStep(): TestStep {
  return {
    id: newId(),
    type: "request",
    method: "GET",
    path: "/api/",
    headers: "",
    body: "",
    expect: [{ path: "status", op: "equals", value: "200" }],
    save: [],
  };
}

function TestEditor({ test, onChange }: { test: ApiTest; onChange: (patch: Partial<ApiTest>) => void }) {
  const setStep = (id: string, step: TestStep) =>
    onChange({ steps: test.steps.map((s) => (s.id === id ? step : s)) });
  return (
    <div className="space-y-3 border-t border-slate-100 px-3 py-3">
      {test.hidden && (
        <Field label="Hint shown when this hidden test fails">
          <input
            value={test.hint}
            onChange={(event) => onChange({ hint: event.target.value })}
            placeholder="e.g. Check what happens when the email is already registered."
            className={input}
          />
        </Field>
      )}
      <Field label="Extra rows for this test (optional SQL, runs after the database and the intern's SQL)">
        <textarea
          value={test.setupSql}
          onChange={(event) => onChange({ setupSql: event.target.value })}
          rows={2}
          spellCheck={false}
          placeholder="INSERT INTO books (title, author, price) VALUES ('Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', 6000);"
          className={mono}
        />
      </Field>
      <ol className="space-y-2">
        {test.steps.map((step, index) => (
          <li key={step.id} className="rounded-lg bg-[#f8fbff] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                Step {index + 1} · {step.type === "request" ? "Request" : "Database check"}
              </span>
              <span className="ml-auto" />
              <RemoveButton
                label="Remove step"
                onClick={() => onChange({ steps: test.steps.filter((s) => s.id !== step.id) })}
              />
            </div>
            {step.type === "request" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={step.method}
                    onChange={(event) => setStep(step.id, { ...step, method: event.target.value as HttpMethod })}
                    className="rounded-lg border border-slate-200 bg-white px-2 font-mono text-xs font-bold text-[#1C1D52]"
                  >
                    {METHODS.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    value={step.path}
                    onChange={(event) => setStep(step.id, { ...step, path: event.target.value })}
                    placeholder="/api/books/{{bookId}}"
                    className={mono}
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <textarea
                    value={step.headers}
                    onChange={(event) => setStep(step.id, { ...step, headers: event.target.value })}
                    rows={3}
                    spellCheck={false}
                    placeholder={"Headers, one per line\nAuthorization: Bearer {{token}}"}
                    className={mono}
                  />
                  <textarea
                    value={step.body}
                    onChange={(event) => setStep(step.id, { ...step, body: event.target.value })}
                    rows={3}
                    spellCheck={false}
                    placeholder={'JSON body\n{ "title": "Americanah" }'}
                    className={mono}
                  />
                </div>
                <Expectations
                  value={step.expect}
                  onChange={(expect) => setStep(step.id, { ...step, expect })}
                />
                <div>
                  {step.save.map((save, i) => (
                    <div key={i} className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      Save
                      <input
                        value={save.path}
                        onChange={(event) =>
                          setStep(step.id, {
                            ...step,
                            save: step.save.map((s, j) => (j === i ? { ...s, path: event.target.value } : s)),
                          })
                        }
                        placeholder="body.id"
                        className={`${mono} max-w-[180px]`}
                      />
                      as
                      <input
                        value={save.name}
                        onChange={(event) =>
                          setStep(step.id, {
                            ...step,
                            save: step.save.map((s, j) =>
                              j === i ? { ...s, name: event.target.value.replace(/[^a-zA-Z0-9_]/g, "") } : s,
                            ),
                          })
                        }
                        placeholder="bookId"
                        className={`${mono} max-w-[140px]`}
                      />
                      <RemoveButton
                        label="Remove saved value"
                        onClick={() => setStep(step.id, { ...step, save: step.save.filter((_, j) => j !== i) })}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setStep(step.id, { ...step, save: [...step.save, { name: "", path: "body.id" }] })}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#1C1D52]"
                  >
                    <Plus className="h-3 w-3" /> Save a value for later steps
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={step.sql}
                  onChange={(event) => setStep(step.id, { ...step, sql: event.target.value })}
                  rows={2}
                  spellCheck={false}
                  placeholder="SELECT COUNT(*) AS count FROM books"
                  className={mono}
                />
                <Expectations
                  value={step.expect}
                  onChange={(expect) => setStep(step.id, { ...step, expect })}
                  defaultPath="rows[0].count"
                />
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onChange({ steps: [...test.steps, requestStep()] })}
          disabled={test.steps.length >= LIMITS.maxSteps}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-40"
        >
          <Send className="h-3 w-3" /> Add request
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              steps: [
                ...test.steps,
                {
                  id: newId(),
                  type: "sql",
                  sql: "",
                  expect: [{ path: "rows[0].count", op: "equals", value: "" }],
                },
              ],
            })
          }
          disabled={test.steps.length >= LIMITS.maxSteps}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-40"
        >
          <Database className="h-3 w-3" /> Add database check
        </button>
      </div>
    </div>
  );
}

function Expectations({
  value,
  onChange,
  defaultPath = "body.",
}: {
  value: Expectation[];
  onChange: (value: Expectation[]) => void;
  defaultPath?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Checks</p>
      <ul className="mt-1 space-y-1">
        {value.map((e, index) => {
          const set = (patch: Partial<Expectation>) =>
            onChange(value.map((x, i) => (i === index ? { ...x, ...patch } : x)));
          return (
            <li key={index} className="flex gap-1.5">
              <input
                value={e.path}
                onChange={(event) => set({ path: event.target.value })}
                placeholder="status"
                className={`${mono} max-w-[200px]`}
              />
              <select
                value={e.op}
                onChange={(event) => set({ op: event.target.value as ExpectOp })}
                className="rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] text-[#1C1D52]"
              >
                {(Object.keys(EXPECT_OPS) as ExpectOp[]).map((op) => (
                  <option key={op} value={op}>
                    {EXPECT_OPS[op].label}
                  </option>
                ))}
              </select>
              {EXPECT_OPS[e.op].needsValue ? (
                <input
                  value={e.value}
                  onChange={(event) => set({ value: event.target.value })}
                  placeholder={e.op === "type" ? "array, object, string, number…" : "201, \"text\", {\"a\": 1}"}
                  className={mono}
                />
              ) : (
                <span className="flex-1" />
              )}
              <RemoveButton label="Remove check" onClick={() => onChange(value.filter((_, i) => i !== index))} />
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...value, { path: defaultPath, op: "equals", value: "" }])}
        disabled={value.length >= LIMITS.maxExpect}
        className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#1C1D52] disabled:opacity-40"
      >
        <Plus className="h-3 w-3" /> Add check
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded p-1.5 text-red-500 hover:bg-red-50">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
