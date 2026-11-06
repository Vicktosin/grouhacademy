// Inventory of existing InternshipTask rows — read-only, changes nothing.
//
// Shows a breakdown by track / level / week / kind (INDIVIDUAL vs GROUP),
// lists every GROUP task explicitly, and reports all tracks (including those
// with cohorts but no tasks yet, so we can spot gaps).
//
//   npx tsx scripts/task-library-import-dryrun.ts
//
// Reads .env.local (live project). For dev:
//   DOTENV_CONFIG_PATH=.env.dev-db npx tsx scripts/task-library-import-dryrun.ts

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
import { getPrisma } from "../lib/prisma";

async function main() {
  const prisma = getPrisma();
  const project =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^"|"$/g, "") ??
    "unknown project";
  console.log(`\nDatabase: ${project}\n`);

  // All tracks (programs) so we can show ones with no tasks.
  const programs = await prisma.internshipProgram.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // All levels.
  const levels = await prisma.internshipLevel.findMany({
    orderBy: { rank: "asc" },
    select: { id: true, name: true, rank: true },
  });

  // All tasks with cohort, track, level.
  const tasks = await prisma.internshipTask.findMany({
    orderBy: [{ opensAt: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      kind: true,
      opensWeek: true,
      cohortId: true,
      cohort: {
        select: {
          name: true,
          programId: true,
          levelId: true,
          program: { select: { name: true } },
          level: { select: { name: true } },
        },
      },
      _count: { select: { submissions: true } },
    },
  });

  // All tasks fetched here have a cohort (the query joins on it).
  const individual = tasks.filter((t) => t.kind === "INDIVIDUAL");
  const group = tasks.filter((t) => t.kind === "GROUP");

  console.log(`Total InternshipTask rows: ${tasks.length}`);
  console.log(`  INDIVIDUAL: ${individual.length}`);
  console.log(`  GROUP:      ${group.length}`);
  console.log(
    `  With submissions: ${tasks.filter((t) => t._count.submissions > 0).length}`,
  );
  console.log();

  // ── All tracks — task counts (including 0) ────────────────────────────────

  console.log("── Tracks and task counts ───────────────────────────────────────");
  console.log(
    "Track".padEnd(38) +
      "INDIVIDUAL".padEnd(13) +
      "GROUP".padEnd(8) +
      "Total",
  );
  console.log("─".repeat(70));
  let tracksWithTasks = 0;
  for (const prog of programs) {
    const mine = tasks.filter((t) => t.cohort!.programId === prog.id);
    const indv = mine.filter((t) => t.kind === "INDIVIDUAL").length;
    const grp = mine.filter((t) => t.kind === "GROUP").length;
    const note = mine.length === 0 ? " (no tasks yet)" : "";
    if (mine.length > 0) tracksWithTasks++;
    console.log(
      prog.name.slice(0, 37).padEnd(38) +
        String(indv).padEnd(13) +
        String(grp).padEnd(8) +
        String(mine.length) +
        note,
    );
  }
  console.log(
    `\n  ${programs.length} tracks total, ${tracksWithTasks} have tasks, ${programs.length - tracksWithTasks} have no tasks yet.\n`,
  );

  // ── Per-track / level / week breakdown (kind shown) ───────────────────────

  type WeekKey = {
    programName: string;
    levelName: string;
    week: number;
    individual: number;
    group: number;
  };
  const weekMap = new Map<string, WeekKey>();
  for (const t of tasks) {
    const k = `${t.cohort!.programId}|${t.cohort!.levelId}|${t.opensWeek}`;
    if (!weekMap.has(k)) {
      weekMap.set(k, {
        programName: t.cohort!.program.name,
        levelName: t.cohort!.level.name,
        week: t.opensWeek,
        individual: 0,
        group: 0,
      });
    }
    const entry = weekMap.get(k)!;
    if (t.kind === "GROUP") entry.group++;
    else entry.individual++;
  }

  console.log(
    "── Per-track / level / week breakdown ──────────────────────────────",
  );
  console.log(
    "Track".padEnd(35) +
      "Level".padEnd(15) +
      "Wk".padEnd(5) +
      "Indiv".padEnd(8) +
      "Group",
  );
  console.log("─".repeat(72));
  const sorted = [...weekMap.values()].sort((a, b) => {
    const t = a.programName.localeCompare(b.programName);
    if (t !== 0) return t;
    const l = a.levelName.localeCompare(b.levelName);
    if (l !== 0) return l;
    return a.week - b.week;
  });
  for (const r of sorted) {
    const grpLabel = r.group > 0 ? String(r.group) : "-";
    console.log(
      r.programName.slice(0, 34).padEnd(35) +
        r.levelName.slice(0, 14).padEnd(15) +
        String(r.week).padEnd(5) +
        String(r.individual).padEnd(8) +
        grpLabel,
    );
  }

  // ── All GROUP tasks listed explicitly ─────────────────────────────────────

  if (group.length > 0) {
    console.log(
      "\n── GROUP tasks (listed in full) ─────────────────────────────────────",
    );
    console.log(
      "Title".padEnd(50) +
        "Track".padEnd(35) +
        "Level".padEnd(12) +
        "Wk".padEnd(5) +
        "Submissions",
    );
    console.log("─".repeat(115));
    for (const t of group) {
      console.log(
        t.title.slice(0, 49).padEnd(50) +
          t.cohort!.program.name.slice(0, 34).padEnd(35) +
          t.cohort!.level.name.slice(0, 11).padEnd(12) +
          String(t.opensWeek).padEnd(5) +
          String(t._count.submissions),
      );
    }
  } else {
    console.log("\nNo GROUP tasks found.");
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log(
    "\n── Summary ──────────────────────────────────────────────────────────",
  );
  console.log(`  Total tasks:        ${tasks.length}`);
  console.log(`  INDIVIDUAL tasks:   ${individual.length}`);
  console.log(`  GROUP tasks:        ${group.length}`);
  console.log(`  Tracks with tasks:  ${tracksWithTasks} of ${programs.length}`);
  console.log(
    `  Tracks without tasks: ${programs.length - tracksWithTasks} (shown above with note)`,
  );
  console.log();
  console.log(
    "No changes have been made. The Task Library will start empty —",
  );
  console.log(
    "all 120 existing tasks stay as one-off cohort tasks with no template link.",
  );
  console.log();

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
