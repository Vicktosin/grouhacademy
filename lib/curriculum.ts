import data from "@/data/curriculum.json";
import type { CurriculumTrack } from "@/lib/curriculum-view";

// The approved curriculum (data/curriculum.json): the single source for the
// public tracks page and the Task Library import.

export * from "@/lib/curriculum-view";

export const CURRICULUM = (data as unknown as { tracks: CurriculumTrack[] }).tracks;
