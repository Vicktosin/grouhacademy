// Development helper: makes the /dev/auth test intern finish their current
// level, so the "level complete" pop-up, certificate and next-level page can
// be tried without waiting for a real cohort to end.
//
//   npx tsx scripts/dev-finish-level.ts          # finish the level
//   npx tsx scripts/dev-finish-level.ts --reset  # undo it
//
// It only ever touches the dev-intern@developer.local account and the
// "Dev Test Cohort" that /dev/auth puts it in, and refuses to run if that
// cohort contains anyone else. Sign in once at /dev/auth as Intern first so
// the account and its cohort exist.
//
// Finishing: ends the dev cohort yesterday, gives it one test task, and marks
// the test intern's submission accepted. Opening the intern dashboard then
// issues the certificate and shows the pop-up.

import "dotenv/config";
import { getPrisma } from "../lib/prisma";

const DEV_EMAIL = "dev-intern@developer.local";
const DEV_DOMAIN = "@developer.local";
const DEV_COHORT_PREFIX = "dev-test-cohort";
const TEST_TASK_TITLE = "Dev test task (dev-finish-level)";
const TEST_MODULE_TITLE = "Dev test module (dev-finish-level)";
const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_DAYS = 28;

const reset = process.argv.includes("--reset");

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: DEV_EMAIL },
    select: { id: true },
  });
  if (!user)
    fail(`${DEV_EMAIL} doesn't exist. Sign in at /dev/auth as Intern first.`);

  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    include: { cohort: true, program: true, level: true },
  });
  if (!application)
    fail("The test intern has no application. Sign in at /dev/auth as Intern first.");
  let cohort = application.cohort;

  // A test account placed in a real cohort is moved to its track's Dev Test
  // Cohort instead; the real cohort itself is never changed.
  if (!cohort?.slug.startsWith(DEV_COHORT_PREFIX)) {
    const devCohort = await prisma.internshipCohort.findFirst({
      where: {
        programId: application.programId,
        levelId: application.levelId,
        slug: { startsWith: DEV_COHORT_PREFIX },
      },
    });
    if (!devCohort)
      fail(
        `The test intern is in "${cohort?.name ?? "no cohort"}" and there's no Dev Test Cohort for ${application.program.name} at ${application.level.name} level. Sign in at /dev/auth as Intern to create one.`,
      );
    await prisma.internshipApplication.update({
      where: { id: application.id },
      data: { cohortId: devCohort.id },
    });
    console.log(
      `• Moved the test intern out of "${cohort?.name ?? "no cohort"}" into "${devCohort.name}" (real cohort untouched).`,
    );
    cohort = devCohort;
  }

  const outsiders = await prisma.internshipApplication.count({
    where: {
      cohortId: cohort.id,
      student: { email: { not: { endsWith: DEV_DOMAIN } } },
    },
  });
  if (outsiders)
    fail(
      `"${cohort.name}" contains ${outsiders} real intern(s). Refusing to change it.`,
    );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (reset) {
    // Undo: certificate, test task (its submission cascades), test module,
    // and the cohort back to starting today.
    const certificates = await prisma.internshipCertificate.deleteMany({
      where: { userId: user.id, applicationId: application.id },
    });
    const tasks = await prisma.internshipTask.deleteMany({
      where: { cohortId: cohort.id, title: TEST_TASK_TITLE },
    });
    await prisma.internshipModule.deleteMany({
      where: {
        programId: application.programId,
        title: TEST_MODULE_TITLE,
        tasks: { none: {} },
      },
    });
    await prisma.internshipCohort.update({
      where: { id: cohort.id },
      data: {
        startDate: today,
        endDate: new Date(today.getTime() + (COHORT_DAYS - 1) * DAY_MS),
        status: "ACTIVE",
      },
    });
    console.log(
      `✔ Reset "${cohort.name}": removed ${certificates.count} certificate(s) and ${tasks.count} test task(s); the cohort runs from today again.`,
    );
    console.log(
      "  The pop-up remembers it was dismissed in your browser; clear this site's local storage to see it again.",
    );
    return;
  }

  // End the cohort yesterday so certificates can be issued.
  const start = new Date(today.getTime() - COHORT_DAYS * DAY_MS);
  const end = new Date(today.getTime() - DAY_MS);
  await prisma.internshipCohort.update({
    where: { id: cohort.id },
    data: { startDate: start, endDate: end, status: "COMPLETED" },
  });

  const module =
    (await prisma.internshipModule.findFirst({
      where: { programId: application.programId, title: TEST_MODULE_TITLE },
    })) ??
    (await prisma.internshipModule.create({
      data: { programId: application.programId, title: TEST_MODULE_TITLE },
    }));

  const task =
    (await prisma.internshipTask.findFirst({
      where: { cohortId: cohort.id, title: TEST_TASK_TITLE },
    })) ??
    (await prisma.internshipTask.create({
      data: {
        cohortId: cohort.id,
        moduleId: module.id,
        title: TEST_TASK_TITLE,
        description: "Created by scripts/dev-finish-level.ts for testing.",
        kind: "INDIVIDUAL",
        opensWeek: 1,
        opensDay: 1,
        opensTime: "09:00",
        dueWeek: 1,
        dueDay: 2,
        dueTime: "17:00",
        opensAt: start,
        dueDate: new Date(start.getTime() + DAY_MS),
      },
    }));

  // Pass every task in the dev cohort, so the pass mark is met.
  const cohortTasks = await prisma.internshipTask.findMany({
    where: { cohortId: cohort.id },
    select: { id: true, kind: true, maxScore: true },
  });
  for (const cohortTask of cohortTasks.filter((t) => t.kind === "INDIVIDUAL"))
    await prisma.taskSubmission.upsert({
      where: { taskId_userId: { taskId: cohortTask.id, userId: user.id } },
      create: {
        taskId: cohortTask.id,
        userId: user.id,
        content: "Dev test submission",
        status: "ACCEPTED",
        score: cohortTask.maxScore,
        reviewedAt: new Date(),
      },
      update: {
        status: "ACCEPTED",
        score: cohortTask.maxScore,
        reviewedAt: new Date(),
      },
    });
  const groupTasks = cohortTasks.filter((t) => t.kind === "GROUP").length;

  const next = await prisma.internshipLevel.findFirst({
    where: { rank: { gt: application.level.rank } },
    orderBy: { rank: "asc" },
  });
  const nextFee = next
    ? await prisma.internshipLevelFee.findUnique({
        where: {
          programId_levelId: {
            programId: application.programId,
            levelId: next.id,
          },
        },
      })
    : null;

  console.log(
    `✔ "${cohort.name}" (${application.program.name}, ${application.level.name} level) now ended yesterday, and the test intern passed its tasks (test task: ${task.title}).`,
  );
  if (groupTasks)
    console.log(
      `  Note: ${groupTasks} group task(s) in this cohort weren't marked passed and may keep the intern below the pass mark.`,
    );
  console.log(
    "  Open /internship/dashboard as the dev Intern to see the pop-up (the certificate is issued then).",
  );
  if (next && !nextFee)
    console.log(
      `  To see the payment button on the next-level page, set a ${next.name} fee for ${application.program.name} under Admin → Internship → Levels.`,
    );
  console.log("  Undo with: npx tsx scripts/dev-finish-level.ts --reset");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
