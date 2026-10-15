// Checks scripts/october-2026-week2-reset.ts (reads only, changes nothing).
//
//   npx tsx scripts/october-2026-week2-check.ts fingerprint   # submissions and grades now
//   npx tsx scripts/october-2026-week2-check.ts               # check the result
//
// The fingerprint taken before the change must equal the one after it: every
// task submission's status, score, feedback, content and dates unchanged.

import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { getPrisma } from "../lib/prisma";
import { officeLifeDay, officeLifeOverview } from "../lib/office-life/server";
import { formatWat } from "../lib/task-schedule";

const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^"|"$/g, "") || "https://unknown").hostname.split(".")[0];
const BACKUP = `scripts/backups/october-2026-week2-reset.${project}.json`;
const FINGERPRINT = `scripts/backups/october-2026-week2-submissions.${project}.json`;

async function fingerprint() {
  const rows = await getPrisma().taskSubmission.findMany({
    orderBy: { id: "asc" },
    select: { id: true, taskId: true, userId: true, status: true, score: true, feedback: true, content: true, submittedAt: true, reviewedAt: true, reviewedById: true, updatedAt: true },
  });
  return { count: rows.length, hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
}

let failed = false;
const check = (ok: boolean, line: string) => {
  console.log(`${ok ? "✓" : "✖"} ${line}`);
  if (!ok) failed = true;
};

async function main() {
  const prisma = getPrisma();
  console.log(`Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  if (process.argv[2] === "fingerprint") {
    if (existsSync(FINGERPRINT)) return console.log(`Already saved: ${FINGERPRINT}`);
    writeFileSync(FINGERPRINT, `${JSON.stringify({ takenAt: new Date().toISOString(), ...(await fingerprint()) }, null, 2)}\n`);
    return console.log(`Saved ${FINGERPRINT}`);
  }

  const before = JSON.parse(readFileSync(FINGERPRINT, "utf8"));
  const now = await fingerprint();
  check(before.hash === now.hash && before.count === now.count, `task submissions and grades unchanged (${now.count})`);

  const original = JSON.parse(readFileSync(BACKUP, "utf8"));
  for (const old of original.cohorts) {
    const cohort = await prisma.internshipCohort.findUniqueOrThrow({ where: { id: old.id }, select: { name: true, startDate: true, endDate: true } });
    check(cohort.startDate.toISOString() === "2026-10-07T00:00:00.000Z" && cohort.endDate.toISOString() === "2026-11-03T22:59:00.000Z",
      `${cohort.name}: ${formatWat(cohort.startDate)} – ${formatWat(cohort.endDate)} (WAT)`);
    for (const task of old.tasks) {
      const saved = await prisma.internshipTask.findUniqueOrThrow({ where: { id: task.id }, select: { opensAt: true, dueDate: true } });
      check(saved.opensAt.toISOString() === task.opensAt && saved.dueDate.toISOString() === task.dueDate, `  "${task.title}" keeps ${formatWat(saved.opensAt)} → ${formatWat(saved.dueDate)}`);
    }
    const week2 = await prisma.internshipTask.findMany({ where: { cohortId: old.id, opensWeek: 2 }, select: { title: true, opensAt: true, dueDate: true, kind: true, maxScore: true } });
    for (const task of week2)
      check(task.opensAt.toISOString() === "2026-10-13T23:00:00.000Z" && task.dueDate.toISOString() === "2026-10-20T22:59:00.000Z" && task.kind === "INDIVIDUAL" && task.maxScore === 100,
        `  "${task.title}": ${formatWat(task.opensAt)} → ${formatWat(task.dueDate)}`);
  }

  // Every intern in these cohorts: workday 1 open now, 14–20 Oct, and loads.
  const interns = await prisma.internshipApplication.findMany({
    where: { cohortId: { in: original.cohorts.map((c: { id: string }) => c.id) }, status: { not: "REMOVED" }, payment: { is: { status: "PAID" } }, attempts: { some: { status: "PASSED" } } },
    select: { studentId: true },
  });
  let open = 0;
  const problems: string[] = [];
  for (const { studentId } of interns) {
    const overview = await officeLifeOverview(studentId, false);
    const day = overview.enrolled ? overview.days.find((d) => d.day === 1) : null;
    const loaded = await officeLifeDay(studentId, 1, false);
    if (day?.open && day.opensAt === "2026-10-14T08:00:00.000Z" && day.dueAt === "2026-10-20T22:59:00.000Z" && !("error" in loaded)) open++;
    else problems.push(`${studentId}: ${"error" in loaded ? loaded.error : `open ${day?.open} ${day?.opensAt} → ${day?.dueAt}`}`);
  }
  check(problems.length === 0, `Office Life workday 1 open now (Wed 14 Oct, 9:00 AM → Tue 20 Oct, 11:59 PM WAT) for ${open} of ${interns.length} interns`);
  for (const problem of problems) console.log(`    ${problem}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
