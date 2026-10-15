// One-off job, 14 October 2026: the October cohorts' first week was rushed,
// so the count restarts and this week (Wed 14 Oct) becomes Week 2.
//
//   Part A: each running October cohort starts Wed 7 Oct 2026 and ends Tue
//           3 Nov 2026, 23:59 WAT. Existing tasks keep their exact open and
//           due times (re-expressed against the new start), so Week 1 work
//           and its windows stay exactly as they were.
//   Part B: Office Life workday 1 runs in Week 2 (14–20 Oct), workday 2 in
//           Week 3, workday 3 in Week 4; workday 4 in Week 5, after these
//           cohorts end. Only the schedule changes, never the content. Interns
//           who already clocked in keep a copy of the day's schedule in their
//           progress, so that copy gets the same new schedule (nothing else
//           in their progress is touched).
//   Part C: the Week 2 tasks (see WEEK2_TASKS), unless a cohort already has them.
//
// Everything goes through the admin pages' own services (lib/cohort-admin,
// lib/office-life/admin, lib/task-admin), so their validation runs.
//
//   npx tsx scripts/october-2026-week2-reset.ts            # show what would change
//   npx tsx scripts/october-2026-week2-reset.ts --apply    # change it
//
// Safe to run again: anything already done is skipped. The first --apply run
// saves every old value to scripts/backups/october-2026-week2-reset.<project>.json
// (never overwritten); see UNDO in that file.

import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getPrisma } from "../lib/prisma";
import { updateCohort } from "../lib/cohort-admin";
import { saveOfficeLifeContent } from "../lib/office-life/admin";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "../lib/office-life/content";
import { createTask, updateTask } from "../lib/task-admin";
import { scheduleToDate, type SchedulePoint } from "../lib/task-schedule";
import { WEEK2_TASKS } from "./october-2026-week2-tasks";

const apply = process.argv.includes("--apply");
// One file per database (the Supabase project), so a trial run elsewhere never mixes in.
const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^"|"$/g, "") || "https://unknown").hostname.split(".")[0];
const BACKUP = `scripts/backups/october-2026-week2-reset.${project}.json`;

// The running October cohorts on 14 Oct 2026 (Special Class is left alone:
// it has no interns or tasks, isn't one of the seven tracks, and runs to December).
const COHORT_IDS = [
  "cmua6pz32000004id51retkvv", // October Back-End Engineering
  "cmua5l4iz000404jpwjkutmb0", // October Front-End Development
  "cmu80ulmx001901yeofhjtxez", // October Digital Marketing Cohort
  "cmua882af000004lb80kxb3bp", // October Social Media Marketing Cohort
  "cmuaakcs0000204ilby88if7v", // October WordPress Development
  "cmua5zs3t000104iaj9wlrryo", // October AI for Content Creation
  "cmua50zlp000204jppwg0cc70", // October AI Automation
];
// Week 1 day 1 = Wed 7 Oct (stored like the admin form's dates, midnight UTC).
const NEW_START = new Date("2026-10-07T00:00:00.000Z");
// Tue 3 Nov 2026, 23:59 WAT.
const NEW_END = new Date("2026-11-03T22:59:00.000Z");
// Office Life: workday N in week N + 1 (workday 4 in week 5, after these cohorts end).
const workdaySchedule = (day: number) => ({
  opensWeek: day + 1, opensDay: 1, opensTime: "09:00",
  dueWeek: day + 1, dueDay: 7, dueTime: "23:59",
});

const DAY_MS = 86_400_000;
const WAT_MS = 3_600_000;
const watDay = (date: Date) => Math.floor((date.getTime() + WAT_MS) / DAY_MS);

/** The week/day/time point (from `start`) that lands exactly on `date`. */
function pointFor(start: Date, date: Date): SchedulePoint {
  const days = watDay(date) - watDay(start);
  const minutes = Math.round(((date.getTime() + WAT_MS) % DAY_MS) / 60_000);
  const point = {
    week: Math.floor(days / 7) + 1,
    day: (days % 7) + 1,
    time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
  };
  if (days < 0 || scheduleToDate(start, point).getTime() !== date.getTime())
    throw new Error(`Can't express ${date.toISOString()} from ${start.toISOString()}.`);
  return point;
}

const log = (line: string) => console.log(`${apply ? "" : "[dry run] "}${line}`);

async function backup() {
  const prisma = getPrisma();
  const cohorts = await prisma.internshipCohort.findMany({
    where: { id: { in: COHORT_IDS } },
    select: {
      id: true, name: true, slug: true, status: true, programId: true, levelId: true, description: true,
      startDate: true, endDate: true, certificatePassMark: true,
      tasks: { select: { id: true, title: true, moduleId: true, opensWeek: true, opensDay: true, opensTime: true, dueWeek: true, dueDay: true, dueTime: true, opensAt: true, dueDate: true } },
    },
  });
  const pairs = [...new Map(cohorts.map((c) => [`${c.programId}:${c.levelId}`, { programId: c.programId, levelId: c.levelId }])).values()];
  const officeLifeContent = await prisma.officeLifeContent.findMany({
    where: { OR: pairs },
    select: { programId: true, levelId: true, content: true },
  });
  const interns = await prisma.internshipApplication.findMany({ where: { cohortId: { in: COHORT_IDS } }, select: { studentId: true } });
  const days = await prisma.officeLifeDay.findMany({
    where: { userId: { in: interns.map((i) => i.studentId) }, OR: pairs },
    select: { id: true, userId: true, day: true, state: true },
  });
  return {
    savedAt: new Date().toISOString(),
    UNDO: [
      "Cohorts: in Admin > Cohorts, set each cohort's start and end date back to startDate/endDate below. Saving moves its tasks' windows back with it; then set any task listed under tasks back to its week/day/time values below.",
      "Office Life plans: officeLifeContent lists the saved plans that existed before (none means the built-in default was in use). For a track and level not listed, press 'Restore defaults' in Admin > Office Life for that track and level (it removes the saved plan, nothing else).",
      "Office Life progress: officeLifeDaySchedules has each record's workday schedule before the change; only these six fields were changed in state.workday.",
      "Week 2 tasks: listed in the report; delete them in Admin > Tasks only if no intern has submitted them.",
    ],
    cohorts,
    officeLifeContent,
    officeLifeDaySchedules: days.map((d) => {
      const w = (d.state as { workday?: Record<string, unknown> }).workday;
      return { id: d.id, userId: d.userId, day: d.day, schedule: w ? Object.fromEntries(["opensWeek", "opensDay", "opensTime", "dueWeek", "dueDay", "dueTime"].map((k) => [k, w[k]])) : null };
    }),
  };
}

async function partA(original: Awaited<ReturnType<typeof backup>>) {
  const prisma = getPrisma();
  for (const old of original.cohorts) {
    const cohort = await prisma.internshipCohort.findUniqueOrThrow({ where: { id: old.id } });
    if (cohort.startDate.getTime() !== NEW_START.getTime() || cohort.endDate.getTime() !== NEW_END.getTime()) {
      log(`${cohort.name}: ${cohort.startDate.toISOString()} – ${cohort.endDate.toISOString()} → ${NEW_START.toISOString()} – ${NEW_END.toISOString()}`);
      if (apply) {
        const result = await updateCohort({
          id: cohort.id, name: cohort.name, programId: cohort.programId, levelId: cohort.levelId,
          description: cohort.description ?? "", certificatePassMark: cohort.certificatePassMark,
          startDate: NEW_START.toISOString(), endDate: NEW_END.toISOString(),
        });
        if ("error" in result) throw new Error(`${cohort.name}: ${result.error}`);
      }
    } else log(`${cohort.name}: dates already set`);

    // Tasks that existed before keep their exact open and due times.
    for (const before of old.tasks) {
      const task = await prisma.internshipTask.findUniqueOrThrow({ where: { id: before.id } });
      const opensAt = new Date(before.opensAt);
      const dueDate = new Date(before.dueDate);
      if (apply && task.opensAt.getTime() === opensAt.getTime() && task.dueDate.getTime() === dueDate.getTime()) continue;
      const opens = pointFor(NEW_START, opensAt);
      const due = pointFor(NEW_START, dueDate);
      log(`  "${task.title}": keeps ${opensAt.toISOString()} → ${dueDate.toISOString()} as w${opens.week}d${opens.day} ${opens.time} → w${due.week}d${due.day} ${due.time}`);
      if (!apply) continue;
      const result = await updateTask(task.id, {
        title: task.title, cohortId: task.cohortId, description: task.description ?? "", kind: task.kind,
        labScenarioId: task.labScenarioId, labPassMark: task.labPassMark, officeLifeDay: task.officeLifeDay,
        opensWeek: opens.week, opensDay: opens.day, opensTime: opens.time,
        dueWeek: due.week, dueDay: due.day, dueTime: due.time,
      });
      if ("error" in result) throw new Error(`"${task.title}": ${result.error}`);
      const saved = await prisma.internshipTask.findUniqueOrThrow({ where: { id: task.id } });
      if (saved.opensAt.getTime() !== opensAt.getTime() || saved.dueDate.getTime() !== dueDate.getTime())
        throw new Error(`"${task.title}" times changed.`);
    }
  }
}

async function partB(original: Awaited<ReturnType<typeof backup>>) {
  const prisma = getPrisma();
  const pairs = [...new Map(original.cohorts.map((c) => [`${c.programId}:${c.levelId}`, c])).values()];
  for (const cohort of pairs) {
    const [program, level, saved] = await Promise.all([
      prisma.internshipProgram.findUniqueOrThrow({ where: { id: cohort.programId }, select: { name: true } }),
      prisma.internshipLevel.findUniqueOrThrow({ where: { id: cohort.levelId }, select: { name: true } }),
      prisma.officeLifeContent.findUnique({ where: { programId_levelId: { programId: cohort.programId, levelId: cohort.levelId } } }),
    ]);
    // The plan in use (saved, or the built-in default), with only the schedule changed.
    const plan = parseOfficeLifeContent(saved?.content) ?? defaultOfficeLifeContent(program.name, level.name);
    const changed = plan.workdays.some((w) => Object.entries(workdaySchedule(w.day)).some(([k, v]) => w[k as keyof typeof w] !== v));
    log(`Office Life plan, ${program.name} (${level.name}): ${changed ? "set" : "already set"}: ${plan.workdays.map((w) => `day ${w.day} w${w.opensWeek}→w${workdaySchedule(w.day).opensWeek}`).join(", ")}`);
    if (changed && apply) {
      const result = await saveOfficeLifeContent(cohort.programId, cohort.levelId, { ...plan, workdays: plan.workdays.map((w) => ({ ...w, ...workdaySchedule(w.day) })) });
      if ("error" in result) throw new Error(`${program.name}: ${result.error}`);
    }
  }
  // Clocked-in interns' own copy of the day's schedule: the same new schedule.
  // Only those six fields, in one statement, so a step being saved isn't lost.
  for (const row of original.officeLifeDaySchedules) {
    if (!row.schedule) continue;
    const target = workdaySchedule(row.day);
    const current = await prisma.officeLifeDay.findUniqueOrThrow({ where: { id: row.id }, select: { state: true } });
    const workday = (current.state as { workday?: Record<string, unknown> }).workday ?? {};
    if (Object.entries(target).every(([k, v]) => workday[k] === v)) continue;
    log(`  intern progress ${row.id} (workday ${row.day}): schedule w${workday.opensWeek} → w${target.opensWeek}`);
    if (apply)
      await prisma.$executeRaw`UPDATE "OfficeLifeDay" SET state = jsonb_set(state, '{workday}', (state->'workday') || ${JSON.stringify(target)}::jsonb), "updatedAt" = now() WHERE id = ${row.id} AND state ? 'workday'`;
  }
}

async function partC() {
  const prisma = getPrisma();
  const created: string[] = [];
  for (const cohortId of COHORT_IDS) {
    const cohort = await prisma.internshipCohort.findUniqueOrThrow({
      where: { id: cohortId },
      select: { name: true, program: { select: { name: true } }, tasks: { select: { id: true, title: true } } },
    });
    for (const task of WEEK2_TASKS(cohort.program.name)) {
      const duplicate = cohort.tasks.find((t) => task.matches.test(t.title));
      if (duplicate) {
        log(`${cohort.name}: "${task.title}" already exists as "${duplicate.title}" (${duplicate.id}), skipped`);
        continue;
      }
      log(`${cohort.name}: create "${task.title}" (${task.description.length} characters)`);
      if (!apply) continue;
      const result = await createTask({
        title: task.title, cohortId, description: task.description, kind: "INDIVIDUAL",
        labScenarioId: null, officeLifeDay: task.officeLifeDay,
        opensWeek: 2, opensDay: 1, opensTime: "00:00", dueWeek: 2, dueDay: 7, dueTime: "23:59",
      });
      if ("error" in result) throw new Error(`${cohort.name} "${task.title}": ${result.error}`);
      created.push(result.taskId);
    }
  }
  return created;
}

async function main() {
  const prisma = getPrisma();
  console.log(`Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  const now = new Date();
  for (const id of COHORT_IDS) {
    const cohort = await prisma.internshipCohort.findUniqueOrThrow({ where: { id }, select: { name: true, startDate: true, endDate: true } });
    if (!(cohort.startDate <= now && cohort.endDate >= now)) throw new Error(`${cohort.name} isn't running.`);
  }
  let original: Awaited<ReturnType<typeof backup>>;
  if (existsSync(BACKUP)) {
    original = JSON.parse(readFileSync(BACKUP, "utf8"));
    console.log(`Old values: ${BACKUP} (saved ${original.savedAt})`);
  } else {
    original = await backup();
    if (apply) {
      mkdirSync("scripts/backups", { recursive: true });
      writeFileSync(BACKUP, `${JSON.stringify(original, null, 2)}\n`);
      console.log(`Old values saved to ${BACKUP}`);
    }
  }
  const parts = process.argv.find((arg) => arg.startsWith("--parts="))?.slice(8) ?? "ABC";
  if (parts.includes("A")) await partA(original);
  if (parts.includes("B")) await partB(original);
  if (parts.includes("C")) {
    const created = await partC();
    if (created.length) console.log(`Created tasks: ${created.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
