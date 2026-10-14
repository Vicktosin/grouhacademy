// Backfill: Office Life tasks for workdays finished before finishing one
// submitted its linked tasks (lib/office-life/tasks). Creates each intern's
// accepted submission, exactly as finishing the workday now does. Safe to run
// again: interns who already have a submission for a task are skipped.
//
//   npx tsx scripts/backfill-office-life-tasks.ts           # count only
//   npx tsx scripts/backfill-office-life-tasks.ts --apply   # create them
//
// Reads DATABASE_URL from .env (the live project). For the development
// project: DOTENV_CONFIG_PATH=.env.dev-db npx tsx scripts/backfill-office-life-tasks.ts

import "dotenv/config";
import { getPrisma } from "../lib/prisma";
import { submitOfficeLifeTasks } from "../lib/office-life/tasks";

const apply = process.argv.includes("--apply");

async function main() {
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^"|"$/g, "") ?? "unknown project";
  console.log(`Database: ${project}`);
  const pending = await submitOfficeLifeTasks({}, { dryRun: true });
  console.log(`Office Life task submissions to create: ${pending}`);
  if (!apply) {
    console.log("Count only. Run again with --apply to create them.");
    return;
  }
  const created = await submitOfficeLifeTasks();
  console.log(`Created ${created} accepted submission${created === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
