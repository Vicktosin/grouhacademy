// Uses the same cohort task/module schema and schedule as the admin Task section.
// node --import tsx scripts/create-week-three-summary-task.ts           (inspect)
// node --import tsx scripts/create-week-three-summary-task.ts --apply   (persist and verify)
import assert from "node:assert/strict";
import { config } from "dotenv";
import { getPrisma } from "../lib/prisma";
import { cohortTimeline, scheduleToDate } from "../lib/task-schedule";
import { getInternTaskContext, getInternTasks } from "../lib/intern-tasks";
import {
  compareInternshipTaskOrder,
  RESOURCE_VIDEO_SUMMARY_TASK_TITLE as title,
} from "../lib/internship-task-order";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });
const prisma = getPrisma();
const description = `Interns are required to watch the tutorial and resource videos available in their Resource Library and write a one-page summary explaining what they learned and understood from the videos.

Instructions:
1. Visit the Resource Library section of the Academy.
2. Watch the relevant tutorial and resource videos available to you.
3. Write a one-page summary explaining what you learned and understood from the videos, using your own words.
4. Submit your summary through the existing task submission workflow before the end of your current week.`;
const opens = { week: 3, day: 1, time: "00:00" };
const due = { week: 3, day: 7, time: "23:59" };
const matches = (value: string) =>
  value
    .replace(/^Week 3 Task 1:\s*/i, "")
    .trim()
    .toLowerCase() === title.toLowerCase();

async function protectedState() {
  // Hash actual rows without printing personal information or resource contents.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND (tablename LIKE '%Resource%' OR tablename IN
      ('User', 'InternshipApplication', 'InternshipCohort', 'InternshipTrack',
       'InternshipProgram', 'TaskSubmission', 'TaskSubmissionEvent', 'OfficeLifeContent'))
    ORDER BY tablename`;
  const result: Record<string, unknown> = {};
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    result[tablename] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count, md5(coalesce(string_agg(h, '' ORDER BY h), '')) AS hash FROM (SELECT md5(row_to_json(t)::text) AS h FROM public.${quoted} t) rows`,
    );
  }
  return result;
}

async function main() {
  const now = new Date();
  const cohorts = (
    await prisma.internshipCohort.findMany({
      where: { status: "ACTIVE", program: { status: "PUBLISHED" } },
      include: { program: { select: { name: true } } },
    })
  ).filter((c) => {
    const t = cohortTimeline(c.startDate, c.endDate, now);
    return t.started && !t.ended;
  });
  assert(cohorts.length > 0, "No currently running cohorts found");
  console.log("Running tracks:", cohorts.map((c) => c.program.name).join(", "));
  if (!process.argv.includes("--apply")) {
    for (const cohort of cohorts) {
      const tasks = await prisma.internshipTask.findMany({
        where: { cohortId: cohort.id },
      });
      console.log(
        JSON.stringify({
          cohort: cohort.name,
          matchingTasks: tasks.filter((t) => matches(t.title)).length,
          week3Tasks: tasks
            .filter((t) => t.opensWeek === 3)
            .map((t) => t.title),
          opensAt: scheduleToDate(cohort.startDate, opens),
          dueDate: scheduleToDate(cohort.startDate, due),
        }),
      );
    }
    return;
  }
  const protectedBefore = await protectedState();
  const tasksBefore = await prisma.internshipTask.findMany({
    orderBy: { id: "asc" },
  });
  const modulesBefore = await prisma.internshipModule.findMany({
    orderBy: { id: "asc" },
  });
  const createdIds: string[] = [];
  const taskIds = new Map<string, string>();
  // Lock plus matching-title lookup protects reruns, including simultaneous runs.
  await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(31003001)::text`;
      for (const cohort of cohorts) {
        const tasks = await tx.internshipTask.findMany({
          where: { cohortId: cohort.id },
        });
        const existing = tasks.filter((t) => matches(t.title));
        assert(
          existing.length <= 1,
          `Duplicate matching tasks in ${cohort.name}; refusing to add another`,
        );
        const data = {
          title,
          description,
          kind: "INDIVIDUAL" as const,
          opensWeek: 3,
          opensDay: 1,
          opensTime: opens.time,
          dueWeek: 3,
          dueDay: 7,
          dueTime: due.time,
          opensAt: scheduleToDate(cohort.startDate, opens),
          dueDate: scheduleToDate(cohort.startDate, due),
          maxScore: 100,
          labScenarioId: null,
          officeLifeDay: null,
        };
        if (existing.length) {
          const task = existing[0];
          for (const [key, expected] of Object.entries(data))
            assert.deepEqual(
              task[key as keyof typeof task],
              expected,
              `Existing task differs at ${key}; refusing to overwrite`,
            );
          taskIds.set(cohort.id, task.id);
          continue;
        }
        // Same Week N container lookup/create as the existing admin Task API.
        const weekModule =
          (await tx.internshipModule.findFirst({
            where: { programId: cohort.programId, title: "Week 3" },
          })) ??
          (await tx.internshipModule.create({
            data: { programId: cohort.programId, title: "Week 3", order: 3 },
          }));
        const task = await tx.internshipTask.create({
          data: { ...data, cohortId: cohort.id, moduleId: weekModule.id },
        });
        taskIds.set(cohort.id, task.id);
        createdIds.push(task.id);
      }
    },
    { timeout: 60000 },
  );

  let enrolled = 0;
  let eligible = 0;
  for (const cohort of cohorts) {
    const tasks = await prisma.internshipTask.findMany({
      where: { cohortId: cohort.id },
    });
    const summaries = tasks.filter((t) => matches(t.title));
    assert.equal(summaries.length, 1);
    const task = summaries[0];
    assert.equal(task.id, taskIds.get(cohort.id));
    const weekTasks = tasks
      .filter((t) => t.opensWeek === 3)
      .sort(compareInternshipTaskOrder);
    assert.equal(weekTasks[0].id, task.id, "Summary must be Week 3 Task 1");
    const applications = await prisma.internshipApplication.findMany({
      where: {
        cohortId: cohort.id,
        status: { not: "REMOVED" },
        student: { isPreview: false },
        payment: { is: { status: "PAID" } },
        attempts: { some: { status: "PASSED" } },
      },
      select: {
        studentId: true,
        payment: { select: { status: true } },
        attempts: { where: { status: "PASSED" }, select: { id: true } },
      },
    });
    let visible = 0;
    for (let offset = 0; offset < applications.length; offset += 8) {
      await Promise.all(
        applications.slice(offset, offset + 8).map(async (application) => {
          enrolled++;
          const context = await getInternTaskContext(application.studentId);
          assert.equal(
            context?.cohortId,
            cohort.id,
            "Latest application points at a different cohort",
          );
          const list = await getInternTasks(application.studentId, context!);
          const item = list.find((t) => t.id === task.id);
          assert(item, "Task missing from intern task list");
          assert.equal(item.weekNumber, 3);
          assert.equal(item.kind, "INDIVIDUAL");
          assert.equal(item.labScenarioId, null);
          assert.equal(item.officeLifeDay, null);
          assert.equal(
            item.canSubmit,
            true,
            "Existing submission window must allow the summary",
          );
          visible++;
          if (
            application.payment?.status === "PAID" &&
            application.attempts.length > 0
          )
            eligible++;
        }),
      );
    }
    console.log(
      JSON.stringify({
        track: cohort.program.name,
        taskId: task.id,
        visibleInternLists: visible,
        week3Order: weekTasks.map((t) => t.title),
        dueDate: task.dueDate,
      }),
    );
  }
  const tasksAfter = await prisma.internshipTask.findMany({
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    tasksAfter.filter((t) => !createdIds.includes(t.id)),
    tasksBefore,
    "Existing tasks changed",
  );
  const modulesAfter = await prisma.internshipModule.findMany({
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    modulesAfter.filter((m) => modulesBefore.some((b) => b.id === m.id)),
    modulesBefore,
    "Existing modules changed",
  );
  assert.deepEqual(
    await protectedState(),
    protectedBefore,
    "Unrelated records changed during execution",
  );
  console.log(
    JSON.stringify({
      created: createdIds.length,
      verifiedCohorts: cohorts.length,
      enrolledInternLists: enrolled,
      eligibleInternLists: eligible,
      protectedRecordsUnchanged: true,
      existingTasksUnchanged: true,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
