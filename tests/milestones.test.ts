import assert from "node:assert/strict";
import test from "node:test";
import { CURRICULUM } from "../lib/curriculum";

test("every level has a milestone and every week an outcome, all different", () => {
  const seen = new Set<string>();
  for (const track of CURRICULUM)
    for (const level of track.levels) {
      assert.ok(level.milestone, `${track.track} ${level.name}`);
      assert.equal(level.weeks.length, 4);
      for (const text of [level.milestone, ...level.weeks.map((week) => week.outcome)]) {
        assert.ok(text && !seen.has(`${track.track}:${text}`), `${track.track} ${level.name}: ${text}`);
        seen.add(`${track.track}:${text}`);
      }
    }
  assert.equal(seen.size, 225);
});
