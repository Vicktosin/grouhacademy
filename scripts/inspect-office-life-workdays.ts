// Read-only: inspect saved/effective Office Life workdays and linked cohort tasks.
import { config } from "dotenv";
import { getPrisma } from "../lib/prisma";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "../lib/office-life/content";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local", quiet: true });
const prisma = getPrisma();
async function main() {
  const cohorts = await prisma.internshipCohort.findMany({
    where: { status: "ACTIVE", program: { status: "PUBLISHED" } },
    include: {
      program: { select: { name: true } },
      level: { select: { name: true } },
      tasks: { select: { title: true, officeLifeDay: true, opensWeek: true } },
    },
  });
  for (const cohort of cohorts) {
    const saved = await prisma.officeLifeContent.findUnique({
      where: { programId_levelId: { programId: cohort.programId, levelId: cohort.levelId } },
      select: { content: true },
    });
    const parsed = parseOfficeLifeContent(saved?.content);
    const content = parsed ?? defaultOfficeLifeContent(cohort.program.name, cohort.level.name);
    const workday2 = content.workdays.find(day => day.day === 2);
    console.log(JSON.stringify({
      track: cohort.program.name,
      source: parsed ? "saved admin configuration" : "application default",
      workdays: content.workdays.map(day => ({ day: day.day, title: day.title, opensWeek: day.opensWeek })),
      workday2: workday2 && {
        day: workday2.day, title: workday2.title, summary: workday2.summary,
        opensWeek: workday2.opensWeek, opensDay: workday2.opensDay, opensTime: workday2.opensTime,
        dueWeek: workday2.dueWeek, dueDay: workday2.dueDay, dueTime: workday2.dueTime,
        steps: workday2.steps.map(step => ({ kind: step.kind, title: step.title })),
      },
      linkedTasks: cohort.tasks.filter(task => task.officeLifeDay !== null),
    }));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
