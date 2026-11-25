import data from "@/data/curriculum.json";
import { MILESTONES } from "@/data/milestones";
import type { CurriculumTrack } from "@/lib/curriculum-view";

// The approved curriculum (data/curriculum.json): the single source for the
// public tracks page and the Task Library import.

export * from "@/lib/curriculum-view";

export const CURRICULUM: CurriculumTrack[] = (data as unknown as { tracks: CurriculumTrack[] }).tracks.map((track) => ({
  ...track,
  levels: track.levels.map((level) => {
    const [milestone, ...weeks] = MILESTONES[track.track][level.name];
    return {
      ...level,
      milestone,
      weeks: level.weeks.map((week) => ({ ...week, outcome: weeks[week.week - 1] })),
    };
  }),
}));
