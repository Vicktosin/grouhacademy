import assert from "node:assert/strict";
import test from "node:test";

import {
  AchievementDefinitionInputSchema,
  accomplishmentLine,
  meetsConditions,
  renderAchievementText,
} from "@/lib/achievements-shared";

test("titles fill in the intern's track and level", () => {
  assert.equal(renderAchievementText("Wizard of {track}", { track: "Digital Marketing" }), "Wizard of Digital Marketing");
  assert.equal(renderAchievementText("{level} Level Unlocked", { level: "Advanced" }), "Advanced Level Unlocked");
  assert.equal(renderAchievementText("Inbox Ninja", { track: "AI Automation" }), "Inbox Ninja");
  // Never shows a raw placeholder.
  assert.equal(renderAchievementText("Legend of {track}", {}), "Legend of Tech");
});

test("score conditions need a score at or above the minimum", () => {
  assert.equal(meetsConditions({ minPercent: 90 }, { scorePercent: 95 }), true);
  assert.equal(meetsConditions({ minPercent: 90 }, { scorePercent: 89 }), false);
  assert.equal(meetsConditions({ minPercent: 90 }, { scorePercent: null }), false);
  assert.equal(meetsConditions({ minScore: 85 }, { scorePercent: 85 }), true);
  assert.equal(meetsConditions({}, { scorePercent: null }), true);
});

test("Office Life step rules match the step kind", () => {
  const emailGuru = { stepKind: "email" as const, minScore: 90 };
  assert.equal(meetsConditions(emailGuru, { stepKind: "email", scorePercent: 92 }), true);
  assert.equal(meetsConditions(emailGuru, { stepKind: "meeting", scorePercent: 92 }), false);
  assert.equal(meetsConditions(emailGuru, { stepKind: "email", scorePercent: 70 }), false);
  assert.equal(meetsConditions({}, { stepKind: "report", scorePercent: 10 }), true);
});

test("task count, week and title conditions", () => {
  assert.equal(meetsConditions({ minCount: 5 }, { taskCount: 5 }), true);
  assert.equal(meetsConditions({ minCount: 5 }, { taskCount: 4 }), false);
  assert.equal(meetsConditions({ weekNumber: 2 }, { weekNumber: 3 }), false);
  assert.equal(meetsConditions({ taskTitleContains: "meta ads" }, { taskTitle: "Launch a Meta Ads campaign" }), true);
  assert.equal(meetsConditions({ taskTitleContains: "seo" }, { taskTitle: "Launch a Meta Ads campaign" }), false);
});

test("admins can only save conditions that fit the trigger", () => {
  const base = {
    title: "Email Guru",
    description: "Wrote a great email.",
    congratulatoryMessage: "Nice!",
    category: "Professional Practice",
    programId: null,
    levelId: null,
    isRepeatable: false,
    rarity: "RARE",
    icon: "mail",
    isActive: true,
  };
  assert.equal(
    AchievementDefinitionInputSchema.safeParse({ ...base, trigger: "OFFICE_LIFE_STEP", conditions: { stepKind: "email", minScore: 90 } }).success,
    true,
  );
  assert.equal(
    AchievementDefinitionInputSchema.safeParse({ ...base, trigger: "OFFICE_LIFE_STEP", conditions: { stepKind: "dance" } }).success,
    false,
  );
  assert.equal(
    AchievementDefinitionInputSchema.safeParse({ ...base, trigger: "LEVEL_UP", conditions: { minScore: 50 } }).success,
    false,
  );
});

test("the card line says what they did", () => {
  assert.equal(accomplishmentLine({ taskTitle: "Meta Ads Campaign", scorePercent: 100 }), "Meta Ads Campaign · 100%");
  assert.equal(accomplishmentLine({ taskTitle: "Brief", score: 18, maxScore: 20 }), "Brief · 18/20");
  assert.equal(accomplishmentLine({ taskTitle: "Clocked in" }), "Clocked in");
});
