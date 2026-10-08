import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import { BackendApp, runTests, type EngineModules } from "../lib/backend-sim/engine";
import { loadNodeModules } from "../lib/backend-sim/node-modules";
import { runBackendTestsIsolated } from "../lib/backend-sim/server";
import {
  checkExpectation,
  DEFAULT_BACKEND_CONFIG as config,
  DEFAULT_SOLUTION,
  DEFAULT_STARTER,
  parseBackendConfig,
  parseBackendFiles,
  publicBackendConfig,
  publicBackendResult,
  type BackendFiles,
} from "../lib/backend-sim/model";

let modules: EngineModules;
test.before(async () => {
  modules = await loadNodeModules();
});

const json = { "content-type": "application/json" };

function start(server: string, extra: BackendFiles = {}, env = config.env) {
  const started = BackendApp.start(modules, {
    files: { "server.js": server, ...extra },
    databaseSql: config.databaseSql,
    env,
  });
  if (!started.app) throw new Error(started.error);
  return started.app;
}

const get = (app: BackendApp, path: string, headers: Record<string, string> = {}) =>
  app.request({ method: "GET", path, headers, body: "" });

test("the model answer passes every test and the starter doesn't", () => {
  const solved = runTests(modules, DEFAULT_SOLUTION, config, config.tests);
  assert.equal(solved.score, 100, JSON.stringify(solved.tests.filter((t) => !t.passed), null, 2));
  const starter = runTests(modules, DEFAULT_STARTER, config, config.tests);
  assert.ok(starter.score < 30);
});

test("SQL built by joining strings fails the hidden injection test", () => {
  const vulnerable = {
    "server.js": DEFAULT_SOLUTION["server.js"].replace(
      '"SELECT * FROM books WHERE id = $1", [req.params.id]',
      '"SELECT * FROM books WHERE id = " + req.params.id',
    ),
  };
  const result = runTests(modules, vulnerable, config, config.tests);
  const injection = result.tests.find((t) => t.label === "Safe from SQL injection")!;
  assert.equal(injection.passed, false);
  assert.ok(result.tests.filter((t) => t.label !== "Safe from SQL injection").every((t) => t.passed));
});

test("hidden tests are reduced to pass/fail for interns", () => {
  const result = publicBackendResult(runTests(modules, DEFAULT_STARTER, config, config.tests));
  const hidden = result.tests.filter((t) => t.hidden);
  assert.ok(hidden.length > 0);
  for (const t of hidden) {
    assert.match(t.label, /^Hidden test \d+$/);
    assert.deepEqual(t.steps, []);
    assert.deepEqual(t.logs, []);
  }
  const shown = publicBackendConfig(config);
  assert.ok(shown.tests.every((t) => !t.hidden));
  assert.equal(shown.hiddenTests, config.tests.filter((t) => t.hidden).length);
});

test("routers, params, query strings and middleware behave like Express", () => {
  const app = start(`
const express = require("express");
const app = express();
const users = express.Router({ mergeParams: true });
users.get("/:id", (req, res) => res.json({ org: req.params.org, id: req.params.id, q: req.query }));
app.use((req, res, next) => { res.set("X-Trace", "1"); next(); });
app.use("/orgs/:org/users", users);
app.route("/ping").get((req, res) => res.send("pong")).post((req, res) => res.status(201).end());
app.listen(3000);
`);
  const r = get(app, "/orgs/acme/users/7?tag=a&tag=b&name=Ada+L");
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), { org: "acme", id: "7", q: { tag: ["a", "b"], name: "Ada L" } });
  assert.equal(r.headers["x-trace"], "1");
  assert.equal(get(app, "/ping").body, "pong");
  assert.equal(app.request({ method: "POST", path: "/ping", headers: {}, body: "" }).status, 201);
  const missing = get(app, "/nope");
  assert.equal(missing.status, 404);
  assert.match(missing.body, /Cannot GET \/nope/);
  app.dispose();
});

test("async errors reach the error handler (Express 5)", () => {
  const app = start(`
const express = require("express");
const app = express();
app.get("/boom", async () => { throw new Error("kaboom"); });
app.get("/sync", () => { null.x; });
app.use((err, req, res, next) => res.status(500).json({ message: err.message }));
module.exports = app;
`);
  assert.deepEqual(JSON.parse(get(app, "/boom").body), { message: "kaboom" });
  assert.equal(get(app, "/sync").status, 500);
  app.dispose();
});

test("bad JSON is a 400 from express.json()", () => {
  const app = start(`
const express = require("express");
const app = express();
app.use(express.json());
app.post("/echo", (req, res) => res.json(req.body));
module.exports = app;
`);
  const bad = app.request({ method: "POST", path: "/echo", headers: json, body: "{nope" });
  assert.equal(bad.status, 400);
  const good = app.request({ method: "POST", path: "/echo", headers: json, body: '{"a":[1,2]}' });
  assert.deepEqual(JSON.parse(good.body), { a: [1, 2] });
  app.dispose();
});

test("an endless loop is stopped and the server keeps working", () => {
  const app = start(`
const express = require("express");
const app = express();
app.get("/spin", () => { while (true) {} });
app.get("/caught", () => { try { while (true) {} } catch (e) {} });
app.get("/ok", (req, res) => res.json({ ok: true }));
module.exports = app;
`);
  const spin = get(app, "/spin");
  assert.equal(spin.status, 504);
  assert.match(spin.error ?? "", /stopped/);
  assert.equal(get(app, "/caught").status, 504);
  assert.equal(get(app, "/ok").status, 200);
  app.dispose();
});

test("a server that never starts is reported", () => {
  const loop = BackendApp.start(modules, {
    files: { "server.js": "while (true) {}" },
    databaseSql: "",
    env: [],
  });
  assert.match(loop.error ?? "", /longer than/);
  const syntax = BackendApp.start(modules, {
    files: { "server.js": "const x = ;" },
    databaseSql: "",
    env: [],
  });
  assert.match(syntax.error ?? "", /SyntaxError/);
  const noApp = BackendApp.start(modules, { files: { "server.js": "1" }, databaseSql: "", env: [] });
  assert.match(noApp.error ?? "", /must create an Express app/);
});

test("using too much memory stops the code, not the host", () => {
  const app = start(`
const express = require("express");
const app = express();
app.get("/hog", (req, res) => { const a = []; while (true) a.push("x".repeat(10000)); });
module.exports = app;
`);
  const hog = get(app, "/hog");
  assert.equal(hog.status, 504);
  assert.match(hog.error ?? "", /memory|stopped/);
  app.dispose();
});

test("a route that never responds says why", () => {
  const app = start(`
const express = require("express");
const app = express();
app.get("/forgot", (req, res) => { const x = 1; });
module.exports = app;
`);
  const r = get(app, "/forgot");
  assert.equal(r.status, 0);
  assert.match(r.error ?? "", /No response/);
  app.dispose();
});

test("timers, multiple files, env and the built-in packages work", () => {
  const app = start(
    `
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { randomUUID } = require("crypto");
const { slow } = require("./lib/util");
const app = express();
app.use(express.json());
app.get("/later", async (req, res) => res.json({ value: await slow(5) }));
app.get("/token", (req, res) => res.json({ token: jwt.sign({ sub: "u1" }, process.env.JWT_SECRET, { expiresIn: "1h" }) }));
app.get("/me", (req, res) => {
  try {
    const payload = jwt.verify((req.get("authorization") || "").replace("Bearer ", ""), process.env.JWT_SECRET);
    res.json({ sub: payload.sub });
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.get("/hash", async (req, res) => {
  const hash = await bcrypt.hash("secret", 10);
  res.json({ ok: await bcrypt.compare("secret", hash), wrong: bcrypt.compareSync("nope", hash), len: hash.length, id: randomUUID().length });
});
module.exports = app;
`,
    { "lib/util.js": "exports.slow = (n) => new Promise((r) => setTimeout(() => r(n * 2), 1000));" },
    [{ key: "JWT_SECRET", value: "test-secret" }],
  );
  assert.deepEqual(JSON.parse(get(app, "/later").body), { value: 10 });
  const { token } = JSON.parse(get(app, "/token").body);
  // Real HS256: Node's crypto signs the same token.
  const [head, body, sig] = token.split(".");
  assert.equal(createHash("sha256").update("x").digest("hex").length, 64);
  const expected = createHmac("sha256", "test-secret").update(`${head}.${body}`).digest("base64url");
  assert.equal(sig, expected);
  assert.deepEqual(JSON.parse(get(app, "/me", { authorization: `Bearer ${token}` }).body), { sub: "u1" });
  assert.equal(get(app, "/me", { authorization: "Bearer bad.token.here" }).status, 401);
  assert.deepEqual(JSON.parse(get(app, "/hash").body), { ok: true, wrong: false, len: 60, id: 36 });
  app.dispose();
});

test("no access to the host: fs, network and real globals are unavailable", () => {
  const app = start(`
const express = require("express");
const app = express();
app.get("/probe", (req, res) => {
  const out = {};
  for (const name of ["fs", "child_process", "http", "net"]) {
    try { require(name); out[name] = "loaded"; } catch (e) { out[name] = "blocked"; }
  }
  out.fetch = typeof fetch;
  out.env = Object.keys(process.env).sort();
  res.json(out);
});
module.exports = app;
`);
  const r = JSON.parse(get(app, "/probe").body);
  assert.deepEqual(r, {
    fs: "blocked",
    child_process: "blocked",
    http: "blocked",
    net: "blocked",
    fetch: "undefined",
    env: ["NODE_ENV", "PORT"],
  });
  app.dispose();
});

test("database: unique errors carry a code, oversized results are refused", () => {
  const app = start(
    `
const express = require("express");
const db = require("./db");
const app = express();
app.get("/dup", async (req, res) => {
  await db.query("INSERT INTO tags (name) VALUES (?)", ["a"]);
  try { await db.query("INSERT INTO tags (name) VALUES (?)", ["a"]); res.json({ code: null }); }
  catch (e) { res.status(409).json({ code: e.code }); }
});
app.get("/sync", (req, res) => res.json(db.prepare("SELECT name FROM tags WHERE name = :name").get({ name: "a" })));
app.get("/many", async (req, res) => {
  try {
    await db.query("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n LIMIT 5000) SELECT x FROM n");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = app;
`,
    { "schema.sql": "CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT UNIQUE);" },
  );
  assert.deepEqual(JSON.parse(get(app, "/dup").body), { code: "SQLITE_CONSTRAINT_UNIQUE" });
  assert.deepEqual(JSON.parse(get(app, "/sync").body), { name: "a" });
  assert.match(JSON.parse(get(app, "/many").body).error, /more than/);
  assert.ok(app.tables().some((t) => t.name === "tags" && t.rowCount === 1));
  app.dispose();
});

test("reloading code keeps the database", () => {
  const app = start(`
const express = require("express"); const db = require("./db");
const app = express();
app.post("/add", async (req, res) => { await db.query("INSERT INTO books (title, author, price) VALUES ('X', 'Y', 1)"); res.sendStatus(201); });
module.exports = app;`);
  assert.equal(app.request({ method: "POST", path: "/add", headers: {}, body: "" }).status, 201);
  assert.equal(app.reload({ "server.js": "const app = require('express')(); module.exports = app;" }), null);
  assert.equal(app.tables().find((t) => t.name === "books")?.rowCount, 4);
  app.dispose();
});

test("checks read paths, compare loosely and handle contains", () => {
  const subject = { status: 201, body: { items: [{ id: 1, name: "Ada" }], total: "3" } };
  const ok = (path: string, op: Parameters<typeof checkExpectation>[1]["op"], value = "") =>
    checkExpectation(subject, { path, op, value }).passed;
  assert.ok(ok("status", "equals", "201"));
  assert.ok(ok("body.items[0].name", "equals", "Ada"));
  assert.ok(ok("body.items.length", "equals", "1"));
  assert.ok(ok("body.total", "equals", "3"));
  assert.ok(ok("body.items", "contains", '{"name": "Ada"}'));
  assert.ok(ok("body.missing", "absent"));
  assert.ok(!ok("body.missing", "exists"));
  assert.ok(ok("body.items", "type", "array"));
  assert.ok(ok("status", "lt", "300"));
});

test("parsing drops bad file names and keeps server.js", () => {
  const files = parseBackendFiles({ "server.js": "x", "../evil.js": "y", "routes/books.js": "z", "a.txt": "q" });
  assert.deepEqual(Object.keys(files).sort(), ["routes/books.js", "server.js"]);
  assert.ok(parseBackendFiles({})["server.js"].length > 0);
  const parsed = parseBackendConfig({ env: [{ key: "lower", value: "x" }, { key: "OK_KEY", value: "1" }], tests: [{}] });
  assert.deepEqual(parsed.env, [{ key: "OK_KEY", value: "1" }]);
  assert.equal(parsed.tests[0].points, 1);
});

test("the browser copies of the WebAssembly files match the installed packages", () => {
  const sqlVersion = JSON.parse(readFileSync("node_modules/sql.js/package.json", "utf8")).version;
  const quickjsVersion = JSON.parse(
    readFileSync("node_modules/@jitl/quickjs-wasmfile-release-sync/package.json", "utf8"),
  ).version;
  // Browsers cache the files for a year by this version (in their URLs).
  assert.match(
    readFileSync("lib/backend-sim/browser-worker.ts", "utf8"),
    new RegExp(`RUNTIME_VERSION = "sqljs-${sqlVersion}_quickjs-${quickjsVersion}"`),
    "Update RUNTIME_VERSION in lib/backend-sim/browser-worker.ts",
  );
  const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
  assert.equal(
    hash("public/lab-runtime/sql-wasm.wasm"),
    hash("node_modules/sql.js/dist/sql-wasm.wasm"),
    "Run: npm run lab-runtime",
  );
  assert.equal(
    hash("public/lab-runtime/quickjs.wasm"),
    hash("node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm"),
    "Run: npm run lab-runtime",
  );
});

test("the server runner stops a query that never ends and keeps earlier results", { timeout: 60_000 }, async () => {
  const hang = {
    "server.js": `
const express = require("express"); const db = require("./db");
const app = express();
app.get("/hang", async (req, res) => {
  await db.query("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT COUNT(*) FROM n");
  res.json({});
});
app.get("/api/books", (req, res) => res.json([]));
module.exports = app;`,
  };
  const tests = [
    { ...config.tests[0], id: "ok", steps: [{ ...config.tests[0].steps[0], expect: [{ path: "status", op: "equals" as const, value: "200" }] }] },
    { ...config.tests[0], id: "hang", steps: [{ ...config.tests[0].steps[0], path: "/hang" }] },
    { ...config.tests[0], id: "after" },
  ];
  const started = Date.now();
  const result = await runBackendTestsIsolated(hang, config, tests);
  assert.ok(Date.now() - started < 30_000);
  assert.equal(result.tests[0].passed, true);
  assert.match(result.tests[1].error ?? "", /stopped/);
  assert.match(result.tests[2].error ?? "", /Not run/);
});

test("the lab preview's self-hosted React matches the installed version", async () => {
  const { REACT_VERSION } = await import("../app/lab-preview/route");
  const installed = JSON.parse(readFileSync("node_modules/react/package.json", "utf8")).version;
  assert.equal(REACT_VERSION, installed, "Download that React version into public/lab-runtime (see app/lab-preview/route.ts)");
  for (const file of ["react.mjs", "jsx-runtime.mjs", "react-dom.mjs", "react-dom-client.mjs"]) {
    const code = readFileSync(`public/lab-runtime/react-${REACT_VERSION}/${file}`, "utf8");
    assert.ok(code.includes(`react`) && !/from\s*"https?:/.test(code), `${file} must not load code from another site`);
  }
});
