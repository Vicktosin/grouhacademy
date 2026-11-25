import assert from "node:assert/strict";
import test from "node:test";
import { LAB_EXERCISES } from "../data/lab-exercises";
import { OFFICE_PROJECTS } from "../data/office-projects";
import { CURRICULUM } from "../lib/curriculum";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "../lib/office-life/content";
import { castFor } from "../lib/office-life/story";

test("every track and level has its own client, four valid days and its milestone", () => {
  for (const { track, levels } of CURRICULUM)
    for (const level of levels) {
      const where = `${track} ${level.name}`;
      const own = OFFICE_PROJECTS[track][level.name];
      const content = defaultOfficeLifeContent(track, level.name);
      assert.ok(parseOfficeLifeContent(content), where);
      assert.equal(content.clientCompany, own.company);
      assert.deepEqual(content.workdays.map((day) => day.day), [1, 2, 3, 4]);
      content.workdays.forEach((day, index) => assert.ok(day.summary.includes(level.weeks[index].outcome), `${where} day ${day.day}`));
      const text = JSON.stringify(content.workdays);
      assert.ok(text.includes(own.company), where);
      assert.ok(JSON.stringify(content.workdays[3]).includes(JSON.stringify(level.milestone).slice(1, -1)), `${where}: milestone`);
      assert.doesNotMatch(text, /\b(the the|the an?|an? the|undefined)\b/i, where);
      // Nobody from the older story's client.
      assert.ok(!text.includes(castFor(track).clientCompany) || castFor(track).clientCompany === own.company, where);
    }
});

test("Office Life and the Practice Lab share a client at Beginner and Novice", () => {
  for (const item of LAB_EXERCISES) {
    if (item.week !== 4) continue;
    const company = OFFICE_PROJECTS[item.track][item.level].company;
    const text = `${item.brief} ${JSON.stringify(item.config ?? {})}`;
    const key = company.replace(/^The /, "").split(" ")[0];
    assert.ok(text.includes(key), `${item.track} ${item.level}: ${company}`);
  }
});
