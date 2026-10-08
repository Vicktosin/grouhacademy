import type {
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from "quickjs-emscripten-core";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import { PRELUDE } from "./prelude";
import {
  buildRequest,
  checkExpectation,
  ENTRY_FILE,
  LIMITS,
  readPath,
  responseSubject,
  scoreTests,
  show,
  sqlFiles,
  type ApiTest,
  type BackendConfig,
  type BackendFiles,
  type BackendResult,
  type EnvVar,
  type HttpRequest,
  type HttpResponse,
  type LogLine,
  type StepResult,
  type TestResult,
} from "./model";

// Runs an intern's Express API in a sandbox. Their JavaScript runs in
// QuickJS (a separate JavaScript engine compiled to WebAssembly): it can't
// reach this app, the network, files or environment, and it's stopped when
// it runs too long or uses too much memory. SQL runs in sql.js (SQLite in
// WebAssembly) with a size cap.
//
// SQLite can't be interrupted mid-query, so callers also run the engine on
// a thread they can kill: a Web Worker in the browser, a worker thread on
// the server (see ./browser-worker and ./server).
//
// Synchronous and independent of where it runs: give it the two WebAssembly
// modules.

export type EngineModules = { quickjs: QuickJSWASMModule; SQL: SqlJsStatic };

export const ENGINE_LIMITS = {
  memoryBytes: 64 * 1024 * 1024,
  stackBytes: 1024 * 1024,
  bootMs: 3000,
  requestMs: 2000,
  /** Timers and promise rounds per request (a runaway setInterval stops here). */
  maxTicks: 2000,
  maxRows: 2000,
  maxResponseChars: 1_000_000,
  maxLogLines: 400,
  maxLogChars: 4000,
  /** SQLite pages of 4 KB: about 16 MB of data. */
  maxDbPages: 4096,
};

export type SqlResult = { columns: string[]; rows: unknown[][] } | { error: string };
export type TableInfo = {
  name: string;
  columns: Array<{ name: string; type: string; pk: boolean; notNull: boolean }>;
  rowCount: number;
};

type SqlCallResult =
  | { columns: string[]; rows: Record<string, unknown>[]; changes: number; lastId: number | null }
  | { error: string; code: string };

class Timeout extends Error {}

function errorCode(message: string) {
  if (/UNIQUE constraint failed/i.test(message)) return "SQLITE_CONSTRAINT_UNIQUE";
  if (/NOT NULL constraint failed/i.test(message)) return "SQLITE_CONSTRAINT_NOTNULL";
  if (/FOREIGN KEY constraint failed/i.test(message)) return "SQLITE_CONSTRAINT_FOREIGNKEY";
  if (/CHECK constraint failed/i.test(message)) return "SQLITE_CONSTRAINT_CHECK";
  if (/constraint failed/i.test(message)) return "SQLITE_CONSTRAINT";
  if (/database or disk is full/i.test(message)) return "SQLITE_FULL";
  return "SQLITE_ERROR";
}

function cell(value: unknown) {
  return value instanceof Uint8Array ? `<${value.length} bytes>` : value;
}

/** A new database with the exercise's tables, then the intern's SQL files. */
export function createDatabase(
  SQL: SqlJsStatic,
  databaseSql: string,
  files: BackendFiles,
): { db: Database } | { db: null; error: string } {
  const db = new SQL.Database();
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA max_page_count = ${ENGINE_LIMITS.maxDbPages};`);
  try {
    if (databaseSql.trim()) db.exec(databaseSql);
  } catch (error) {
    db.close();
    return { db: null, error: `The exercise database couldn't be set up: ${String((error as Error).message ?? error)}` };
  }
  for (const name of sqlFiles(files)) {
    try {
      if (files[name].trim()) db.exec(files[name]);
    } catch (error) {
      db.close();
      return { db: null, error: `${name}: ${String((error as Error).message ?? error)}` };
    }
  }
  return { db };
}

/** One running server: the intern's code plus its database. */
export class BackendApp {
  private runtime: QuickJSRuntime | null = null;
  private context: QuickJSContext | null = null;
  private fns: Record<"dispatch" | "tick" | "result", QuickJSHandle> | null = null;
  private deadline = 0;
  private logs: LogLine[] = [];
  /** Set when the server can't take requests until restarted. */
  crashed: string | null = null;

  private constructor(
    private modules: EngineModules,
    readonly db: Database,
    private files: BackendFiles,
    private env: EnvVar[],
  ) {}

  /**
   * Starts a server. `setupSql` (a test's extra rows) runs after the
   * database is ready. Returns the app, or why it couldn't start.
   */
  static start(
    modules: EngineModules,
    options: { files: BackendFiles; databaseSql: string; env: EnvVar[]; setupSql?: string },
  ): { app: BackendApp; error?: undefined } | { app?: undefined; error: string; logs: LogLine[] } {
    const created = createDatabase(modules.SQL, options.databaseSql, options.files);
    if (!created.db) return { error: created.error, logs: [] };
    if (options.setupSql?.trim()) {
      try {
        created.db.exec(options.setupSql);
      } catch (error) {
        created.db.close();
        return {
          error: `This test's data couldn't be added (${String((error as Error).message ?? error)}). Check your tables match the exercise.`,
          logs: [],
        };
      }
    }
    const app = new BackendApp(modules, created.db, options.files, options.env);
    const bootError = app.boot();
    if (bootError) {
      const logs = app.takeLogs();
      app.dispose();
      return { error: bootError, logs };
    }
    return { app };
  }

  /** Loads new code, keeping the database (like a dev server restarting). */
  reload(files: BackendFiles): string | null {
    this.disposeVm();
    this.files = files;
    this.crashed = null;
    return this.boot();
  }

  private log(level: LogLine["level"], text: string) {
    if (this.logs.length >= ENGINE_LIMITS.maxLogLines) return;
    this.logs.push({
      level,
      text: text.length > ENGINE_LIMITS.maxLogChars ? `${text.slice(0, ENGINE_LIMITS.maxLogChars)}…` : text,
    });
    if (this.logs.length === ENGINE_LIMITS.maxLogLines)
      this.logs.push({ level: "system", text: "(more output was cut off)" });
  }

  takeLogs() {
    const logs = this.logs;
    this.logs = [];
    return logs;
  }

  private boot(): string | null {
    const runtime = this.modules.quickjs.newRuntime();
    runtime.setMemoryLimit(ENGINE_LIMITS.memoryBytes);
    runtime.setMaxStackSize(ENGINE_LIMITS.stackBytes);
    runtime.setInterruptHandler(() => Date.now() > this.deadline);
    const context = runtime.newContext();
    this.runtime = runtime;
    this.context = context;

    const hostObject = context.newObject();
    const sqlFn = context.newFunction("sql", (sqlHandle, paramsHandle) => {
      const sql = context.getString(sqlHandle);
      const params = JSON.parse(context.getString(paramsHandle)) as unknown;
      return context.newString(JSON.stringify(this.runSql(sql, params)));
    });
    const logFn = context.newFunction("log", (levelHandle, textHandle) => {
      const level = context.getString(levelHandle);
      this.log(
        level === "error" || level === "warn" || level === "info" ? level : "log",
        context.getString(textHandle),
      );
    });
    const loadFn = context.newFunction("load", (pathHandle) => {
      const path = context.getString(pathHandle);
      const source = this.files[path];
      if (typeof source !== "string")
        return { error: context.newError(`Cannot find module '${path}'`) };
      // Wrapped on the first line so error line numbers match the file.
      const result = context.evalCode(
        `(function (exports, require, module, __filename, __dirname) {${source}\n})`,
        path,
      );
      return result.error ? { error: result.error } : result.value;
    });
    context.setProp(hostObject, "sql", sqlFn);
    context.setProp(hostObject, "log", logFn);
    context.setProp(hostObject, "load", loadFn);
    context.setProp(context.global, "__host", hostObject);
    sqlFn.dispose();
    logFn.dispose();
    loadFn.dispose();
    hostObject.dispose();

    this.deadline = Date.now() + ENGINE_LIMITS.bootMs;
    const prelude = context.evalCode(PRELUDE, "prelude.js");
    if (prelude.error) {
      const message = this.describe(prelude.error);
      prelude.error.dispose();
      return `The simulator failed to start: ${message}`;
    }
    prelude.value.dispose();

    this.fns = {
      dispatch: context.getProp(context.global, "__dispatch"),
      tick: context.getProp(context.global, "__tick"),
      result: context.getProp(context.global, "__result"),
    };

    const boot = context.getProp(context.global, "__boot");
    const jsFiles = Object.keys(this.files).filter((name) => name.endsWith(".js"));
    const args = [
      context.newString(JSON.stringify(jsFiles)),
      context.newString(JSON.stringify(Object.fromEntries(this.env.map((e) => [e.key, e.value])))),
    ];
    let error: string | null = null;
    try {
      if (!jsFiles.includes(ENTRY_FILE)) error = "There is no server.js.";
      else {
        const result = context.callFunction(boot, context.undefined, ...args);
        if (result.error) {
          error = this.describe(result.error, true);
          result.error.dispose();
        } else {
          const message = context.getString(result.value);
          result.value.dispose();
          if (message) error = message;
        }
        // Let app.listen() callbacks and startup promises run.
        if (!error)
          try {
            this.settle(true);
          } catch (stopped) {
            error =
              (stopped as Error).message ||
              `Your server took longer than ${ENGINE_LIMITS.bootMs / 1000} seconds to start. Look for an endless loop.`;
          }
      }
    } finally {
      boot.dispose();
      args.forEach((handle) => handle.dispose());
    }
    if (error) this.log("error", error);
    return error;
  }

  /** "TypeError: x is not a function\n    at server.js:12" */
  private describe(handle: QuickJSHandle, startup = false): string {
    const context = this.context!;
    const dumped = context.dump(handle) as { name?: string; message?: string; stack?: string } | string;
    if (typeof dumped !== "object" || dumped === null) return String(dumped);
    if (dumped.name === "InternalError" && /interrupted/.test(dumped.message ?? ""))
      return startup
        ? `Your server took longer than ${ENGINE_LIMITS.bootMs / 1000} seconds to start. Look for an endless loop.`
        : `Your code ran for over ${ENGINE_LIMITS.requestMs / 1000} seconds and was stopped. Look for an endless loop.`;
    if (/out of memory/i.test(dumped.message ?? ""))
      return "Your code used too much memory and was stopped.";
    const stack = (dumped.stack ?? "")
      .split("\n")
      .filter((line) => line.trim() && !/prelude\.js/.test(line))
      .join("\n");
    return `${dumped.name ?? "Error"}: ${dumped.message ?? ""}${stack ? `\n${stack}` : ""}`;
  }

  /**
   * Runs promise jobs and timers until the response is ready or nothing is
   * left to run. At startup, only timers that are due straight away.
   */
  private settle(startup: boolean) {
    const runtime = this.runtime!;
    const context = this.context!;
    for (let tick = 0; tick < ENGINE_LIMITS.maxTicks; tick++) {
      if (Date.now() > this.deadline) throw new Timeout();
      const jobs = runtime.executePendingJobs();
      if (jobs.error) {
        const message = this.describe(jobs.error);
        jobs.error.dispose();
        if (/was stopped|too much memory/.test(message)) throw new Timeout(message);
        this.log("error", `Uncaught error: ${message}`);
      }
      const result = context.callFunction(
        this.fns!.tick,
        context.undefined,
        startup ? context.true : context.false,
      );
      if (result.error) {
        const message = this.describe(result.error);
        result.error.dispose();
        throw new Timeout(message);
      }
      const state = context.getNumber(result.value);
      result.value.dispose();
      if (state === 1) return;
      if (state === 0 && !runtime.hasPendingJob()) return;
    }
  }

  /** Sends one request to the server. */
  request(input: HttpRequest): HttpResponse {
    const started = Date.now();
    const fail = (error: string, status = 0): HttpResponse => ({
      status,
      headers: {},
      body: "",
      timeMs: Date.now() - started,
      error,
    });
    if (this.crashed || !this.context || !this.fns) return fail(this.crashed ?? "The server isn't running.");
    const context = this.context;
    this.deadline = started + ENGINE_LIMITS.requestMs;
    const arg = context.newString(
      JSON.stringify({
        method: input.method,
        path: input.path,
        headers: input.headers,
        body: input.body.slice(0, LIMITS.maxRequestBody),
      }),
    );
    try {
      const dispatched = context.callFunction(this.fns.dispatch, context.undefined, arg);
      if (dispatched.error) {
        const message = this.describe(dispatched.error);
        dispatched.error.dispose();
        throw new Timeout(message);
      }
      dispatched.value.dispose();
      this.settle(false);
      const result = context.callFunction(this.fns.result, context.undefined);
      if (result.error) {
        result.error.dispose();
        return fail("The response couldn't be read.");
      }
      const json = context.getString(result.value);
      result.value.dispose();
      if (!json)
        return fail(
          "No response: the request finished without one. Make sure every route ends with res.json(), res.send(), res.sendStatus() or res.end(), including in if/else branches and after errors.",
        );
      const response = JSON.parse(json) as Omit<HttpResponse, "timeMs">;
      if (response.body.length > ENGINE_LIMITS.maxResponseChars)
        response.body = `${response.body.slice(0, ENGINE_LIMITS.maxResponseChars)}…`;
      return { ...response, timeMs: Date.now() - started };
    } catch (error) {
      const message =
        error instanceof Timeout
          ? error.message ||
            `Your code ran for over ${ENGINE_LIMITS.requestMs / 1000} seconds and was stopped. Look for an endless loop or a promise that never settles.`
          : `The server crashed: ${String((error as Error).message ?? error)}`;
      this.log("error", message);
      if (/too much memory|crashed/.test(message)) this.crashed = message;
      return fail(message, 504);
    } finally {
      arg.dispose();
    }
  }

  /** The intern's db.query()/prepare() calls. */
  private runSql(sql: string, params: unknown): SqlCallResult {
    const db = this.db;
    try {
      if (params === null) {
        db.exec(sql);
        return { columns: [], rows: [], changes: 0, lastId: null };
      }
      const before = db.exec("SELECT total_changes()")[0].values[0][0] as number;
      let columns: string[] = [];
      let rows: Record<string, unknown>[] = [];
      let count = 0;
      const hasParams = Array.isArray(params) ? params.length > 0 : Object.keys(params as object).length > 0;
      for (const statement of db.iterateStatements(sql)) {
        if (++count > 1 && hasParams) {
          statement.free();
          return { error: "cannot insert multiple commands into a prepared statement", code: "SQLITE_ERROR" };
        }
        try {
          if (hasParams) statement.bind(bindable(sql, params));
          columns = statement.getColumnNames();
          rows = [];
          while (statement.step()) {
            if (rows.length >= ENGINE_LIMITS.maxRows)
              return {
                error: `The query returned more than ${ENGINE_LIMITS.maxRows} rows. Add a WHERE or LIMIT.`,
                code: "SQLITE_TOOBIG",
              };
            const row = statement.getAsObject();
            for (const key of Object.keys(row)) row[key] = cell(row[key]) as SqlValue;
            rows.push(row);
          }
        } finally {
          statement.free();
        }
      }
      const [changesNow, lastId] = db.exec("SELECT total_changes(), last_insert_rowid()")[0].values[0] as number[];
      const changes = changesNow - before;
      return { columns, rows, changes, lastId: changes > 0 ? lastId : null };
    } catch (error) {
      const message = String((error as Error).message ?? error);
      return { error: message, code: errorCode(message) };
    }
  }

  /** A query from the database panel. */
  query(sql: string): SqlResult {
    try {
      const results = this.db.exec(sql);
      const last = results[results.length - 1];
      if (!last) return { columns: [], rows: [] };
      return {
        columns: last.columns,
        rows: last.values.slice(0, 500).map((row) => row.map(cell)),
      };
    } catch (error) {
      return { error: String((error as Error).message ?? error) };
    }
  }

  tables(): TableInfo[] {
    const names = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )[0];
    return (names?.values ?? []).map(([name]) => {
      const quoted = `"${String(name).replace(/"/g, '""')}"`;
      const info = this.db.exec(`PRAGMA table_info(${quoted})`)[0];
      const count = this.db.exec(`SELECT COUNT(*) FROM ${quoted}`)[0];
      return {
        name: String(name),
        columns: (info?.values ?? []).map((row) => ({
          name: String(row[1]),
          type: String(row[2] || ""),
          notNull: row[3] === 1,
          pk: Number(row[5]) > 0,
        })),
        rowCount: Number(count?.values[0][0] ?? 0),
      };
    });
  }

  private disposeVm() {
    try {
      this.fns?.dispatch.dispose();
      this.fns?.tick.dispose();
      this.fns?.result.dispose();
      this.context?.dispose();
      this.runtime?.dispose();
    } catch {
      // A crashed runtime can fail to free; it's dropped either way.
    }
    this.fns = null;
    this.context = null;
    this.runtime = null;
  }

  dispose() {
    this.disposeVm();
    try {
      this.db.close();
    } catch {
      // Already closed.
    }
  }
}

/** Array params use ? or $1, $2…; object params match :name, @name or $name. */
function bindable(sql: string, params: unknown) {
  if (Array.isArray(params)) {
    if (/\$\d/.test(sql)) return Object.fromEntries(params.map((v, i) => [`$${i + 1}`, v]));
    return params as SqlValue[];
  }
  const out: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(params as Record<string, SqlValue>)) {
    if (/^[:@$]/.test(key)) out[key] = value;
    else for (const prefix of [":", "@", "$"]) out[`${prefix}${key}`] = value;
  }
  return out;
}

function trimResponse(response: HttpResponse): HttpResponse {
  return response.body.length > LIMITS.keptBody
    ? { ...response, body: `${response.body.slice(0, LIMITS.keptBody)}…` }
    : response;
}

/** Runs one test on a fresh server and database. */
export function runTest(
  modules: EngineModules,
  files: BackendFiles,
  config: Pick<BackendConfig, "databaseSql" | "env">,
  test: ApiTest,
): TestResult {
  const base = {
    testId: test.id,
    label: test.label,
    hidden: test.hidden,
    points: test.points,
    hint: test.hint,
  };
  const started = BackendApp.start(modules, {
    files,
    databaseSql: config.databaseSql,
    env: config.env,
    setupSql: test.setupSql,
  });
  if (!started.app)
    return { ...base, passed: false, error: started.error, steps: [], logs: started.logs.slice(-LIMITS.keptLogs) };
  const app = started.app;
  const vars: Record<string, string> = {};
  const steps: StepResult[] = [];
  let failed = false;
  let logs: LogLine[] = [];
  try {
    for (const step of test.steps) {
      const title =
        step.type === "request"
          ? `${step.method} ${step.path}`
          : `Database: ${step.sql.replace(/\s+/g, " ").trim().slice(0, 80)}`;
      if (failed) {
        steps.push({ stepId: step.id, title, passed: false, skipped: true, checks: [] });
        continue;
      }
      if (step.type === "sql") {
        const result = app.query(step.sql.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name: string) => vars[name] ?? m));
        if ("error" in result) {
          steps.push({ stepId: step.id, title, passed: false, skipped: false, error: result.error, checks: [] });
          failed = true;
          continue;
        }
        const rows = result.rows.map((row) => Object.fromEntries(result.columns.map((c, i) => [c, row[i]])));
        const checks = step.expect.map((e) => checkExpectation({ rows }, e));
        const passed = checks.every((c) => c.passed);
        steps.push({ stepId: step.id, title, passed, skipped: false, rows: rows.slice(0, LIMITS.keptRows), checks });
        failed = !passed;
        continue;
      }
      const request = buildRequest(step, vars);
      const response = app.request(request);
      const subject = responseSubject(response);
      const checks = step.expect.map((e) => checkExpectation(subject, e));
      for (const save of step.save) {
        const { found, value } = readPath(subject, save.path);
        if (found && value !== undefined && value !== null)
          vars[save.name] = typeof value === "string" ? value : show(value, 2000);
      }
      const passed = !response.error && checks.every((c) => c.passed);
      steps.push({
        stepId: step.id,
        title,
        passed,
        skipped: false,
        request,
        response: trimResponse(response),
        error: response.error,
        checks,
      });
      failed = !passed;
    }
  } finally {
    logs = app.takeLogs();
    app.dispose();
  }
  return {
    ...base,
    passed: !failed && steps.length > 0,
    steps,
    logs: logs.slice(-LIMITS.keptLogs),
  };
}

/** Runs tests one after another, each on its own fresh server. */
export function runTests(
  modules: EngineModules,
  files: BackendFiles,
  config: Pick<BackendConfig, "databaseSql" | "env">,
  tests: ApiTest[],
): BackendResult {
  return scoreTests(tests.map((test) => runTest(modules, files, config, test)));
}
