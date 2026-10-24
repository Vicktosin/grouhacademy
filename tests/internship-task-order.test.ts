import assert from "node:assert/strict";
import test from "node:test";
import {
  compareInternshipTaskOrder,
  OFFICE_LIFE_DAY_1_TASK_TITLE,
  OFFICE_LIFE_DAY_2_TASK_TITLE,
  RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
} from "../lib/internship-task-order";

test("recognizes Week 3 Task 2 by its linked workday after renaming", () => {
  const schedule = {
    opensWeek: 3,
    opensAt: new Date("2026-10-21T08:00:00Z"),
    dueDate: new Date("2026-10-27T22:59:00Z"),
  };
  const tasks = [
    { ...schedule, title: "Joining the workplace", officeLifeDay: 2 },
    { ...schedule, title: "Week 3 Task 3: Track exercise" },
    { ...schedule, title: RESOURCE_VIDEO_SUMMARY_TASK_TITLE },
  ];
  assert.deepEqual(
    tasks.sort(compareInternshipTaskOrder).map((t) => t.title),
    [
      RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
      "Joining the workplace",
      "Week 3 Task 3: Track exercise",
    ],
  );
});

test("Week 3 summary is Task 1 before Office Life Day 2 and numbered Task 3", () => {
  const schedule = {
    opensWeek: 3,
    opensAt: new Date("2026-10-20T23:00:00Z"),
    dueDate: new Date("2026-10-27T22:59:00Z"),
  };
  const tasks = [
    OFFICE_LIFE_DAY_2_TASK_TITLE,
    "Week 3 Task 3: Track exercise",
    RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
  ].map((title) => ({ title, ...schedule }));
  assert.deepEqual(
    tasks.sort(compareInternshipTaskOrder).map((t) => t.title),
    [
      RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
      OFFICE_LIFE_DAY_2_TASK_TITLE,
      "Week 3 Task 3: Track exercise",
    ],
  );
});

test("orders the Office Life Week 2 task between numbered tasks 1 and 3", () => {
  const opensAt = new Date("2026-10-14T00:00:00.000Z");
  const dueDate = new Date("2026-10-20T22:59:00.000Z");
  const tasks = [
    {
      title: "Week 2 Task 3: Introduction to Front-End Development",
      opensWeek: 2,
      opensAt,
      dueDate,
    },
    {
      title: OFFICE_LIFE_DAY_1_TASK_TITLE,
      opensWeek: 2,
      opensAt,
      dueDate,
    },
    {
      title: "Week 2 Task 1: Build Your Professional LinkedIn Profile",
      opensWeek: 2,
      opensAt,
      dueDate,
    },
  ];

  assert.deepEqual(
    tasks.sort(compareInternshipTaskOrder).map(({ title }) => title),
    [
      "Week 2 Task 1: Build Your Professional LinkedIn Profile",
      OFFICE_LIFE_DAY_1_TASK_TITLE,
      "Week 2 Task 3: Introduction to Front-End Development",
    ],
  );
});

test("keeps schedule order ahead of task numbering", () => {
  const earlier = new Date("2026-10-13T23:59:00.000Z");
  const later = new Date("2026-10-14T00:00:00.000Z");
  const dueDate = new Date("2026-10-20T22:59:00.000Z");
  const tasks = [
    {
      title: "Week 2 Task 1: Build Your Professional LinkedIn Profile",
      opensWeek: 2,
      opensAt: later,
      dueDate,
    },
    {
      title: OFFICE_LIFE_DAY_1_TASK_TITLE,
      opensWeek: 2,
      opensAt: earlier,
      dueDate,
    },
  ];

  assert.deepEqual(
    tasks.sort(compareInternshipTaskOrder).map(({ title }) => title),
    [
      OFFICE_LIFE_DAY_1_TASK_TITLE,
      "Week 2 Task 1: Build Your Professional LinkedIn Profile",
    ],
  );
});
