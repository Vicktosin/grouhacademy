// Backend API simulator (pure; safe in the browser).
//
// An intern builds a small Node.js + Express API backed by a real SQLite
// database. Their code runs in a sandbox (QuickJS, see ./engine) with
// timeouts and memory limits, never in this app's own process: in their
// browser while they work, and in a throwaway worker thread on the server
// when they submit (./server).
//
// An exercise has a database (tables and sample rows), optional environment
// variables, and API tests: each test starts from a fresh database, sends
// requests (or queries the database) and checks the responses. Visible
// tests can be run any time; hidden tests only run on submit, so code can't
// be tailored to the visible ones.

export type BackendFiles = Record<string, string>;
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ExpectOp =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "exists"
  | "absent"
  | "type"
  | "gt"
  | "lt"
  | "matches";

export type Expectation = { path: string; op: ExpectOp; value: string };
export type SavedValue = { name: string; path: string };
export type TestStep =
  | {
      id: string;
      type: "request";
      method: HttpMethod;
      /** Path and query, e.g. /api/books?inStock=true */
      path: string;
      /** One "Name: value" per line. */
      headers: string;
      body: string;
      expect: Expectation[];
      /** Values kept for later steps as {{name}}, e.g. a new id or token. */
      save: SavedValue[];
    }
  | { id: string; type: "sql"; sql: string; expect: Expectation[] };

export type ApiTest = {
  id: string;
  label: string;
  /** Hidden tests only run on submit; interns see pass/fail and the hint. */
  hidden: boolean;
  points: number;
  /** Shown to the intern when a hidden test fails. */
  hint: string;
  /** Extra rows for this test, run after the exercise database is set up. */
  setupSql: string;
  steps: TestStep[];
};

export type EnvVar = { key: string; value: string };

export type BackendConfig = {
  /** Creates the tables and sample rows; every server and test starts here. */
  databaseSql: string;
  env: EnvVar[];
  tests: ApiTest[];
};

export type HttpRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
};
export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  timeMs: number;
  /** Set when there was no response: a timeout, a crash, or no res.send(). */
  error?: string;
};
export type LogLine = { level: "log" | "info" | "warn" | "error" | "system"; text: string };

export type CheckResult = { label: string; passed: boolean; actual: string };
export type StepResult = {
  stepId: string;
  title: string;
  passed: boolean;
  skipped: boolean;
  request?: HttpRequest;
  response?: HttpResponse;
  rows?: unknown[];
  error?: string;
  checks: CheckResult[];
};
export type TestResult = {
  testId: string;
  label: string;
  hidden: boolean;
  points: number;
  passed: boolean;
  hint: string;
  /** Why the test couldn't run (server didn't start, bad schema…). */
  error?: string;
  steps: StepResult[];
  logs: LogLine[];
};
export type BackendResult = {
  /** Percentage of test points earned. */
  score: number;
  passed: number;
  total: number;
  tests: TestResult[];
};

export const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const ENTRY_FILE = "server.js";
export const SCHEMA_FILE = "schema.sql";

export const EXPECT_OPS: Record<ExpectOp, { label: string; needsValue: boolean }> = {
  equals: { label: "equals", needsValue: true },
  notEquals: { label: "does not equal", needsValue: true },
  contains: { label: "contains", needsValue: true },
  notContains: { label: "does not contain", needsValue: true },
  exists: { label: "exists", needsValue: false },
  absent: { label: "is missing", needsValue: false },
  type: { label: "is of type", needsValue: true },
  gt: { label: "is more than", needsValue: true },
  lt: { label: "is less than", needsValue: true },
  matches: { label: "matches pattern", needsValue: true },
};

export const LIMITS = {
  maxFiles: 12,
  maxFileChars: 60_000,
  maxTotalChars: 200_000,
  maxTests: 40,
  maxSteps: 12,
  maxExpect: 12,
  maxRequestBody: 100_000,
  /** Response bodies kept in results, per step. */
  keptBody: 3_000,
  keptRows: 20,
  keptLogs: 60,
};

const FILE_NAME = /^(?:[a-zA-Z0-9_-]+\/){0,2}[a-zA-Z0-9_.-]+\.(?:js|sql)$/;
const VAR_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/;
const ENV_KEY = /^[A-Z_][A-Z0-9_]{0,59}$/;

// ---------------------------------------------------------------------------
// Parsing (everything from the browser or the database goes through here)
// ---------------------------------------------------------------------------

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.slice(0, max) : "";
const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const array = (value: unknown) => (Array.isArray(value) ? value : []);
const object = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function isValidFileName(name: string) {
  return FILE_NAME.test(name) && !name.split("/").some((part) => part.startsWith("."));
}

/** The intern's files: valid names only, server.js always present, size-capped. */
export function parseBackendFiles(value: unknown, fallback?: BackendFiles): BackendFiles {
  const source = object(value);
  const out: BackendFiles = {};
  let total = 0;
  for (const [name, contents] of Object.entries(source)) {
    if (Object.keys(out).length >= LIMITS.maxFiles) break;
    if (!isValidFileName(name) || typeof contents !== "string") continue;
    const kept = contents.slice(0, LIMITS.maxFileChars);
    if (total + kept.length > LIMITS.maxTotalChars) break;
    total += kept.length;
    out[name] = kept;
  }
  if (typeof out[ENTRY_FILE] !== "string")
    out[ENTRY_FILE] = fallback?.[ENTRY_FILE] ?? DEFAULT_STARTER[ENTRY_FILE];
  return out;
}

/** Files in tab order: server.js, other .js, then .sql. */
export function sortedFileNames(files: BackendFiles) {
  return Object.keys(files).sort((a, b) => {
    const rank = (name: string) =>
      name === ENTRY_FILE ? 0 : name.endsWith(".js") ? 1 : name === SCHEMA_FILE ? 2 : 3;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}

/** SQL files the intern wrote, in the order they run (schema.sql first). */
export function sqlFiles(files: BackendFiles) {
  return sortedFileNames(files).filter((name) => name.endsWith(".sql"));
}

function parseExpectations(value: unknown): Expectation[] {
  return array(value)
    .slice(0, LIMITS.maxExpect)
    .map((item) => {
      const raw = object(item);
      return {
        path: text(raw.path, 200).trim() || "status",
        op: oneOf(raw.op, Object.keys(EXPECT_OPS) as ExpectOp[], "equals"),
        value: text(raw.value, 2000),
      };
    });
}

function parseStep(value: unknown): TestStep {
  const raw = object(value);
  const id = text(raw.id, 20) || newId();
  if (raw.type === "sql")
    return { id, type: "sql", sql: text(raw.sql, 5000), expect: parseExpectations(raw.expect) };
  return {
    id,
    type: "request",
    method: oneOf(raw.method, METHODS, "GET"),
    path: text(raw.path, 500).trim() || "/",
    headers: text(raw.headers, 2000),
    body: text(raw.body, LIMITS.maxRequestBody),
    expect: parseExpectations(raw.expect),
    save: array(raw.save)
      .slice(0, 6)
      .map((item) => {
        const s = object(item);
        return { name: text(s.name, 40).trim(), path: text(s.path, 200).trim() };
      })
      .filter((s) => VAR_NAME.test(s.name) && s.path),
  };
}

export function parseTest(value: unknown): ApiTest {
  const raw = object(value);
  return {
    id: text(raw.id, 20) || newId(),
    label: text(raw.label, 160).trim() || "Untitled test",
    hidden: raw.hidden === true,
    points: clampInt(raw.points, 1, 10, 1),
    hint: text(raw.hint, 300).trim(),
    setupSql: text(raw.setupSql, 20_000),
    steps: array(raw.steps).slice(0, LIMITS.maxSteps).map(parseStep),
  };
}

export function parseBackendConfig(value: unknown): BackendConfig {
  const raw = object(value);
  if (!value || typeof value !== "object") return DEFAULT_BACKEND_CONFIG;
  const seen = new Set<string>();
  return {
    databaseSql: text(raw.databaseSql, 100_000),
    env: array(raw.env)
      .slice(0, 20)
      .map((item) => {
        const e = object(item);
        return { key: text(e.key, 60).trim(), value: text(e.value, 500) };
      })
      .filter((e) => ENV_KEY.test(e.key) && !seen.has(e.key) && seen.add(e.key)),
    tests: array(raw.tests).slice(0, LIMITS.maxTests).map(parseTest),
  };
}

/** What a saved exercise must have; empty when it's ready. */
export function configProblems(config: BackendConfig) {
  const problems: string[] = [];
  if (config.tests.filter((t) => !t.hidden).length < 1)
    problems.push("Add at least one test interns can see.");
  config.tests.forEach((test, index) => {
    const name = `Test ${index + 1} (“${test.label}”)`;
    if (!test.steps.length) problems.push(`${name} has no steps.`);
    test.steps.forEach((step, n) => {
      if (!step.expect.length) problems.push(`${name}, step ${n + 1} checks nothing.`);
      if (step.type === "request" && !step.path.startsWith("/"))
        problems.push(`${name}, step ${n + 1}: the path must start with /.`);
      if (step.type === "sql" && !step.sql.trim())
        problems.push(`${name}, step ${n + 1} has no SQL.`);
    });
  });
  return problems;
}

/** What an intern may see: hidden tests are reduced to a count. */
export function publicBackendConfig(config: BackendConfig) {
  return {
    databaseSql: config.databaseSql,
    env: config.env,
    tests: config.tests.filter((test) => !test.hidden),
    hiddenTests: config.tests.filter((test) => test.hidden).length,
  };
}
export type PublicBackendConfig = ReturnType<typeof publicBackendConfig>;

// ---------------------------------------------------------------------------
// Requests and checks
// ---------------------------------------------------------------------------

/** Replaces {{name}} with saved values; {{random}} gives a fresh string. */
export function fillTemplate(value: string, vars: Record<string, string>) {
  return value.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, name: string) =>
    name === "random"
      ? Math.random().toString(36).slice(2, 8)
      : Object.prototype.hasOwnProperty.call(vars, name)
        ? vars[name]
        : match,
  );
}

/** "Name: value" lines to a header map (lower-case names). */
export function parseHeaderLines(lines: string) {
  const headers: Record<string, string> = {};
  for (const line of lines.split("\n")) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const name = line.slice(0, index).trim().toLowerCase();
    if (/^[a-z0-9-]+$/.test(name)) headers[name] = line.slice(index + 1).trim();
  }
  return headers;
}

/** A request ready to send: JSON content type added when there's a body. */
export function buildRequest(
  step: { method: string; path: string; headers: string; body: string },
  vars: Record<string, string> = {},
): HttpRequest {
  const headers = parseHeaderLines(fillTemplate(step.headers, vars));
  const body = fillTemplate(step.body, vars).slice(0, LIMITS.maxRequestBody);
  if (body.trim() && !headers["content-type"]) headers["content-type"] = "application/json";
  let path = fillTemplate(step.path, vars).trim() || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  // Spaces and other characters a browser would encode.
  path = path.replace(/[\s"<>`]/g, (c) => encodeURIComponent(c));
  return { method: step.method.toUpperCase(), path, headers, body };
}

/** The JSON body, or the text when it isn't JSON. */
export function parseBody(body: string): unknown {
  if (!body) return "";
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function tokens(path: string) {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Reads a path like body.items[0].name or headers.content-type. */
export function readPath(subject: unknown, path: string): { found: boolean; value: unknown } {
  let current: unknown = subject;
  for (const token of tokens(path)) {
    if (token === "length" && (Array.isArray(current) || typeof current === "string")) {
      current = current.length;
      continue;
    }
    if (current === null || typeof current !== "object") return { found: false, value: undefined };
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, token)) return { found: false, value: undefined };
    current = record[token];
  }
  return { found: true, value: current };
}

/** The expected value: JSON when it parses (201, true, {"a":1}), else text. */
export function expectedValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // 5 and "5" are the same to a reader of a check.
  if ((typeof a === "number" && typeof b === "string") || (typeof a === "string" && typeof b === "number"))
    return String(a) === String(b);
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return false;
}

/** Whether `actual` includes everything in `want` (objects: matching keys). */
function includes(actual: unknown, want: unknown): boolean {
  if (typeof actual === "string") return actual.toLowerCase().includes(String(want).toLowerCase());
  if (Array.isArray(actual)) return actual.some((item) => deepEqual(item, want) || matchesSubset(item, want));
  return matchesSubset(actual, want);
}
function matchesSubset(actual: unknown, want: unknown): boolean {
  if (!want || typeof want !== "object" || Array.isArray(want)) return deepEqual(actual, want);
  if (!actual || typeof actual !== "object") return false;
  return Object.entries(want as Record<string, unknown>).every(([key, value]) =>
    matchesSubset((actual as Record<string, unknown>)[key], value),
  );
}

function typeName(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function show(value: unknown, max = 120) {
  if (value === undefined) return "(missing)";
  const out = typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) ?? String(value);
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

export function describeExpectation(e: Expectation) {
  const op = EXPECT_OPS[e.op];
  return `${e.path} ${op.label}${op.needsValue ? ` ${e.value.trim()}` : ""}`;
}

export function checkExpectation(subject: unknown, expectation: Expectation): CheckResult {
  const { found, value } = readPath(subject, expectation.path);
  const want = expectedValue(expectation.value);
  let passed: boolean;
  switch (expectation.op) {
    case "equals":
      passed = found && deepEqual(value, want);
      break;
    case "notEquals":
      passed = !deepEqual(value, want);
      break;
    case "contains":
      passed = found && includes(value, want);
      break;
    case "notContains":
      passed = !found || !includes(value, want);
      break;
    case "exists":
      passed = found && value !== undefined && value !== null && value !== "";
      break;
    case "absent":
      passed = !found || value === undefined || value === null;
      break;
    case "type":
      passed = found && typeName(value) === String(want).toLowerCase();
      break;
    case "gt":
      passed = found && value !== null && value !== "" && Number(value) > Number(want);
      break;
    case "lt":
      passed = found && value !== null && value !== "" && Number(value) < Number(want);
      break;
    case "matches":
      try {
        passed = found && new RegExp(expectation.value.trim()).test(typeof value === "string" ? value : JSON.stringify(value));
      } catch {
        passed = false;
      }
      break;
  }
  return { label: describeExpectation(expectation), passed, actual: show(value) };
}

/** What a check's path can read after a request. */
export function responseSubject(response: HttpResponse) {
  return {
    status: response.status,
    headers: response.headers,
    body: parseBody(response.body),
    text: response.body,
    time: response.timeMs,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function scoreTests(tests: TestResult[]): BackendResult {
  const maxPoints = tests.reduce((sum, t) => sum + t.points, 0);
  const earned = tests.filter((t) => t.passed).reduce((sum, t) => sum + t.points, 0);
  return {
    score: maxPoints ? Math.round((earned / maxPoints) * 100) : 0,
    passed: tests.filter((t) => t.passed).length,
    total: tests.length,
    tests,
  };
}

/** A result safe to show an intern: hidden tests keep only pass/fail and the hint. */
export function publicBackendResult(result: BackendResult): BackendResult {
  let hidden = 0;
  return {
    ...result,
    tests: result.tests.map((test) =>
      test.hidden
        ? {
            testId: `hidden-${++hidden}`,
            label: `Hidden test ${hidden}`,
            hidden: true,
            points: test.points,
            passed: test.passed,
            hint: test.passed ? "" : test.hint,
            steps: [],
            logs: [],
          }
        : test,
    ),
  };
}

/** A result small enough to keep on the attempt: shorter bodies and logs. */
export function compactBackendResult(result: BackendResult): BackendResult {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  return {
    ...result,
    tests: result.tests.map((test) => ({
      ...test,
      logs: test.logs.slice(-15).map((line) => ({ ...line, text: clip(line.text, 500) })),
      steps: test.steps.map((step) => ({
        ...step,
        rows: step.rows?.slice(0, 5),
        response: step.response && { ...step.response, body: clip(step.response.body, 800) },
        request: step.request && { ...step.request, body: clip(step.request.body, 800) },
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Example exercise (what a new exercise starts from)
// ---------------------------------------------------------------------------

const req = (
  method: HttpMethod,
  path: string,
  expect: Array<[string, ExpectOp, string?]>,
  extra: { body?: unknown; headers?: string; save?: SavedValue[] } = {},
): TestStep => ({
  id: newId(),
  type: "request",
  method,
  path,
  headers: extra.headers ?? "",
  body: extra.body === undefined ? "" : JSON.stringify(extra.body, null, 2),
  expect: expect.map(([path, op, value]) => ({ path, op, value: value ?? "" })),
  save: extra.save ?? [],
});

const test = (
  label: string,
  steps: TestStep[],
  extra: Partial<Pick<ApiTest, "hidden" | "points" | "hint" | "setupSql">> = {},
): ApiTest => ({
  id: newId(),
  label,
  hidden: false,
  points: 1,
  hint: "",
  setupSql: "",
  steps,
  ...extra,
});

export const DEFAULT_DATABASE_SQL = `-- The bookshop's database. Every server start and every test begins here.
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0), -- in naira
  stock INTEGER NOT NULL DEFAULT 0
);

INSERT INTO books (title, author, price, stock) VALUES
  ('Things Fall Apart', 'Chinua Achebe', 4500, 12),
  ('Purple Hibiscus', 'Chimamanda Ngozi Adichie', 5200, 7),
  ('The Joys of Motherhood', 'Buchi Emecheta', 3800, 0);
`;

export const DEFAULT_STARTER: BackendFiles = {
  [ENTRY_FILE]: `const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

// List every book.
app.get("/api/books", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM books ORDER BY id");
  res.json(rows);
});

// TODO: GET /api/books/:id
// TODO: POST /api/books
// TODO: DELETE /api/books/:id

app.listen(3000, () => console.log("Bookshop API running on port 3000"));
module.exports = app;
`,
};

export const DEFAULT_SOLUTION: BackendFiles = {
  [ENTRY_FILE]: `const express = require("express");
const db = require("./db");

const app = express();
app.use(express.json());

app.get("/api/books", async (req, res) => {
  const inStock = req.query.inStock === "true";
  const { rows } = await db.query(
    inStock
      ? "SELECT * FROM books WHERE stock > 0 ORDER BY id"
      : "SELECT * FROM books ORDER BY id",
  );
  res.json(rows);
});

app.get("/api/books/:id", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM books WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Book not found" });
  res.json(rows[0]);
});

app.post("/api/books", async (req, res) => {
  const { title, author, price, stock = 0 } = req.body ?? {};
  if (typeof title !== "string" || !title.trim())
    return res.status(400).json({ error: "title is required" });
  if (typeof author !== "string" || !author.trim())
    return res.status(400).json({ error: "author is required" });
  if (!Number.isInteger(price) || price < 0)
    return res.status(400).json({ error: "price must be a whole number of naira, 0 or more" });
  if (!Number.isInteger(stock) || stock < 0)
    return res.status(400).json({ error: "stock must be a whole number, 0 or more" });

  const { rows } = await db.query(
    "INSERT INTO books (title, author, price, stock) VALUES ($1, $2, $3, $4) RETURNING *",
    [title.trim(), author.trim(), price, stock],
  );
  res.status(201).json(rows[0]);
});

app.delete("/api/books/:id", async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM books WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Book not found" });
  res.status(204).end();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

app.listen(3000, () => console.log("Bookshop API running on port 3000"));
module.exports = app;
`,
};

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  databaseSql: DEFAULT_DATABASE_SQL,
  env: [],
  tests: [
    test("Lists every book", [
      req("GET", "/api/books", [
        ["status", "equals", "200"],
        ["body", "type", "array"],
        ["body.length", "equals", "3"],
        ["body[0].title", "equals", "Things Fall Apart"],
      ]),
    ]),
    test("Lists only books in stock with ?inStock=true", [
      req("GET", "/api/books?inStock=true", [
        ["status", "equals", "200"],
        ["body.length", "equals", "2"],
        ["body", "notContains", '{"title": "The Joys of Motherhood"}'],
      ]),
    ]),
    test("Gets one book by id", [
      req("GET", "/api/books/2", [
        ["status", "equals", "200"],
        ["body.title", "equals", "Purple Hibiscus"],
        ["body.price", "equals", "5200"],
      ]),
    ]),
    test("A book that doesn't exist gives 404 with an error message", [
      req("GET", "/api/books/999", [
        ["status", "equals", "404"],
        ["body.error", "exists"],
      ]),
    ]),
    test("Creates a book and returns it with 201", [
      req(
        "POST",
        "/api/books",
        [
          ["status", "equals", "201"],
          ["body.id", "exists"],
          ["body.title", "equals", "Americanah"],
        ],
        {
          body: { title: "Americanah", author: "Chimamanda Ngozi Adichie", price: 6500, stock: 4 },
          save: [{ name: "bookId", path: "body.id" }],
        },
      ),
      req("GET", "/api/books/{{bookId}}", [
        ["status", "equals", "200"],
        ["body.author", "equals", "Chimamanda Ngozi Adichie"],
      ]),
    ]),
    test("Rejects a book without a title with 400", [
      req(
        "POST",
        "/api/books",
        [
          ["status", "equals", "400"],
          ["body.error", "exists"],
        ],
        { body: { author: "Wole Soyinka", price: 3000 } },
      ),
    ]),
    test(
      "Rejects a negative price and saves nothing",
      [
        req("POST", "/api/books", [["status", "equals", "400"]], {
          body: { title: "Bad price", author: "Someone", price: -100 },
        }),
        {
          id: newId(),
          type: "sql",
          sql: "SELECT COUNT(*) AS count FROM books",
          expect: [{ path: "rows[0].count", op: "equals", value: "3" }],
        },
      ],
      { hidden: true, hint: "Check the price is a whole number of 0 or more before saving." },
    ),
    test(
      "Deletes a book",
      [
        req("DELETE", "/api/books/1", [["status", "equals", "204"]]),
        req("GET", "/api/books/1", [["status", "equals", "404"]]),
        req("DELETE", "/api/books/1", [["status", "equals", "404"]]),
      ],
      { hidden: true, hint: "DELETE should answer 204 with no body, and 404 if the book is already gone." },
    ),
    test(
      "Reads from the database, not hard-coded data",
      [
        req("GET", "/api/books", [["body.length", "equals", "4"]]),
        req("GET", "/api/books/4", [["body.title", "equals", "Half of a Yellow Sun"]]),
      ],
      {
        hidden: true,
        hint: "Your routes should read the books from the database each time.",
        setupSql:
          "INSERT INTO books (title, author, price, stock) VALUES ('Half of a Yellow Sun', 'Chimamanda Ngozi Adichie', 6000, 3);",
      },
    ),
    test(
      "Safe from SQL injection",
      [
        req("GET", "/api/books/1", [["status", "equals", "200"]]),
        req("GET", "/api/books/1 OR 1=1", [["status", "equals", "404"]]),
        req("DELETE", "/api/books/1 OR 1=1", [["status", "equals", "404"]]),
        {
          id: newId(),
          type: "sql",
          sql: "SELECT COUNT(*) AS count FROM books",
          expect: [{ path: "rows[0].count", op: "equals", value: "3" }],
        },
      ],
      {
        hidden: true,
        points: 2,
        hint: "Never build SQL by joining strings with user input: pass values as parameters ($1, $2…).",
      },
    ),
  ],
};
