// The approved curriculum (data/curriculum.json): the single source for the
// public tracks page and the Task Library import. No database code, so any
// page can use it.

export type CurriculumTask = {
  title: string;
  instructions: string;
  where: "In-app" | "Out-app";
  kind: "Practical" | "Theory";
  submit: string;
  capstone: boolean;
};
export type CurriculumWeek = {
  /** "By the end of this week you can..." (data/milestones). */
  outcome: string;
  week: number; topic: string; capstone: boolean; officeLifeDay: number; tasks: CurriculumTask[] };
export type CurriculumLevel = {
  /** What the intern has finished at the end of the level. */
  milestone: string;
  level: number; name: string; weeks: CurriculumWeek[] };
export type CurriculumTrack = { track: string; levels: CurriculumLevel[] };

export function trackSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type TaskPart = "main" | "lab" | "office";

export function taskPart(task: CurriculumTask): TaskPart {
  if (task.title.startsWith("Office Life")) return "office";
  return task.title.startsWith("Practice Lab") ? "lab" : "main";
}

/** "Practice Lab: Practise this week's topic: X" reads better as "Practice Lab: X". */
export function plainTitle(task: CurriculumTask) {
  return task.title.replace("Practise this week's topic: ", "");
}

/** What a task is, however often it's imported: track, level, week and part. */
export function curriculumKey(track: string, level: string, week: number, part: TaskPart) {
  return `${trackSlug(track)}/${level.toLowerCase()}/w${week}/${part}`;
}

/** One line about each track, for the website and for creating a new track. */
export const TRACK_DESCRIPTIONS: Record<string, string> = {
  "Social Media Marketing": "Plan, create and manage content that grows brands on social platforms.",
  "Digital Marketing": "Help businesses find customers online with search, ads, email and analytics.",
  "AI for Content Creation": "Use AI tools to write, design and make videos people want to see.",
  "AI Automation": "Connect apps and AI so that repeated work does itself.",
  "Front-End Development": "Build the screens people see and use on websites and apps.",
  "Back-End Engineering": "Build the APIs, databases and logic behind apps.",
  "WordPress Development": "Build and run business websites and online stores with WordPress.",
  "Virtual Assistant": "Support clients from anywhere: email, calendars, research, customers and admin.",
  Cybersecurity: "Protect people and companies from scams, leaks and attacks.",
};
