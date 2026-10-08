import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_AUTOMATION_CONFIG as config,
  expectedFrom,
  parseWorkflow,
  publicAutomationConfig,
  publicResult,
  scoreWorkflow,
  workflowProblems,
  type AiLabels,
  type Workflow,
} from "../lib/automation-sim/model";
import { aiLabelsFor } from "../lib/automation-sim/evaluate";

// What the AI step decides for each sample record in the example exercise.
const topics: Record<string, string> = {
  r1: "Complaint",
  r2: "Sales enquiry",
  r3: "Sales enquiry",
  r4: "Question",
  r5: "Complaint",
  h1: "Sales enquiry",
  h2: "Complaint",
  h3: "Question",
};
const labels: AiLabels = { ai1: topics };
const expected = expectedFrom(config.solution, config, labels);

test("the model workflow does what the brief says", () => {
  assert.deepEqual(
    expected.r1.map((e) => [e.action, e.target]),
    [["CHAT", "#support"], ["EMAIL", "chiamaka.obi@example.com"]],
  );
  assert.deepEqual(expected.r1[0].mentions.map((m) => m.field), ["Name", "Message"]);
  assert.deepEqual(expected.r2.map((e) => [e.action, e.target]), [["CRM", "Hot lead"], ["CHAT", "#sales"]]);
  assert.deepEqual(expected.r3.map((e) => [e.action, e.target]), [["CRM", "New lead"]]);
  // Exactly ₦100,000 counts as "₦100,000 or more".
  assert.deepEqual(expected.h1.map((e) => e.target), ["Hot lead", "#sales"]);
  assert.deepEqual(expected.h3.map((e) => e.action), ["EMAIL"]);
});

test("the model workflow passes every record", () => {
  const result = scoreWorkflow(config.solution, config, expected, labels);
  assert.equal(result.score, 100);
  assert.equal(result.passed, config.records.length);
});

test("a different trigger never runs", () => {
  const wrong: Workflow = { ...config.solution, trigger: "EMAIL" };
  const result = scoreWorkflow(wrong, config, expected, labels);
  assert.equal(result.triggerOk, false);
  assert.equal(result.score, 0);
});

test("missing details, extra actions and missing actions fail a record", () => {
  // Alerts everyone in #sales, without the order value.
  const sloppy = parseWorkflow({
    trigger: "FORM",
    steps: [
      { id: "x1", type: "ACTION", action: "CHAT", target: "#sales", text: "New message from {{name}}" },
    ],
  });
  const result = scoreWorkflow(sloppy, config, expected, {});
  const r2 = result.outcomes.find((o) => o.recordId === "r2")!;
  assert.equal(r2.passed, false);
  assert.ok(r2.problems.some((p) => p.startsWith("Missing: Added to CRM stage “Hot lead”")));
  assert.ok(r2.problems.some((p) => p.includes("should include the order value (₦)")));
  const r4 = result.outcomes.find((o) => o.recordId === "r4")!;
  assert.ok(r4.problems.some((p) => p.startsWith("Shouldn't happen: Team chat message in #sales")));
});

test("checks a workflow before running it", () => {
  assert.deepEqual(workflowProblems({ trigger: "", steps: [] }, config), [
    "Choose a trigger: what starts the workflow?",
    "Add at least one step after the trigger.",
  ]);
  const bad = parseWorkflow({
    trigger: "FORM",
    steps: [
      { type: "AI", input: "{{message}}", categories: "Only one", output: "name" },
      { type: "ACTION", action: "CHAT", target: "#random", text: "hi" },
    ],
  });
  const problems = workflowProblems(bad, config);
  assert.ok(problems.some((p) => p.includes("at least 2 categories")));
  assert.ok(problems.some((p) => p.includes("“name” is already used")));
  assert.ok(problems.some((p) => p.includes("choose one of the listed options")));
  assert.deepEqual(workflowProblems(config.solution, config), []);
});

test("interns never see hidden records, the model workflow or the right trigger", () => {
  const shown = publicAutomationConfig({ ...config, expected });
  assert.equal(shown.samples.length, 5);
  assert.equal(shown.hiddenCount, 3);
  assert.equal(JSON.stringify(shown).includes("Ibrahim Musa"), false);
  assert.equal("solution" in shown || "trigger" in shown, false);

  const result = publicResult(scoreWorkflow(config.solution, config, expected, labels));
  const hidden = result.outcomes.filter((o) => o.hidden);
  assert.equal(hidden.length, 3);
  assert.equal(JSON.stringify(hidden).includes("Ibrahim"), false);
  assert.deepEqual(hidden.map((o) => o.label), ["Hidden test 1", "Hidden test 2", "Hidden test 3"]);
});

test("without an API key, the AI step falls back to keyword rules", async () => {
  const keys = ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "XAI_API_KEY"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  try {
    const result = await aiLabelsFor(config.solution, config.records);
    assert.equal(result.ai1.r1, "Complaint");
    assert.equal(result.ai1.r2, "Sales enquiry");
    assert.equal(result.ai1.h2, "Complaint");
    assert.equal(result.ai1.h3, "Other");
  } finally {
    for (const key of keys) if (saved[key] !== undefined) process.env[key] = saved[key];
  }
});
