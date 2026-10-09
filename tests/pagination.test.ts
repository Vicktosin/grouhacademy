import test from "node:test";
import assert from "node:assert/strict";

import { pageWindow } from "../components/Pagination";

test("few pages are all shown", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 4), [1, 2, 3, 4]);
});

test("many pages show the ends and the neighbours, with gaps", () => {
  assert.deepEqual(pageWindow(1, 20), [1, 2, null, 20]);
  assert.deepEqual(pageWindow(10, 20), [1, null, 9, 10, 11, null, 20]);
  assert.deepEqual(pageWindow(20, 20), [1, null, 19, 20]);
});

test("a gap of one page shows that page instead of …", () => {
  assert.deepEqual(pageWindow(4, 20), [1, 2, 3, 4, 5, null, 20]);
});
