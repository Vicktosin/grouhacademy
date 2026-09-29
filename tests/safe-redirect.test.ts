import assert from "node:assert/strict";
import test from "node:test";

import { isSafeInternalPath } from "../lib/safe-redirect";

test("allows same-origin paths", () => {
  assert.equal(isSafeInternalPath("/student"), true);
  assert.equal(isSafeInternalPath("/courses/intro?tab=reviews#top"), true);
});

test("rejects paths that browsers resolve to another site", () => {
  assert.equal(isSafeInternalPath("//evil.example"), false);
  assert.equal(isSafeInternalPath("/\\evil.example"), false);
  assert.equal(isSafeInternalPath("https://evil.example"), false);
  assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
});

test("rejects missing or relative values", () => {
  assert.equal(isSafeInternalPath(null), false);
  assert.equal(isSafeInternalPath(undefined), false);
  assert.equal(isSafeInternalPath(""), false);
  assert.equal(isSafeInternalPath("student"), false);
});
