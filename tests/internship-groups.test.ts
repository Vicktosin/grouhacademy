import assert from "node:assert/strict";
import test from "node:test";

import { reassignLeaderIfNeeded } from "../lib/internship-groups";

type Member = { userId: string; joinedAt: Date };

function fakeTx(leaderId: string | null, members: Member[]) {
  const state = { leaderId, updates: 0 };
  const tx = {
    internshipGroup: {
      findUniqueOrThrow: async () => ({ leaderId: state.leaderId }),
      update: async ({ data }: { data: { leaderId: string | null } }) => {
        state.leaderId = data.leaderId;
        state.updates += 1;
      },
    },
    internshipGroupMember: {
      count: async ({ where }: { where: { userId: string } }) =>
        members.filter((member) => member.userId === where.userId).length,
      findFirst: async () =>
        [...members].sort((a, b) => +a.joinedAt - +b.joinedAt)[0] ?? null,
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof reassignLeaderIfNeeded>[0],
    state,
  };
}

test("keeps the current leader while they are still a member", async () => {
  const { tx, state } = fakeTx("ada", [
    { userId: "ada", joinedAt: new Date(2026, 0, 2) },
    { userId: "ben", joinedAt: new Date(2026, 0, 1) },
  ]);
  await reassignLeaderIfNeeded(tx, "group-1");
  assert.equal(state.leaderId, "ada");
  assert.equal(state.updates, 0);
});

test("hands leadership to the longest-standing member when the leader leaves", async () => {
  const { tx, state } = fakeTx("ada", [
    { userId: "cy", joinedAt: new Date(2026, 0, 5) },
    { userId: "ben", joinedAt: new Date(2026, 0, 3) },
  ]);
  await reassignLeaderIfNeeded(tx, "group-1");
  assert.equal(state.leaderId, "ben");
});

test("clears the leader once the group is empty", async () => {
  const { tx, state } = fakeTx("ada", []);
  await reassignLeaderIfNeeded(tx, "group-1");
  assert.equal(state.leaderId, null);
});

test("assigns a leader to a leaderless group that has members", async () => {
  const { tx, state } = fakeTx(null, [
    { userId: "ben", joinedAt: new Date(2026, 0, 3) },
  ]);
  await reassignLeaderIfNeeded(tx, "group-1");
  assert.equal(state.leaderId, "ben");
});
