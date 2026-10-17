import assert from "node:assert/strict";
import test from "node:test";
import {
  compareInternshipTaskOrder,
  OFFICE_LIFE_DAY_1_TASK_TITLE,
} from "../lib/internship-task-order";

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
    [OFFICE_LIFE_DAY_1_TASK_TITLE, "Week 2 Task 1: Build Your Professional LinkedIn Profile"],
  );
});
