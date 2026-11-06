// Exports a JSON snapshot of every row in the five tables that this migration
// touches or could affect. Run BEFORE and AFTER the migration to confirm
// nothing changed. The file is written to snapshots/<timestamp>.json.
//
//   npx tsx scripts/pre-migration-snapshot.ts [label]
//
// label defaults to "before" or "after" based on --after flag.

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getPrisma } from "../lib/prisma";

async function main() {
  const label = process.argv[2] ?? "snapshot";
  const prisma = getPrisma();

  const [tasks, submissions, cohorts, groups, members, applications] =
    await Promise.all([
      prisma.internshipTask.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          title: true,
          kind: true,
          cohortId: true,
          opensWeek: true,
          dueWeek: true,
          opensAt: true,
          dueDate: true,
          _count: { select: { submissions: true } },
        },
      }),
      prisma.taskSubmission.findMany({
        orderBy: { id: "asc" },
        select: { id: true, taskId: true, userId: true, groupId: true, status: true, score: true },
      }),
      prisma.internshipCohort.findMany({
        orderBy: { id: "asc" },
        select: { id: true, name: true, programId: true, levelId: true, startDate: true, endDate: true, status: true },
      }),
      prisma.internshipGroup.findMany({
        orderBy: { id: "asc" },
        select: { id: true, programId: true, cohortId: true, number: true, capacity: true },
      }),
      prisma.internshipGroupMember.findMany({
        orderBy: { id: "asc" },
        select: { id: true, groupId: true, programId: true, userId: true },
      }),
      prisma.internshipApplication.findMany({
        orderBy: { id: "asc" },
        select: { id: true, studentId: true, programId: true, levelId: true, cohortId: true, status: true },
      }),
    ]);

  const snapshot = {
    label,
    takenAt: new Date().toISOString(),
    counts: {
      tasks: tasks.length,
      submissions: submissions.length,
      cohorts: cohorts.length,
      groups: groups.length,
      groupMembers: members.length,
      applications: applications.length,
    },
    data: { tasks, submissions, cohorts, groups, groupMembers: members, applications },
  };

  const dir = path.resolve(__dirname, "../snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${label.replace(/\s+/g, "-")}-${Date.now()}.json`;
  const outPath = path.join(dir, filename);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`\nSnapshot: ${label}`);
  console.log(`Saved to: ${outPath}`);
  console.log("\nCounts:");
  for (const [k, v] of Object.entries(snapshot.counts)) {
    console.log(`  ${k.padEnd(16)} ${v}`);
  }
  console.log();

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
