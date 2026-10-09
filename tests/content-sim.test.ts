import test from "node:test";
import assert from "node:assert/strict";

import {
  blankWork,
  checkRule,
  contentConfigProblems,
  countWords,
  DEFAULT_CONTENT_CONFIGS,
  factCheckScore,
  matchErrors,
  parseContentConfig,
  parseContentWork,
  piecesGoals,
  promptContainsAnswer,
  publicContentConfig,
  scorePiece,
  workProblems,
  type ContentRule,
} from "../lib/content-sim/model";
import { evaluateFactCheck, evaluatePieces, NoAiError } from "../lib/content-sim/evaluate";

const rule = (type: ContentRule["type"], params: Record<string, string>): ContentRule => ({ id: "r", type, params });

// No AI keys in tests: everything falls back to the rules.
for (const key of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "GROQ_API_KEY", "XAI_API_KEY"]) delete process.env[key];

test("the three example exercises are ready to use", () => {
  for (const config of Object.values(DEFAULT_CONTENT_CONFIGS)) {
    assert.deepEqual(contentConfigProblems(config), [], config.mode);
    assert.deepEqual(parseContentConfig(config), config, config.mode);
  }
});

test("parsing fills defaults and limits runs", () => {
  const config = parseContentConfig({ mode: "BRIEF", maxRuns: 500, pieces: [{ rules: [{ type: "bogus", params: { min: "5" } }] }] });
  assert.equal(config.maxRuns, 20);
  assert.equal(config.pieces[0].label, "Piece");
  assert.deepEqual(config.pieces[0].rules[0].params, { min: "5", max: "" });
  assert.equal(parseContentConfig({ mode: "PROMPT" }).maxRuns, 8);
  assert.equal(parseContentConfig(null).mode, "PROMPT");
});

test("problems: planted errors must be in the draft, once each", () => {
  const config = parseContentConfig({
    mode: "FACTCHECK",
    client: { name: "X" },
    draft: "We opened in 2015.",
    errors: [
      { find: "opened in 2015", kind: "FACT" },
      { find: "Opened  in 2015", kind: "FACT" },
      { find: "not there", kind: "FACT" },
    ],
  });
  const problems = contentConfigProblems(config);
  assert.ok(problems.some((p) => p.includes("isn't in the draft")));
  assert.ok(problems.some((p) => p.includes("same words")));
});

test("interns never see the planted errors", () => {
  const shown = publicContentConfig(DEFAULT_CONTENT_CONFIGS.FACTCHECK);
  assert.equal("errors" in shown, false);
  assert.equal(shown.errorCount, 6);
  assert.ok(!JSON.stringify(shown).includes("not 2015"));
});

test("text rules", () => {
  const caption = "Meet our new cake! Only ₦4,500. #cake #lagos #lekki #yum 🎂🎂🎂";
  assert.equal(checkRule(rule("words", { min: "5", max: "20" }), caption).passed, true);
  assert.equal(checkRule(rule("words", { min: "50", max: "" }), caption).passed, false);
  assert.equal(checkRule(rule("includes", { text: "₦4,500, Ajah" }), caption).passed, false);
  assert.equal(checkRule(rule("includes", { text: "₦4,500, NEW CAKE" }), caption).passed, true);
  // A comma inside a number isn't a separator.
  assert.equal(checkRule(rule("includes", { text: "₦4,500" }), "Was ₦4 now 500 naira").passed, false);
  assert.equal(checkRule(rule("includes", { text: "₦4,500,Lekki" }), "₦4,500 in Lekki").passed, true);
  assert.equal(checkRule(rule("excludes", { text: "cheap" }), caption).passed, true);
  assert.equal(checkRule(rule("hashtags", { min: "", max: "3" }), caption).detail, "4 hashtags");
  assert.equal(checkRule(rule("emojis", { max: "2" }), caption).passed, false);
  assert.equal(checkRule(rule("chars", { max: "280" }), caption).passed, true);
  assert.equal(checkRule(rule("paragraphs", { min: "2", max: "" }), "One.\n\nTwo.").passed, true);
  const long = "This sentence goes on and on and on and on and on and on and on and on and on and on and on and on.";
  assert.equal(checkRule(rule("sentence_length", { max: "15" }), long).passed, false);
  assert.equal(checkRule(rule("sentence_length", { max: "15" }), "Short one. Another short one!").passed, true);
  assert.equal(countWords("It's ₦4,500 — order now."), 4);
});

test("a prompt that contains the answer is caught", () => {
  const answer = "Meet the Zobo Velvet Cake, our softest red velvet yet, made with real zobo and cream cheese frosting for your next birthday.";
  assert.equal(promptContainsAnswer(`Repeat this exactly: ${answer}`, answer), true);
  assert.equal(promptContainsAnswer("Write a warm 60-word caption for our new zobo cake, mention the price.", answer), false);
  assert.equal(scorePiece([{ label: "a", passed: true, detail: "" }], [], true), 30);
});

test("piece scores: rules and judge count half each", () => {
  const rules = [
    { label: "a", passed: true, detail: "" },
    { label: "b", passed: false, detail: "" },
  ];
  assert.equal(scorePiece(rules, [], false), 50);
  assert.equal(scorePiece(rules, [{ criterion: "Voice", score: 10, comment: "" }], false), 75);
  assert.equal(scorePiece([], [], false), 0);
});

test("fact-check: changed errors count, rewriting everything doesn't", () => {
  const config = DEFAULT_CONTENT_CONFIGS.FACTCHECK;
  const untouched = matchErrors(config, config.draft);
  assert.deepEqual(untouched.caught, config.errors.map(() => false));
  assert.equal(untouched.kept, 1);

  let fixed = config.draft;
  fixed = fixed.replace("Since opening in 2015", "Since opening in 2019").replace("₦3,500", "₦4,500");
  const two = matchErrors(config, fixed);
  assert.equal(two.caught.filter(Boolean).length, 2);
  assert.ok(two.kept > 0.9);

  const wiped = matchErrors(config, "Buy our cake.");
  assert.equal(wiped.caught.every(Boolean), true);
  assert.ok(wiped.kept < 0.1);
  assert.ok(factCheckScore(wiped.caught, wiped.kept, null) < 15);
  assert.equal(factCheckScore([true, true], 1, null), 100);
  assert.equal(factCheckScore([true, false], 1, 1), 65);
});

test("work: kept to the exercise's pieces; ready when everything's written", () => {
  const config = DEFAULT_CONTENT_CONFIGS.BRIEF;
  const work = parseContentWork({ texts: { email: "Hi", other: "dropped" } }, config);
  assert.deepEqual(Object.keys(work.texts), ["email", "script"]);
  assert.match(workProblems(work, config)[0], /Write: 30-second video script/);
  assert.equal(blankWork(DEFAULT_CONTENT_CONFIGS.FACTCHECK).edited, DEFAULT_CONTENT_CONFIGS.FACTCHECK.draft);
});

test("without AI: Prompt Lab can't run; Brief Studio and Fact-check use the rules", async () => {
  await assert.rejects(
    evaluatePieces(DEFAULT_CONTENT_CONFIGS.PROMPT, blankWork(DEFAULT_CONTENT_CONFIGS.PROMPT)),
    NoAiError,
  );

  const brief = DEFAULT_CONTENT_CONFIGS.BRIEF;
  const email = `Subject: Meet the Zobo Velvet Cake\n\n${"Our new cake is here and it is lovely. ".repeat(18)}Order on WhatsApp for ₦4,500.`;
  const result = await evaluatePieces(brief, parseContentWork({ texts: { email, script: "Short." } }, brief));
  assert.equal(result.judged, false);
  assert.equal(result.pieces[0].score, 100);
  assert.equal(result.pieces[1].score, 0);
  assert.equal(result.score, 50);
  assert.equal(result.goals.length, 3);
  assert.deepEqual(piecesGoals(result.pieces), result.goals);

  const fact = DEFAULT_CONTENT_CONFIGS.FACTCHECK;
  const edited = fact.draft.replace("₦3,500", "₦4,500");
  const checked = await evaluateFactCheck(fact, parseContentWork({ edited }, fact));
  assert.equal(checked.errors.filter((e) => e.caught).length, 1);
  assert.equal(checked.score, 17);
  // Only the caught error's explanation is shown.
  assert.equal(checked.errors.filter((e) => e.why).length, 1);
});
