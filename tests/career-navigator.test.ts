import assert from "node:assert/strict";
import test from "node:test";
import { QUESTIONS, SKILL_IDS, rankSkills, reasonsFor, topTraits, type SkillId } from "../lib/career-navigator";

test("someone who always leans to a skill is pointed to it", () => {
  for (const id of SKILL_IDS) {
    const answers = QUESTIONS.map(({ options }) => {
      const points = options.map((option) => option.skills[id] ?? 0);
      return points.indexOf(Math.max(...points));
    });
    assert.equal(rankSkills(answers)[0].id, id);
    assert.ok(reasonsFor(id, answers).length >= 3);
    assert.ok(topTraits(answers).length >= 1);
  }
});

test("no skill is favoured or starved over random answers", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wins = new Map<SkillId, number>();
  const runs = 9000;
  for (let run = 0; run < runs; run++) {
    const answers = QUESTIONS.map(({ options }) => Math.floor(random() * options.length));
    const best = rankSkills(answers)[0].id;
    wins.set(best, (wins.get(best) ?? 0) + 1);
  }
  for (const id of SKILL_IDS) {
    const share = (wins.get(id) ?? 0) / runs;
    assert.ok(share > 0.06 && share < 0.18, `${id}: ${(share * 100).toFixed(1)}%`);
  }
});
