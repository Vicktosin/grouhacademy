// Same storage, relative schedule and completion hooks as the admin Task section.
// node --import tsx scripts/create-week-three-office-life-task.ts [--apply]
import assert from "node:assert/strict";
import { config } from "dotenv";
import { getPrisma } from "../lib/prisma";
import { cohortTimeline, scheduleToDate } from "../lib/task-schedule";
import {
  parseOfficeLifeContent,
  defaultOfficeLifeContent,
} from "../lib/office-life/content";
import { submitOfficeLifeTasks } from "../lib/office-life/tasks";
import { getInternTaskContext } from "../lib/intern-tasks";
import { getInternTasksWithOfficeLife } from "../lib/office-life/task-list";
import { recomputeInternProgress } from "../lib/internship-progress";
import {
  OFFICE_LIFE_DAY_2_TASK_TITLE,
  RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
} from "../lib/internship-task-order";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });
const prisma = getPrisma();
async function protectedState() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND (tablename LIKE '%Resource%' OR tablename IN
      ('User', 'InternshipApplication', 'InternshipCohort', 'InternshipTrack',
       'InternshipProgram', 'OfficeLifeContent', 'OfficeLifeDay')) ORDER BY tablename`;
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
      include: {
        program: { select: { name: true } },
        level: { select: { name: true } },
      },
    })
  ).filter((c) => {
    const timeline = cohortTimeline(c.startDate, c.endDate, now);
    return timeline.started && !timeline.ended;
  });
  assert(cohorts.length, "No running cohorts");
  const plans = await Promise.all(
    cohorts.map(async (cohort) => {
      const saved = await prisma.officeLifeContent.findUnique({
        where: {
          programId_levelId: {
            programId: cohort.programId,
            levelId: cohort.levelId,
          },
        },
      });
      const content =
        parseOfficeLifeContent(saved?.content) ??
        defaultOfficeLifeContent(cohort.program.name, cohort.level.name);
      const day = content.workdays.find((w) => w.day === 2);
      assert(day, `Workday 2 missing in ${cohort.name}`);
      assert.equal(day.opensWeek, 3, "Workday 2 must be scheduled for Week 3");
      const tasks = await prisma.internshipTask.findMany({
        where: { cohortId: cohort.id },
      });
      console.log(
        JSON.stringify({
          track: cohort.program.name,
          workday: day.day,
          title: day.title,
          linkedTasks: tasks
            .filter((t) => t.officeLifeDay === 2)
            .map((t) => ({ id: t.id, title: t.title })),
          opensWeek: day.opensWeek,
          dueWeek: day.dueWeek,
          dueDay: day.dueDay,
          dueTime: day.dueTime,
        }),
      );
      assert(
        tasks.some(
          (t) =>
            t.opensWeek === 3 && t.title === RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
        ),
        "Summary Task 1 missing",
      );
      return { cohort, day };
    }),
  );
  if (!process.argv.includes("--apply")) return;
  const protectedBefore = await protectedState();
  const tasksBefore = await prisma.internshipTask.findMany({
    orderBy: { id: "asc" },
  });
  const submissionsBefore = await prisma.taskSubmission.findMany({
    orderBy: { id: "asc" },
  });
  const taskIds = new Map<string, string>();
  const createdIds: string[] = [];
  async function ensureTasks() {
    let created = 0;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(31003002)::text`;
        for (const { cohort, day } of plans) {
          const tasks = await tx.internshipTask.findMany({
            where: { cohortId: cohort.id },
          });
          const existing = tasks.filter(
            (t) =>
              t.officeLifeDay === 2 || t.title === OFFICE_LIFE_DAY_2_TASK_TITLE,
          );
          assert(
            existing.length <= 1,
            `Duplicate Workday 2 tasks in ${cohort.name}`,
          );
          const schedule = {
            opensWeek: day.opensWeek,
            opensDay: day.opensDay,
            opensTime: day.opensTime,
            dueWeek: day.dueWeek,
            dueDay: day.dueDay,
            dueTime: day.dueTime,
            opensAt: scheduleToDate(cohort.startDate, {
              week: day.opensWeek,
              day: day.opensDay,
              time: day.opensTime,
            }),
            dueDate: scheduleToDate(cohort.startDate, {
              week: day.dueWeek,
              day: day.dueDay,
              time: day.dueTime,
            }),
            kind: "INDIVIDUAL" as const,
            officeLifeDay: 2,
            labScenarioId: null,
          };
          if (existing.length) {
            for (const [key, value] of Object.entries(schedule))
              assert.deepEqual(
                existing[0][key as keyof (typeof existing)[0]],
                value,
                `Existing Workday 2 differs at ${key}; refusing to overwrite`,
              );
            taskIds.set(cohort.id, existing[0].id);
            continue;
          }
          const weekModule = await tx.internshipModule.findFirst({
            where: { programId: cohort.programId, title: "Week 3" },
          });
          assert(weekModule, "Existing Week 3 task container missing");
          const task = await tx.internshipTask.create({
            data: {
              ...schedule,
              cohortId: cohort.id,
              moduleId: weekModule.id,
              title: OFFICE_LIFE_DAY_2_TASK_TITLE,
              maxScore: 100,
              description: `Complete Office Life Workday 2: ${day.title}.\n\n${day.summary}\n\nInstructions:\n1. Open Office Life and select Workday 2.\n2. Complete all activities for the second workday.\n3. Finish the workday before the end of Week 3.\n\nThis task is submitted and accepted automatically when you complete Workday 2 through the existing Office Life workflow.`,
            },
          });
          taskIds.set(cohort.id, task.id);
          createdIds.push(task.id);
          created++;
        }
      },
      { timeout: 60000 },
    );
    return created;
  }
  const created = await ensureTasks();
  assert.equal(await ensureTasks(), 0, "Rerun created duplicate tasks");
  let visibleInterns = 0;
  let backfilledSubmissions = 0;
  for (const { cohort } of plans) {
    const taskId = taskIds.get(cohort.id)!;
    // The admin create endpoint calls this same hook for already completed days.
    backfilledSubmissions += await submitOfficeLifeTasks({ taskId });
    const applications = await prisma.internshipApplication.findMany({
      where: {
        cohortId: cohort.id,
        status: { not: "REMOVED" },
        payment: { is: { status: "PAID" } },
        student: { isPreview: false },
      },
      select: { studentId: true },
    });
    let visible = 0;
    for (let offset = 0; offset < applications.length; offset += 8) {
      await Promise.all(
        applications.slice(offset, offset + 8).map(async ({ studentId }) => {
            // Refresh on reruns too, so interrupted creation/backfills recover.
            await recomputeInternProgress(studentId, cohort.programId);
          const context = await getInternTaskContext(studentId);
          assert.equal(context?.cohortId, cohort.id);
          const tasks = await getInternTasksWithOfficeLife(
            studentId,
            context!,
            false,
          );
          const index = tasks.findIndex((t) => t.id === taskId);
          const summaryIndex = tasks.findIndex(
            (t) => t.title === RESOURCE_VIDEO_SUMMARY_TASK_TITLE,
          );
          assert(
            index > summaryIndex && summaryIndex >= 0,
            "Workday 2 must follow the summary",
          );
          const task = tasks[index];
          assert.equal(task.weekNumber, 3);
          assert.equal(task.officeLifeDay, 2);
          assert.equal(task.officeLife?.day, 2);
          assert.equal(
            task.canSubmit,
            false,
            "Office Life completion must control submission",
          );
          visible++;
        }),
      );
    }
    visibleInterns += visible;
    assert.equal(
      await prisma.internshipTask.count({
        where: { cohortId: cohort.id, officeLifeDay: 2 },
      }),
      1,
    );
    assert.equal(
      await submitOfficeLifeTasks({ taskId }, { dryRun: true }),
      0,
      "Duplicate or pending automatic submissions",
    );
    console.log(
      JSON.stringify({
        track: cohort.program.name,
        taskId,
        workday: 2,
        week: 3,
        visiblePaidInterns: visible,
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
  const submissionsAfter = await prisma.taskSubmission.findMany({
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    submissionsAfter.filter((s) =>
      submissionsBefore.some((b) => b.id === s.id),
    ),
    submissionsBefore,
    "Existing submissions changed",
  );
  assert.deepEqual(
    await protectedState(),
    protectedBefore,
    "Protected records changed",
  );
  console.log(
    JSON.stringify({
      created,
      rerunCreated: 0,
      cohorts: plans.length,
      visiblePaidInterns: visibleInterns,
      backfilledSubmissions,
      existingTasksUnchanged: true,
      protectedRecordsUnchanged: true,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
