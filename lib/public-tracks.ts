import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// The internship tracks and their curriculum, as the public site shows them
// (homepage cards and /tracks). The curriculum is each track's own tasks by
// level and week; only their titles are public.

export type PublicTrackLevel = {
  name: string;
  weeks: { week: number; topics: string[] }[];
};

export type PublicTrack = {
  slug: string;
  name: string;
  description: string;
  duration: string;
  levels: PublicTrackLevel[];
  topicCount: number;
};

export async function listPublicTracks(db: PrismaClient = getPrisma()): Promise<PublicTrack[]> {
  const programs = await db.internshipProgram.findMany({
    where: { status: "PUBLISHED", taskTemplates: { some: { archived: false } } },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      description: true,
      duration: true,
      taskTemplates: {
        // Office Life is the same workday practice on every track.
        where: { archived: false, officeLifeDay: null, NOT: { title: { startsWith: "Office Life" } } },
        orderBy: [{ level: { rank: "asc" } }, { opensWeek: "asc" }, { opensDay: "asc" }, { title: "asc" }],
        select: { title: true, opensWeek: true, level: { select: { name: true } } },
      },
    },
  });
  return programs.map(({ taskTemplates, duration, ...program }) => {
    const levels: PublicTrackLevel[] = [];
    for (const { title, opensWeek, level } of taskTemplates) {
      let current = levels.find((item) => item.name === level.name);
      if (!current) levels.push((current = { name: level.name, weeks: [] }));
      let week = current.weeks.find((item) => item.week === opensWeek);
      if (!week) current.weeks.push((week = { week: opensWeek, topics: [] }));
      week.topics.push(title);
    }
    return {
      ...program,
      duration: duration.replace(/^1 months?$/i, "1 month"),
      levels,
      topicCount: taskTemplates.length,
    };
  });
}

/** Never breaks a page or the build if the database can't be reached. */
export async function getPublicTracks(): Promise<PublicTrack[]> {
  try {
    return await listPublicTracks();
  } catch (error) {
    console.error("Unable to load the public tracks", error);
    return [];
  }
}
