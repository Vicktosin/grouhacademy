import { parseOfficeLifeContent } from "@/lib/office-life/content";
import { getPrisma } from "@/lib/prisma";

// Saving a track and level's Office Life plan, for the admin Office Life page
// (app/api/admin/internship/office-life) and admin scripts alike.

export async function saveOfficeLifeContent(programId: string, levelId: string, raw: unknown): Promise<{ error: string; status: number } | { ok: true }> {
  const content = parseOfficeLifeContent(raw);
  if (!content)
    return { error: "Check the workday schedule, unique day/step numbers, and meeting participants.", status: 400 };

  const prisma = getPrisma();
  const [track, level] = await Promise.all([
    prisma.internshipProgram.findUnique({ where: { id: programId }, select: { id: true } }),
    prisma.internshipLevel.findUnique({ where: { id: levelId }, select: { id: true, rank: true } }),
  ]);
  if (!track) return { error: "Track not found.", status: 404 };
  if (!level) return { error: "Level not found.", status: 404 };
  const scenarioIds = [...new Set(content.workdays.flatMap((day) => day.steps.flatMap((step) => step.kind === "work" && step.labScenarioId ? [step.labScenarioId] : [])))];
  if (scenarioIds.length) {
    const matching = await prisma.labScenario.findMany({
      where: { id: { in: scenarioIds }, programId: track.id, published: true, level: { rank: { lte: level.rank } } },
      select: { id: true },
    });
    if (matching.length !== scenarioIds.length)
      return { error: "Every linked Practice Lab exercise must be published, belong to this track, and be available at this level.", status: 400 };
  }
  await prisma.officeLifeContent.upsert({
    where: { programId_levelId: { programId: track.id, levelId: level.id } },
    create: { programId: track.id, levelId: level.id, content },
    update: { content },
  });
  return { ok: true };
}
