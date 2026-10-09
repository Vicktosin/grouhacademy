"use client";

import { useFullscreen } from "@/components/FullscreenFrame";

import { javascript } from "@codemirror/lang-javascript";
import { sql } from "@codemirror/lang-sql";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  FilePlus2,
  FlaskConical,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Send,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackendSandbox } from "@/lib/backend-sim/client";
import type { SqlResult, TableInfo } from "@/lib/backend-sim/engine";
import {
  buildRequest,
  ENTRY_FILE,
  isValidFileName,
  LIMITS,
  METHODS,
  parseBody,
  scoreTests,
  sortedFileNames,
  sqlFiles,
  type ApiTest,
  type BackendFiles,
  type BackendResult,
  type EnvVar,
  type HttpMethod,
  type HttpRequest,
  type HttpResponse,
  type LogLine,
  type StepResult,
  type TestResult,
} from "@/lib/backend-sim/model";

// The backend API workspace: files and an editor, a live server running in
// a sandbox in the browser (restarted as the code changes, like nodemon),
// an API client to send it requests, the database, the exercise's tests,
// and a terminal with the server's logs. Used by interns and by admins
// building exercises.

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">Loading editor…</div>
  ),
});

/** Restart the server this long after the code stops changing. */
const RESTART_MS = 900;
const MAX_LOGS = 500;
const EXERCISE_DB_TAB = "__database__";

type ServerState =
  | { status: "starting" }
  | { status: "running" }
  | { status: "error"; error: string };
type Tab = "client" | "database" | "tests" | "help";
type Sent = { request: HttpRequest; response: HttpResponse };
type StartResult = { error: string | null; logs: LogLine[]; tables?: TableInfo[] };

const statusTone = (status: number) =>
  status >= 200 && status < 300
    ? "bg-[#e8f7eb] text-[#397d3a]"
    : status >= 300 && status < 500
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

/** Pretty JSON when it parses, else the text. */
function pretty(body: string) {
  const parsed = parseBody(body);
  return typeof parsed === "string" ? body : JSON.stringify(parsed, null, 2);
}

/** What changes the database: the exercise's SQL, the intern's .sql files, env. */
function databaseKey(files: BackendFiles, databaseSql: string, env: EnvVar[]) {
  return JSON.stringify([databaseSql, sqlFiles(files).map((name) => [name, files[name]]), env]);
}

export default function BackendSimulator({
  files,
  onFilesChange,
  databaseSql,
  env,
  tests,
  hiddenTests = 0,
  readOnly = false,
  onSubmit,
  submitLabel = "Submit",
  extraActions,
  submission,
  testsLabel = "Run tests",
}: {
  files: BackendFiles;
  onFilesChange?: (files: BackendFiles) => void;
  databaseSql: string;
  env: EnvVar[];
  /** Tests that can be run here (interns: the visible ones). */
  tests: ApiTest[];
  /** How many more tests only run on submit. */
  hiddenTests?: number;
  readOnly?: boolean;
  onSubmit?: () => Promise<void> | void;
  submitLabel?: string;
  extraActions?: React.ReactNode;
  /** The last submission's results from the server. */
  submission?: { at: string; result: BackendResult } | null;
  testsLabel?: string;
}) {
  // Full screen (Practice Lab): the editor fills the screen.
  const { full } = useFullscreen();
  const names = useMemo(() => sortedFileNames(files), [files]);
  const [activeFile, setActiveFile] = useState(ENTRY_FILE);
  const [tab, setTab] = useState<Tab>("client");
  const [server, setServer] = useState<ServerState>({ status: "starting" });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [restarts, setRestarts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const sandbox = useRef<BackendSandbox | null>(null);
  const startedKey = useRef<string | null>(null);
  const filesRef = useRef(files);
  useLayoutEffect(() => {
    filesRef.current = files;
  }, [files]);

  const addLogs = useCallback((lines: LogLine[]) => {
    if (lines.length) setLogs((current) => [...current, ...lines].slice(-MAX_LOGS));
  }, []);

  // One sandbox for the life of the workspace.
  useEffect(() => {
    const box = new BackendSandbox(() => {
      startedKey.current = null;
      setServer({ status: "error", error: "The server was restarted after getting stuck." });
      setRestarts((n) => n + 1);
    });
    sandbox.current = box;
    return () => box.dispose();
  }, []);

  const call = useCallback(<T,>(message: Parameters<BackendSandbox["call"]>[0], options?: Parameters<BackendSandbox["call"]>[1]) => {
    if (!sandbox.current) return Promise.reject(new Error("The simulator isn't ready."));
    return sandbox.current.call<T>(message, options);
  }, []);

  /** Starts with a fresh database, or reloads the code keeping the data. */
  const startServer = useCallback(
    async (fresh: boolean) => {
      const current = filesRef.current;
      const key = databaseKey(current, databaseSql, env);
      const reload = !fresh && startedKey.current === key;
      setServer({ status: "starting" });
      addLogs([
        {
          level: "system",
          text: reload ? "Restarting the server (your code changed)…" : "Starting the server with a fresh database…",
        },
      ]);
      try {
        const result = await call<StartResult>(
          reload ? { type: "reload", files: current } : { type: "start", files: current, databaseSql, env },
        );
        addLogs(result.logs);
        if (result.tables) setTables(result.tables);
        if (result.error) {
          // A database error means nothing is running; a code error keeps the data.
          startedKey.current = reload ? key : null;
          setServer({ status: "error", error: result.error });
          if (!result.logs.some((line) => line.text === result.error))
            addLogs([{ level: "error", text: result.error }]);
          return;
        }
        startedKey.current = key;
        setServer({ status: "running" });
      } catch (error) {
        startedKey.current = null;
        const message = error instanceof Error ? error.message : String(error);
        setServer({ status: "error", error: message });
        addLogs([{ level: "error", text: message }]);
      }
    },
    [addLogs, call, databaseSql, env],
  );

  // Restart shortly after the code stops changing (and after a crash).
  useEffect(() => {
    const timer = window.setTimeout(() => void startServer(false), RESTART_MS);
    return () => window.clearTimeout(timer);
  }, [files, databaseSql, env, restarts, startServer]);

  const changeFile = (name: string, contents: string) =>
    onFilesChange?.({ ...filesRef.current, [name]: contents });

  const addFile = () => {
    const name = window.prompt("File name, e.g. routes/books.js or seed.sql")?.trim();
    if (!name) return;
    if (!isValidFileName(name)) {
      window.alert("Use letters, numbers, - and _, ending in .js or .sql (folders like routes/ are fine).");
      return;
    }
    if (files[name] !== undefined) {
      setActiveFile(name);
      return;
    }
    if (names.length >= LIMITS.maxFiles) {
      window.alert(`An exercise can have up to ${LIMITS.maxFiles} files.`);
      return;
    }
    onFilesChange?.({
      ...files,
      [name]: name.endsWith(".sql")
        ? "-- Runs when the server starts, after the exercise database.\n"
        : 'const db = require("./db");\n\nmodule.exports = {};\n',
    });
    setActiveFile(name);
  };

  const removeFile = (name: string) => {
    if (name === ENTRY_FILE || !window.confirm(`Delete ${name}?`)) return;
    const next = { ...files };
    delete next[name];
    onFilesChange?.(next);
    setActiveFile(ENTRY_FILE);
  };

  const shownFile = activeFile === EXERCISE_DB_TAB || files[activeFile] !== undefined ? activeFile : ENTRY_FILE;
  const extensions = useMemo(
    () => [shownFile.endsWith(".js") ? javascript() : sql()],
    [shownFile],
  );

  const submit = async () => {
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit();
      setTab("tests");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Files and editor */}
        <div className={`flex ${full ? "min-h-[calc(100vh-200px)]" : "min-h-[520px]"} min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white`}>
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8fbff] px-2 pt-2">
            {names.map((name) => (
              <span
                key={name}
                className={`group flex shrink-0 items-center rounded-t-lg ${
                  shownFile === name ? "border border-b-0 border-slate-200 bg-white" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFile(name)}
                  className={`px-3 py-2 text-xs font-semibold ${
                    shownFile === name ? "text-[#1C1D52]" : "text-slate-500 hover:text-[#1C1D52]"
                  }`}
                >
                  {name}
                </button>
                {name !== ENTRY_FILE && !readOnly && onFilesChange && (
                  <button
                    type="button"
                    onClick={() => removeFile(name)}
                    aria-label={`Delete ${name}`}
                    className="mr-1 rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            {databaseSql.trim() && (
              <button
                type="button"
                onClick={() => setActiveFile(EXERCISE_DB_TAB)}
                title="The exercise's tables and sample data (read-only)"
                className={`flex shrink-0 items-center gap-1 rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  shownFile === EXERCISE_DB_TAB
                    ? "border border-b-0 border-slate-200 bg-white text-[#1C1D52]"
                    : "text-slate-500 hover:text-[#1C1D52]"
                }`}
              >
                <Lock className="h-3 w-3" /> exercise database
              </button>
            )}
            {!readOnly && onFilesChange && (
              <button
                type="button"
                onClick={addFile}
                className="ml-auto flex shrink-0 items-center gap-1 px-2 py-2 text-[10px] font-semibold text-slate-500 hover:text-[#1C1D52]"
              >
                <FilePlus2 className="h-3.5 w-3.5" /> New file
              </button>
            )}
          </div>
          {shownFile === EXERCISE_DB_TAB && (
            <p className="border-b border-slate-100 bg-sky-50 px-3 py-1.5 text-[10px] text-sky-800">
              The exercise&apos;s tables and sample rows. Every server start and every test begins from
              this; your own .sql files run after it.
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-auto text-[13px]">
            <CodeMirror
              key={shownFile}
              value={shownFile === EXERCISE_DB_TAB ? databaseSql : (files[shownFile] ?? "")}
              height="100%"
              minHeight="480px"
              extensions={extensions}
              readOnly={readOnly || shownFile === EXERCISE_DB_TAB || !onFilesChange}
              basicSetup={{ tabSize: 2 }}
              onChange={(value) => shownFile !== EXERCISE_DB_TAB && changeFile(shownFile, value)}
            />
          </div>
        </div>

        {/* Server tools */}
        <div className={`flex ${full ? "min-h-[calc(100vh-200px)]" : "min-h-[520px]"} min-w-0 flex-col gap-3`}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-[#f8fbff] px-2 py-1.5">
              <ServerBadge server={server} />
              <div className="ml-auto flex flex-wrap gap-1">
                {(
                  [
                    ["client", "API client", Send],
                    ["database", "Database", Database],
                    ["tests", `Tests (${tests.length}${hiddenTests ? ` + ${hiddenTests} hidden` : ""})`, FlaskConical],
                    ["help", "Help", BookOpen],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                      tab === key ? "bg-[#1C1D52] text-white" : "text-slate-500 hover:bg-white hover:text-[#1C1D52]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {/* Kept mounted so the request being written and test results aren't lost. */}
              <div hidden={tab !== "client"}>
                <ApiClient
                  tests={tests}
                  server={server}
                  send={async (request) => {
                    const result = await call<{ response: HttpResponse | null; logs: LogLine[]; tables: TableInfo[] }>(
                      { type: "request", request },
                    );
                    addLogs(result.logs);
                    if (result.tables) setTables(result.tables);
                    const response = result.response ?? {
                      status: 0,
                      headers: {},
                      body: "",
                      timeMs: 0,
                      error: "The server isn't running. Fix the error in the terminal first.",
                    };
                    addLogs([
                      {
                        level: response.error ? "error" : "system",
                        text: `${request.method} ${request.path} → ${response.status || "no response"} (${response.timeMs} ms)`,
                      },
                    ]);
                    return response;
                  }}
                />
              </div>
              {tab === "database" && (
                <DatabasePanel
                  tables={tables}
                  query={async (text) => {
                    const result = await call<{ result: SqlResult; tables: TableInfo[] }>({ type: "query", sql: text });
                    setTables(result.tables);
                    return result.result;
                  }}
                  reset={() => void startServer(true)}
                />
              )}
              <div hidden={tab !== "tests"}>
                <TestsPanel
                  tests={tests}
                  hiddenTests={hiddenTests}
                  testsLabel={testsLabel}
                  submission={submission ?? null}
                  run={(onProgress) =>
                    call<{ results: TestResult[] }>(
                      { type: "runTests", files: filesRef.current, databaseSql, env, tests },
                      { progress: (value) => onProgress(value as TestResult) },
                    ).then((value) => value.results)
                  }
                />
              </div>
              {tab === "help" && <HelpPanel env={env} />}
            </div>
          </div>
          <TerminalPanel logs={logs} onClear={() => setLogs([])} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void startServer(false)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" /> Restart server
        </button>
        {onSubmit && (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || readOnly}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {submitting ? "Running every test…" : submitLabel}
          </button>
        )}
        {extraActions}
        {submission && (
          <span className="text-xs font-semibold text-[#1C1D52]">
            Last submission: {submission.result.score}% · {submission.result.passed} of {submission.result.total}{" "}
            tests passed
          </span>
        )}
      </div>
    </div>
  );
}

function ServerBadge({ server }: { server: ServerState }) {
  if (server.status === "starting")
    return (
      <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting…
      </span>
    );
  if (server.status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-semibold text-[#397d3a]">
        <span className="h-2 w-2 rounded-full bg-[#5FBB46]" /> Server running
      </span>
    );
  return (
    <span
      title={server.error}
      className="inline-flex max-w-[220px] items-center gap-1.5 truncate px-1 text-[11px] font-semibold text-red-600"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" /> Server error: see terminal
    </span>
  );
}

// ---------------------------------------------------------------- API client

function ApiClient({
  tests,
  server,
  send,
}: {
  tests: ApiTest[];
  server: ServerState;
  send: (request: HttpRequest) => Promise<HttpResponse>;
}) {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [history, setHistory] = useState<Sent[]>([]);
  const [showHeaders, setShowHeaders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Requests the tests make, as starting points.
  const examples = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ method: HttpMethod; path: string; headers: string; body: string }> = [];
    for (const test of tests)
      for (const step of test.steps)
        if (step.type === "request" && !/\{\{/.test(step.path)) {
          const key = `${step.method} ${step.path} ${step.body}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ method: step.method, path: step.path, headers: step.headers, body: step.body });
        }
    return out.slice(0, 30);
  }, [tests]);

  // Start from the first example.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !examples.length) return;
    seeded.current = true;
    setMethod(examples[0].method);
    setPath(examples[0].path);
  }, [examples]);

  const go = async () => {
    setSending(true);
    setError(null);
    try {
      const request = buildRequest({ method, path, headers, body: method === "GET" ? "" : body });
      const response = await send(request);
      const item = { request, response };
      setSent(item);
      setHistory((current) => [item, ...current].slice(0, 15));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    } finally {
      setSending(false);
    }
  };

  const load = (item: { method: string; path: string; headers?: string; body: string }) => {
    setMethod((METHODS.includes(item.method as HttpMethod) ? item.method : "GET") as HttpMethod);
    setPath(item.path);
    setHeaders(item.headers ?? "");
    setBody(item.body);
  };

  return (
    <div className="space-y-3 p-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void go();
        }}
        className="flex gap-2"
      >
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value as HttpMethod)}
          aria-label="Method"
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 font-mono text-xs font-bold text-[#1C1D52]"
        >
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          aria-label="Path"
          placeholder="/api/books?inStock=true"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-[#1C1D52]"
        />
        <button
          type="submit"
          disabled={sending || server.status === "starting"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
        </button>
      </form>

      {examples.length > 0 && (
        <select
          value=""
          onChange={(event) => {
            const example = examples[Number(event.target.value)];
            if (example) load(example);
          }}
          aria-label="Requests from the tests"
          className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-500"
        >
          <option value="">Try a request the tests make…</option>
          {examples.map((example, index) => (
            <option key={index} value={index}>
              {example.method} {example.path}
            </option>
          ))}
        </select>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            Headers (one per line)
          </span>
          <textarea
            value={headers}
            onChange={(event) => setHeaders(event.target.value)}
            rows={4}
            spellCheck={false}
            placeholder={"Authorization: Bearer <token>"}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] text-[#1C1D52]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
            JSON body {method === "GET" && "(not sent with GET)"}
          </span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            spellCheck={false}
            disabled={method === "GET"}
            placeholder={'{\n  "title": "Americanah"\n}'}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 font-mono text-[11px] text-[#1C1D52] disabled:bg-slate-50"
          />
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}

      {sent ? (
        <div className="rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-bold ${statusTone(sent.response.status)}`}>
              {sent.response.status || "No response"}
            </span>
            <span className="text-slate-500">{sent.response.timeMs} ms</span>
            <span className="text-slate-500">{sent.response.body.length.toLocaleString()} bytes</span>
            <button
              type="button"
              onClick={() => setShowHeaders((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-[#1C1D52]"
            >
              {showHeaders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Headers
            </button>
          </div>
          {sent.response.error && (
            <p className="whitespace-pre-wrap bg-red-50 px-3 py-2 text-[11px] text-red-700">{sent.response.error}</p>
          )}
          {showHeaders && (
            <dl className="border-b border-slate-100 px-3 py-2 font-mono text-[10px] leading-5 text-slate-600">
              {Object.entries(sent.response.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="font-semibold text-[#1C1D52]">{key}:</dt>
                  <dd className="break-all">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-[#1C1D52]">
            {sent.response.body ? pretty(sent.response.body) : "(empty body)"}
          </pre>
        </div>
      ) : (
        <p className="rounded-xl bg-[#f8fbff] px-3 py-6 text-center text-[11px] text-slate-500">
          Send a request to your server to see the response here.
        </p>
      )}

      {history.length > 1 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">History</p>
          <ul className="space-y-1">
            {history.slice(1).map((item, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => {
                    load({
                      ...item.request,
                      // Without the content type buildRequest added.
                      headers: Object.entries(item.request.headers)
                        .filter(([key]) => key !== "content-type" || !item.request.body)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n"),
                    });
                    setSent(item);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left font-mono text-[10px] hover:bg-[#f8fbff]"
                >
                  <span className={`rounded px-1.5 font-bold ${statusTone(item.response.status)}`}>
                    {item.response.status || "—"}
                  </span>
                  <span className="font-bold text-[#1C1D52]">{item.request.method}</span>
                  <span className="truncate text-slate-600">{item.request.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ database

function DatabasePanel({
  tables,
  query,
  reset,
}: {
  tables: TableInfo[];
  query: (sql: string) => Promise<SqlResult>;
  reset: () => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async (sqlText: string) => {
    setRunning(true);
    try {
      setResult(await query(sqlText));
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[11px] text-slate-500">
          Your running server&apos;s database. Changes here are seen by your API straight away.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Start the server again with a fresh database?")) reset();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
        >
          <RefreshCw className="h-3 w-3" /> Reset database
        </button>
      </div>
      {tables.length === 0 ? (
        <p className="rounded-lg bg-[#f8fbff] px-3 py-3 text-[11px] text-slate-500">No tables yet.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {tables.map((table) => (
            <li key={table.name}>
              <button
                type="button"
                onClick={() => {
                  const statement = `SELECT * FROM "${table.name}" LIMIT 100;`;
                  setText(statement);
                  void run(statement);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-[#5FBB46]"
              >
                <span className="flex items-center justify-between text-xs font-bold text-[#1C1D52]">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-slate-400" /> {table.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {table.rowCount} row{table.rowCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="mt-1 block truncate font-mono text-[10px] text-slate-500">
                  {table.columns.map((c) => `${c.name}${c.pk ? "🔑" : ""} ${c.type.toLowerCase()}`).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim()) void run(text);
        }}
        className="space-y-2"
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && text.trim()) {
              event.preventDefault();
              void run(text);
            }
          }}
          rows={3}
          spellCheck={false}
          placeholder="SELECT * FROM books WHERE stock > 0;"
          aria-label="SQL"
          className="w-full rounded-lg border border-slate-200 bg-[#101426] px-3 py-2 font-mono text-[11px] leading-5 text-white/90"
        />
        <button
          type="submit"
          disabled={running || !text.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run SQL
        </button>
        <span className="ml-2 text-[10px] text-slate-400">Ctrl + Enter</span>
      </form>
      {result &&
        ("error" in result ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">{result.error}</p>
        ) : result.columns.length === 0 ? (
          <p className="rounded-lg bg-[#e8f7eb] px-3 py-2 text-[11px] text-[#397d3a]">Done.</p>
        ) : (
          <RowsTable columns={result.columns} rows={result.rows} />
        ))}
    </div>
  );
}

function RowsTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-left font-mono text-[10px]">
        <thead className="sticky top-0 bg-[#f8fbff] text-[#1C1D52]">
          <tr>
            {columns.map((column, index) => (
              <th key={index} className="px-2 py-1.5 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100 text-slate-600">
              {row.map((value, i) => (
                <td key={i} className="max-w-[200px] truncate px-2 py-1">
                  {value === null ? <span className="text-slate-300">NULL</span> : String(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="px-2 py-2 text-[10px] text-slate-400">No rows.</p>}
    </div>
  );
}

// --------------------------------------------------------------------- tests

function TestsPanel({
  tests,
  hiddenTests,
  testsLabel,
  submission,
  run,
}: {
  tests: ApiTest[];
  hiddenTests: number;
  testsLabel: string;
  submission: { at: string; result: BackendResult } | null;
  run: (onProgress: (result: TestResult) => void) => Promise<TestResult[]>;
}) {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    try {
      setResults(await run((result) => setResults((current) => [...(current ?? []), result])));
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setRunning(false);
    }
  };

  const local = results && results.length ? scoreTests(results) : null;

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void start()}
          disabled={running || tests.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {running ? "Testing…" : testsLabel}
        </button>
        {local && !running && (
          <span className="text-xs font-semibold text-[#1C1D52]">
            {local.passed} of {local.total} passed · {local.score}%
          </span>
        )}
      </div>
      <p className="text-[11px] leading-4 text-slate-500">
        Each test starts your server with a fresh database, sends requests and checks the answers.
        {hiddenTests > 0 &&
          ` ${hiddenTests} more test${hiddenTests === 1 ? "" : "s"} you can't see run when you submit, so make your API work for any data, not only these examples.`}
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}
      <TestResultsList
        tests={tests}
        results={results ?? []}
        running={running}
      />
      {submission && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-[#1C1D52]">
            Last submission · {submission.result.score}% · {submission.result.passed} of{" "}
            {submission.result.total} passed
            <span className="ml-2 font-normal text-slate-400">{new Date(submission.at).toLocaleString()}</span>
          </p>
          <TestResultsList results={submission.result.tests} />
        </div>
      )}
    </div>
  );
}

/**
 * Test results, each opening to its steps. With `tests`, tests that haven't
 * run yet are listed too.
 */
export function TestResultsList({
  tests,
  results,
  running = false,
}: {
  tests?: ApiTest[];
  results: TestResult[];
  running?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = new Map(results.map((r) => [r.testId, r]));
  const rows: Array<{ id: string; label: string; points: number; result?: TestResult }> = tests
    ? tests.map((t) => ({ id: t.id, label: t.label, points: t.points, result: byId.get(t.id) }))
    : results.map((r) => ({ id: r.testId, label: r.label, points: r.points, result: r }));
  const firstPending = rows.findIndex((row) => !row.result);

  return (
    <ul className="space-y-1.5">
      {rows.map((row, index) => {
        const result = row.result;
        const expandable = Boolean(result && (result.steps.length || result.error || result.logs.length));
        return (
          <li key={row.id} className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => expandable && setOpen(open === row.id ? null : row.id)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs"
            >
              {!result ? (
                running && index === firstPending ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                )
              ) : result.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5FBB46]" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="flex-1">
                <span className="font-semibold text-[#1C1D52]">{row.label}</span>
                {row.points > 1 && <span className="ml-1 text-[10px] text-slate-400">· {row.points} points</span>}
                {result && !result.passed && result.hint && (
                  <span className="mt-0.5 block text-[11px] text-amber-700">Hint: {result.hint}</span>
                )}
              </span>
              {expandable &&
                (open === row.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                ))}
            </button>
            {open === row.id && result && <TestDetails result={result} />}
          </li>
        );
      })}
    </ul>
  );
}

function TestDetails({ result }: { result: TestResult }) {
  return (
    <div className="space-y-2 border-t border-slate-100 px-3 py-2">
      {result.error && (
        <p className="whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
          {result.error}
        </p>
      )}
      {result.steps.map((step, index) => (
        <StepDetails key={step.stepId + index} step={step} index={index} />
      ))}
      {result.logs.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer font-semibold text-slate-500">Server logs during this test</summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-[#101426] p-2 font-mono text-[10px] leading-4 text-white/80">
            {result.logs.map((line) => line.text).join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

function StepDetails({ step, index }: { step: StepResult; index: number }) {
  return (
    <div className={`rounded-lg p-2 text-[11px] ${step.skipped ? "bg-slate-50 text-slate-400" : "bg-[#f8fbff]"}`}>
      <p className="flex items-center gap-1.5 font-mono font-semibold text-[#1C1D52]">
        <span className="text-slate-400">{index + 1}.</span> {step.title}
        {step.response && (
          <span className={`ml-auto rounded-full px-2 py-0.5 font-bold ${statusTone(step.response.status)}`}>
            {step.response.status || "No response"}
          </span>
        )}
      </p>
      {step.skipped ? (
        <p className="mt-1">Skipped: an earlier step failed.</p>
      ) : (
        <>
          {step.request?.body && (
            <pre className="mt-1 max-h-32 overflow-auto font-mono text-[10px] text-slate-500">
              {pretty(step.request.body)}
            </pre>
          )}
          {step.error && <p className="mt-1 whitespace-pre-wrap text-red-700">{step.error}</p>}
          <ul className="mt-1 space-y-0.5">
            {step.checks.map((check, i) => (
              <li key={i} className="flex items-start gap-1.5">
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#5FBB46]" />
                ) : (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                )}
                <span className="font-mono">
                  {check.label}
                  {!check.passed && <span className="block text-red-600">got {check.actual}</span>}
                </span>
              </li>
            ))}
          </ul>
          {step.response && step.response.body && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-500">Response body</summary>
              <pre className="mt-1 max-h-48 overflow-auto font-mono text-[10px] text-slate-600">
                {pretty(step.response.body)}
              </pre>
            </details>
          )}
          {step.rows && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-500">Rows ({step.rows.length})</summary>
              <pre className="mt-1 max-h-48 overflow-auto font-mono text-[10px] text-slate-600">
                {JSON.stringify(step.rows, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ terminal

function TerminalPanel({ logs, onClear }: { logs: LogLine[]; onClear: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [logs]);
  return (
    <div className="h-40 overflow-y-auto rounded-xl bg-[#101426] p-3 font-mono text-[11px] leading-5">
      <p className="sticky top-0 mb-1 flex items-center gap-1 bg-[#101426] text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
        <Terminal className="h-3 w-3" /> Terminal
        <button type="button" onClick={onClear} className="ml-auto normal-case tracking-normal hover:text-white/70">
          Clear
        </button>
      </p>
      {logs.length === 0 ? (
        <p className="text-white/30">console.log output, requests and errors appear here.</p>
      ) : (
        logs.map((line, index) => (
          <p
            key={index}
            className={`whitespace-pre-wrap break-words ${
              line.level === "error"
                ? "text-red-300"
                : line.level === "warn"
                  ? "text-amber-200"
                  : line.level === "system"
                    ? "text-sky-300/70"
                    : "text-white/80"
            }`}
          >
            {line.level === "system" ? "› " : ""}
            {line.text}
          </p>
        ))
      )}
      <div ref={end} />
    </div>
  );
}

// ---------------------------------------------------------------------- help

function HelpPanel({ env }: { env: EnvVar[] }) {
  return (
    <div className="space-y-3 p-3 text-[11px] leading-5 text-slate-600">
      <Section title="How it works">
        Your code runs in a Node.js-style sandbox with Express 5 and a real SQLite database. The
        server restarts when you change the code (your data is kept); it starts with a fresh database
        when the SQL changes or you reset it. <code>server.js</code> must create the app with{" "}
        <code>express()</code>; <code>module.exports = app</code> and <code>app.listen()</code> are
        optional.
      </Section>
      <Section title="The database: require(&quot;./db&quot;)">
        <Code>{`// Promise style (like node-postgres): $1, $2 or ? placeholders
const { rows, rowCount } = await db.query(
  "SELECT * FROM books WHERE id = $1", [req.params.id]);

// Sync style (like better-sqlite3)
const book = db.prepare("SELECT * FROM books WHERE id = ?").get(id);
const { lastInsertRowid } = db.prepare("INSERT INTO ...").run(a, b);

// Shortcuts
await db.all(sql, params); await db.get(sql, params); await db.run(sql, params);`}</Code>
        Always pass user input as parameters, never by joining strings: the hidden tests try SQL
        injection. A duplicate value in a UNIQUE column throws an error with{" "}
        <code>err.code === &quot;SQLITE_CONSTRAINT_UNIQUE&quot;</code>. <code>RETURNING *</code>{" "}
        works on INSERT, UPDATE and DELETE.
      </Section>
      <Section title="Packages you can require">
        express, cors, morgan, helmet, body-parser, cookie-parser, bcrypt (or bcryptjs),
        jsonwebtoken, crypto, uuid, dotenv, path, util. There&apos;s no file system or network: keep
        data in the database. bcrypt here is a stand-in that works the same way but isn&apos;t real
        bcrypt.
      </Section>
      <Section title="Environment variables (process.env)">
        {env.length ? (
          <ul className="font-mono">
            {env.map((e) => (
              <li key={e.key}>
                {e.key}={e.value}
              </li>
            ))}
          </ul>
        ) : (
          "This exercise sets none (NODE_ENV and PORT are always there)."
        )}
      </Section>
      <Section title="Limits">
        A request may run for 2 seconds and use 64 MB of memory; longer and it&apos;s stopped. A
        query can return up to 2,000 rows. Errors you don&apos;t catch reach Express&apos;s error
        handler, async ones too (Express 5).
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-bold text-[#1C1D52]">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-[#101426] p-2.5 font-mono text-[10px] leading-4 text-white/85">
      {children}
    </pre>
  );
}
