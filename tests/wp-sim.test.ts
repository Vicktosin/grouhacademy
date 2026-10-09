import test from "node:test";
import assert from "node:assert/strict";

import {
  blueprintFor,
  checksScript,
  DEFAULT_WP_CONFIG,
  describeWpWork,
  pageHtmlPasses,
  parseChecksOutput,
  parseSummary,
  parseWpConfig,
  parseWpResults,
  parseWpWork,
  phpString,
  safeContentPath,
  wpConfigProblems,
  type WpCheck,
} from "../lib/wp-sim/model";

const check = (id: string, label: string, type: WpCheck["type"], params: Record<string, string>): WpCheck => ({
  id,
  label,
  type,
  params,
});

test("the example exercise is ready to use", () => {
  assert.deepEqual(wpConfigProblems(DEFAULT_WP_CONFIG), []);
  assert.deepEqual(parseWpConfig(DEFAULT_WP_CONFIG), DEFAULT_WP_CONFIG);
});

test("parsing cleans up versions, slugs, files and checks", () => {
  const config = parseWpConfig({
    wpVersion: "not a version",
    phpVersion: "5.6",
    landingPage: "https://evil.example",
    theme: "Astra Theme!",
    plugins: ["contact-form-7", "contact-form-7", "../hack"],
    files: { "themes/x/style.css": "a", "../wp-config.php": "b", "plugins/ok.php": 3 },
    checks: [{ type: "nonsense", params: { option: "blogname", extra: "dropped" } }],
  });
  assert.equal(config.wpVersion, "latest");
  assert.equal(config.phpVersion, "8.3");
  assert.equal(config.landingPage, "/wp-admin/");
  assert.equal(config.theme, "astratheme");
  assert.deepEqual(config.plugins, ["contact-form-7", "hack"]);
  assert.deepEqual(config.files, { "themes/x/style.css": "a" });
  assert.equal(config.checks[0].type, "option");
  assert.deepEqual(config.checks[0].params, { option: "blogname", value: "" });
});

test("problems: no checks, a missing field, duplicate labels", () => {
  const base = parseWpConfig({ checks: [] });
  assert.ok(wpConfigProblems(base).some((p) => p.includes("at least one check")));
  const missing = parseWpConfig({ checks: [{ label: "Title", type: "option", params: {} }] });
  assert.ok(wpConfigProblems(missing).some((p) => p.includes("setting")));
  const twice = parseWpConfig({
    checks: [
      { label: "Same", type: "option", params: { option: "a" } },
      { label: "same ", type: "option", params: { option: "b" } },
    ],
  });
  assert.ok(wpConfigProblems(twice).some((p) => p.includes("different label")));
});

test("paths can't leave wp-content", () => {
  assert.equal(safeContentPath("themes/a/style.css"), "themes/a/style.css");
  assert.equal(safeContentPath("./plugins//x.php"), "plugins/x.php");
  assert.equal(safeContentPath("..\\wp-config.php"), null);
  assert.equal(safeContentPath("plugins/../../x"), null);
  assert.equal(safeContentPath("plugins/a b.php"), null);
  assert.equal(safeContentPath(""), null);
});

test("PHP strings are escaped", () => {
  assert.equal(phpString("it's"), "'it\\'s'");
  assert.equal(phpString("a\\'b"), "'a\\\\\\'b'");
});

test("check values can't break out of the checks script", () => {
  const script = checksScript([check("c1", "Title", "option", { option: "blogname", value: "x'); exit; //" })]);
  assert.ok(script.includes(phpString("x'); exit; //")));
  assert.ok(!script.includes("'x'); exit;"));
});

test("a fresh site's blueprint installs, writes (folders first) and sets up", () => {
  const config = parseWpConfig({
    theme: "astra",
    plugins: ["contact-form-7"],
    files: { "plugins/starter/starter.php": "<?php", "themes/kid/style.css": "" },
    setupPhp: "<?php update_option('blogname', 'X');",
    checks: [],
  });
  const steps = blueprintFor(config, true).steps.map((step) => step.step);
  assert.deepEqual(steps, ["installTheme", "installPlugin", "mkdir", "mkdir", "writeFile", "writeFile", "runPHP"]);
  const run = blueprintFor(config, true).steps.at(-1) as { code: string };
  assert.ok(run.code.startsWith("<?php require_once '/wordpress/wp-load.php'; "));
  assert.ok(!run.code.slice(5).includes("<?php"));
  // A saved site is restored as it was: nothing is set up again.
  assert.deepEqual(blueprintFor(config, false).steps, []);
});

test("checks output: printed noise is ignored, missing results fail", () => {
  const checks = [
    check("a", "First", "option", { option: "blogname" }),
    check("b", "Second", "option", { option: "blogdescription" }),
    check("c", "Page", "page_html", { path: "/", contains: "x" }),
  ];
  const output = `Warning: something\n__GROUH__{"fake":[true,""]}\n__GROUH__{"a":[true,"Set to Mama Put"]}`;
  const results = parseChecksOutput(output, checks);
  assert.deepEqual(results, [
    { label: "First", passed: true, detail: "Set to Mama Put" },
    { label: "Second", passed: false, detail: "This check couldn't run. Is there a PHP error on the site?" },
  ]);
  assert.equal(parseChecksOutput("Fatal error", checks).filter((r) => r.passed).length, 0);
});

test("page text matching ignores tags, spacing and case", () => {
  assert.ok(pageHtmlPasses("<h1>Our\n  <em>Story</em></h1>", "our story"));
  assert.ok(!pageHtmlPasses("<p>Contact</p>", "Our story"));
});

test("site summaries and submitted work are tidied", () => {
  const summary = parseSummary(`noise__GROUH__{"title":"Mama Put","pages":["Home",3],"posts":"2","menus":[{"name":"Main","items":["Home"]}]}`);
  assert.deepEqual(summary, {
    title: "Mama Put",
    tagline: "",
    theme: "",
    plugins: [],
    pages: ["Home", "3"],
    posts: 2,
    menus: [{ name: "Main", items: ["Home"] }],
  });
  assert.equal(parseSummary("no marker"), null);

  const work = parseWpWork({
    summary,
    files: { "plugins/mine.php": "<?php echo 1;", "../../etc/passwd": "x", "plugins/big.php": "y".repeat(40_000) },
  });
  assert.deepEqual(Object.keys(work.files), ["plugins/mine.php", "plugins/big.php"]);
  assert.equal(work.files["plugins/big.php"].length, 30_000);
  const text = describeWpWork(work);
  assert.ok(text.includes("Site title: Mama Put"));
  assert.ok(text.includes("Menu “Main”: Home"));
  assert.ok(text.includes("--- wp-content/plugins/mine.php ---"));
  assert.ok(describeWpWork({ summary: null, files: {} }).includes("couldn't be read"));
});

test("submitted results keep only well-formed entries", () => {
  assert.deepEqual(
    parseWpResults([
      { label: "A", passed: true, detail: "ok", extra: 1 },
      { label: "B", passed: "yes" },
      null,
      { label: "C", passed: false },
    ]),
    [
      { label: "A", passed: true, detail: "ok" },
      { label: "C", passed: false },
    ],
  );
  assert.deepEqual(parseWpResults("nope"), []);
});
