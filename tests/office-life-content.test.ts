import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultOfficeLifeContent,
  parseOfficeLifeContent,
  personalizeOfficeLifeContent,
} from "../lib/office-life/content";

test("every current track and level gets a valid four-week work-life plan", () => {
  const tracks = ["Digital Marketing", "Social Media Marketing", "AI for Content Creation", "AI Automation", "Front-End Development", "Back-End Engineering", "Product Design Internship", "Software Development Internship", "WordPress Development", "Special Class"];
  const levels = ["Beginner", "Novice", "Intermediate", "Advanced", "Professional"];
  for (const track of tracks) for (const level of levels) {
    const content = defaultOfficeLifeContent(track, level);
    assert.ok(parseOfficeLifeContent(content), `${track} template should validate`);
    assert.equal(content.workdays.length, 4);
    assert.equal(content.contentVersion, 2);
    const interview = content.workdays.flatMap((workday) => workday.steps).find((step) => step.kind === "meeting" && step.meetingType === "interview");
    if (level === "Beginner") assert.ok(interview, `${track} Beginner has a scripted interview`);
    if (level !== "Beginner") assert.ok(content.workdays.some((workday) => workday.steps.some((step) => step.kind === "work")), `${track} ${level} includes project work`);
  }
});

test("intern placeholder is replaced through cast and script content", () => {
  const content = defaultOfficeLifeContent("Digital Marketing", "Beginner");
  const personalized = personalizeOfficeLifeContent(content, "Ada");
  assert.match(JSON.stringify(personalized.workdays), /Ada/);
  assert.doesNotMatch(JSON.stringify(personalized.workdays), /\{\{intern\}\}/);
});

test("invalid workday references and duplicate steps are rejected", () => {
  const content = defaultOfficeLifeContent("Digital Marketing", "Beginner");
  const duplicateStep = structuredClone(content);
  duplicateStep.workdays[1].steps[0].id = duplicateStep.workdays[0].steps[0].id;
  assert.equal(parseOfficeLifeContent(duplicateStep), null);

  const invalidMeeting = structuredClone(content);
  const meeting = invalidMeeting.workdays[1].steps.find((step) => step.kind === "meeting");
  assert.ok(meeting && meeting.kind === "meeting");
  meeting.lines.push({ speaker: "ceo", text: "This speaker is not attending." });
  assert.equal(parseOfficeLifeContent(invalidMeeting), null);
});

test("workdays accept any cohort weekday and keep an ordered window", () => {
  const content = structuredClone(defaultOfficeLifeContent("Digital Marketing", "Beginner"));
  content.workdays[0].opensWeek = 2;
  content.workdays[0].opensDay = 3;
  content.workdays[0].opensTime = "10:30";
  content.workdays[0].dueWeek = 2;
  content.workdays[0].dueDay = 5;
  content.workdays[0].dueTime = "17:00";
  assert.ok(parseOfficeLifeContent(content));

  content.workdays[0].dueDay = 2;
  content.workdays[0].dueTime = "09:00";
  assert.equal(parseOfficeLifeContent(content), null);
});

test("work activities can link to a published Practice Lab scenario id", () => {
  const content = structuredClone(defaultOfficeLifeContent("Digital Marketing", "Beginner"));
  const build = content.workdays.flatMap((day) => day.steps).find((step) => step.kind === "work");
  assert.ok(build && build.kind === "work");
  build.labScenarioId = "scenario_example";
  assert.ok(parseOfficeLifeContent(content));
});

test("interview scripts and weekly plans are specific to the selected level and track", () => {
  const beginner = parseOfficeLifeContent(defaultOfficeLifeContent("Digital Marketing", "Beginner"));
  const professional = parseOfficeLifeContent(defaultOfficeLifeContent("Digital Marketing", "Professional"));
  const design = parseOfficeLifeContent(defaultOfficeLifeContent("Product Design Internship", "Beginner"));
  assert.ok(beginner && professional && design);
  const interview = beginner.workdays[0].steps.find((step) => step.kind === "meeting" && step.meetingType === "interview");
  assert.ok(interview && interview.kind === "meeting");
  assert.match(interview.agenda, /Junior Marketing Specialist/);
  assert.ok(!professional.workdays[0].steps.some((step) => step.title === interview.title));
  assert.match(professional.workdays[0].summary, /project/i);
  assert.match(JSON.stringify(design.workdays[0]), /Product Design Specialist/);
});