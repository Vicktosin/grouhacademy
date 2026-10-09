import test from "node:test";
import assert from "node:assert/strict";

import { cachedJson, clearCachedJson } from "../lib/client-cache";

let calls = 0;
let fail = false;
globalThis.fetch = (async () => {
  calls++;
  return fail ? new Response("nope", { status: 500 }) : Response.json({ n: calls });
}) as typeof fetch;
console.error = () => {};

test("requests at the same time share one fetch, then it's reused", async () => {
  clearCachedJson();
  calls = 0;
  const [a, b] = await Promise.all([cachedJson("/x", 60_000), cachedJson("/x", 60_000)]);
  assert.deepEqual(a, { n: 1 });
  assert.deepEqual(b, { n: 1 });
  assert.deepEqual(await cachedJson("/x", 60_000), { n: 1 });
  assert.equal(calls, 1);
});

test("expired entries are fetched again; clearing forgets them", async () => {
  clearCachedJson();
  calls = 0;
  await cachedJson("/y", 60_000);
  await cachedJson("/y", 0);
  assert.equal(calls, 2);
  clearCachedJson("/y");
  await cachedJson("/y", 60_000);
  assert.equal(calls, 3);
});

test("failures resolve to null and aren't kept", async () => {
  clearCachedJson();
  calls = 0;
  fail = true;
  assert.equal(await cachedJson("/z", 60_000), null);
  fail = false;
  assert.deepEqual(await cachedJson("/z", 60_000), { n: 2 });
});
