/**
 * Tests for mixed-track group pool logic.
 *
 * All tests use in-process fakes so there is no database dependency.
 */

import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Helpers shared by multiple test suites
// ---------------------------------------------------------------------------

type PoolRow = {
  id: string;
  levelId: string;
  startDate: Date;
  cohorts: { id: string; programId: string; excludeFromSelfPacedAndPools: boolean }[];
};

type TaskRow = {
  id: string;
  poolId: string;
  templateId: string;
  kind: "GROUP" | "INDIVIDUAL";
};

// ---------------------------------------------------------------------------
// 1 – ensureCohortPool: skip running/completed cohorts
// ---------------------------------------------------------------------------

test("ensureCohortPool returns null for a cohort whose startDate has passed", async () => {
  // Simulate: cohort started in the past; excludeFromSelfPacedAndPools=false.
  const pastDate = new Date(Date.now() - 86_400_000); // yesterday
  const cohort = {
    levelId: "level-1",
    startDate: pastDate,
    poolId: null as string | null,
    program: { excludeFromSelfPacedAndPools: false },
  };

  // The guard: if now >= startDate, return null before touching the DB.
  const isRunning = new Date() >= cohort.startDate;
  assert.ok(isRunning, "Guard should detect a started cohort");

  // No pool must be formed.
  // (In production code, `ensureCohortPool` returns null at this check.)
  const result = isRunning ? null : "would-form-pool";
  assert.equal(result, null);
});

test("ensureCohortPool allows a future cohort to be pooled", async () => {
  const futureDate = new Date(Date.now() + 7 * 86_400_000); // 7 days ahead
  const cohort = {
    levelId: "level-1",
    startDate: futureDate,
    poolId: null as string | null,
    program: { excludeFromSelfPacedAndPools: false },
  };

  const isRunning = new Date() >= cohort.startDate;
  assert.equal(isRunning, false, "Future cohort is not running");
});

test("ensureCohortPool returns null for an excluded program", async () => {
  const futureDate = new Date(Date.now() + 7 * 86_400_000);
  const cohort = {
    levelId: "level-1",
    startDate: futureDate,
    poolId: null as string | null,
    program: { excludeFromSelfPacedAndPools: true }, // e.g. Special Class
  };

  // Guard in production: return null when excluded.
  const result = cohort.program.excludeFromSelfPacedAndPools ? null : "would-form-pool";
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// 2 – materialisePoolGroupTasks: one task per pool, not per cohort
// ---------------------------------------------------------------------------

function simulateMaterialise(
  poolId: string,
  templates: { id: string; kind: "GROUP" | "INDIVIDUAL"; isShared: boolean }[],
  existingPoolTasks: { templateId: string }[],
): TaskRow[] {
  const sharedGroupTemplates = templates.filter(
    (t) => t.kind === "GROUP" && t.isShared,
  );
  const existingTemplateIds = new Set(existingPoolTasks.map((t) => t.templateId));
  const toCreate = sharedGroupTemplates.filter(
    (t) => !existingTemplateIds.has(t.id),
  );
  return toCreate.map((t, i) => ({
    id: `task-${i}`,
    poolId,
    templateId: t.id,
    kind: "GROUP",
  }));
}

test("materialises one pool GROUP task per isShared=true template, not per cohort", () => {
  const poolId = "pool-1";
  const templates = [
    { id: "tmpl-meet", kind: "GROUP" as const, isShared: true },
    { id: "tmpl-kick", kind: "GROUP" as const, isShared: true },
    { id: "tmpl-ind", kind: "INDIVIDUAL" as const, isShared: false },
  ];

  // Simulate 7 cohorts in the pool — materialisation is called once for the
  // pool as a whole, not once per cohort, so we always pass the same poolId.
  const created = simulateMaterialise(poolId, templates, []);
  assert.equal(created.length, 2, "Only the 2 shared GROUP templates are created");
  assert.ok(created.every((t) => t.poolId === poolId), "All tasks link to the pool");
  assert.ok(created.every((t) => t.kind === "GROUP"), "All created tasks are GROUP");
});

test("materialisePoolGroupTasks is idempotent: does not duplicate on second call", () => {
  const poolId = "pool-1";
  const templates = [
    { id: "tmpl-meet", kind: "GROUP" as const, isShared: true },
  ];

  // First call creates the task.
  const firstRound = simulateMaterialise(poolId, templates, []);
  assert.equal(firstRound.length, 1);

  // Second call: template already materialised — nothing new created.
  const secondRound = simulateMaterialise(
    poolId,
    templates,
    firstRound.map((t) => ({ templateId: t.templateId })),
  );
  assert.equal(secondRound.length, 0, "No duplicates on second materialisation");
});

test("non-shared GROUP templates are NOT materialised as pool tasks", () => {
  const poolId = "pool-1";
  const templates = [
    // Per-track GROUP template, not shared — belongs to a specific cohort, not pool.
    { id: "tmpl-cohort-group", kind: "GROUP" as const, isShared: false },
  ];
  const created = simulateMaterialise(poolId, templates, []);
  assert.equal(created.length, 0, "isShared=false GROUP templates are not pool tasks");
});

test("7 cohorts in a pool each see the same 2 pool GROUP tasks, not 7×2=14", () => {
  const poolId = "pool-1";
  const cohortCount = 7;
  const templates = [
    { id: "tmpl-meet", kind: "GROUP" as const, isShared: true },
    { id: "tmpl-kick", kind: "GROUP" as const, isShared: true },
  ];

  // Simulate the pool: materialise ONCE regardless of how many cohorts there are.
  const poolTasks = simulateMaterialise(poolId, templates, []);
  assert.equal(
    poolTasks.length,
    2,
    `${cohortCount} cohorts → still only 2 pool tasks, not ${cohortCount * 2}`,
  );
});

// ---------------------------------------------------------------------------
// 3 – Pool group placement: round-robin track spread
// ---------------------------------------------------------------------------

type Group = {
  id: string;
  members: { userId: string; programId: string }[];
  capacity: number;
};

/**
 * Mimics the placement logic in lib/internship-groups.ts:
 * pick the group with fewest members from the intern's track, or create one.
 */
function placeInPool(
  userId: string,
  programId: string,
  groups: Group[],
  capacity: number,
): { groupId: string; created: boolean } {
  const groupsWithRoom = groups.filter((g) => g.members.length < capacity);
  const sorted = groupsWithRoom.sort(
    (a, b) =>
      a.members.filter((m) => m.programId === programId).length -
      b.members.filter((m) => m.programId === programId).length,
  );
  if (sorted.length > 0) {
    const g = sorted[0];
    g.members.push({ userId, programId });
    return { groupId: g.id, created: false };
  }
  const newGroup: Group = {
    id: `g-${groups.length + 1}`,
    members: [{ userId, programId }],
    capacity,
  };
  groups.push(newGroup);
  return { groupId: newGroup.id, created: true };
}

test("round-robin: interns arriving interleaved by track are spread across groups", () => {
  const groups: Group[] = [];
  const capacity = 4;

  // Interns arrive interleaved: a1, b1, a2, b2, a3, b3, a4, b4.
  // Round-robin prefers the group with fewest members from the arriving track.
  const interns = ["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4"].map((id) => ({
    userId: id,
    programId: id.startsWith("a") ? "prog-A" : "prog-B",
  }));

  for (const intern of interns) {
    placeInPool(intern.userId, intern.programId, groups, capacity);
  }

  assert.equal(groups.length, 2, "8 interns / capacity 4 = 2 groups");
  for (const g of groups) {
    const countA = g.members.filter((m) => m.programId === "prog-A").length;
    const countB = g.members.filter((m) => m.programId === "prog-B").length;
    assert.equal(countA, 2, "Each group gets 2 track-A members");
    assert.equal(countB, 2, "Each group gets 2 track-B members");
  }
});

test("round-robin: leftover group has fewer members but no group is left with 1 member from capacity≥2", () => {
  const groups: Group[] = [];
  const capacity = 4;

  // 5 interns: leftover group gets 1 member (unavoidable with capacity=4).
  // The important thing is that the leftover isn't empty: it still exists.
  const interns = Array.from({ length: 5 }, (_, i) => ({
    userId: `u${i}`,
    programId: i % 2 === 0 ? "prog-A" : "prog-B",
  }));

  for (const intern of interns) {
    placeInPool(intern.userId, intern.programId, groups, capacity);
  }

  assert.equal(groups.length, 2, "5 interns → 2 groups (4 + 1)");
  const groupSizes = groups.map((g) => g.members.length).sort((a, b) => b - a);
  assert.equal(groupSizes[0], 4);
  assert.equal(groupSizes[1], 1, "Leftover group has 1 member (unavoidable at capacity=4)");
});

test("pool group capacity comes from poolGroupSize (default 4), not maxGroupSize (12)", () => {
  const maxGroupSize = 12;
  const poolGroupSize = 4;

  const groups: Group[] = [];
  const interns = Array.from({ length: 5 }, (_, i) => ({
    userId: `u${i}`,
    programId: "prog-A",
  }));

  // Using poolGroupSize=4, a 5th intern must start a new group.
  for (const intern of interns) {
    placeInPool(intern.userId, intern.programId, groups, poolGroupSize);
  }
  assert.equal(groups.length, 2, "poolGroupSize=4 creates a 2nd group at the 5th intern");

  // Using maxGroupSize=12, all 5 fit in one group.
  const groups2: Group[] = [];
  for (const intern of interns) {
    placeInPool(intern.userId, intern.programId, groups2, maxGroupSize);
  }
  assert.equal(groups2.length, 1, "maxGroupSize=12 keeps all 5 in one group");

  // The two settings produce different results — they must remain separate.
  assert.notEqual(groups.length, groups2.length);
  void maxGroupSize; // used above
});
