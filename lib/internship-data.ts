export type TaskStatusLabel =
  | "Not open yet"
  | "Not submitted"
  | "Missed"
  | "Submitted"
  | "Under review"
  | "Passed"
  | "Changes requested"
  | "Not included";

export type TaskTone = "yellow" | "slate" | "green" | "red";

export type TaskWindow = "UPCOMING" | "OPEN" | "CLOSED";

export type InternshipTaskGroupInfo = {
  isLeader: boolean;
  leaderId: string | null;
  leaderName: string | null;
  members: { userId: string; name: string }[];
  /** Members credited on the group's submission, if there is one. */
  participantIds: string[];
  submittedByName: string | null;
  /** Whether this intern is credited on the group submission (null: none yet). */
  included: boolean | null;
};

export type InternshipTaskItem = {
  id: string;
  title: string;
  description: string | null;
  kind: "INDIVIDUAL" | "GROUP";
  weekLabel: string;
  weekNumber: number;
  window: TaskWindow;
  opensLabel: string;
  dueDateLabel: string;
  timeLeftLabel: string;
  status: TaskStatusLabel;
  tone: TaskTone;
  scoreLabel: string;
  score: number | null;
  maxScore: number;
  submittedAt: string | null;
  submission: { content: string | null; feedback: string | null } | null;
  canSubmit: boolean;
  blockedReason: string | null;
  /** Present for group tasks when the intern is in a group. */
  group: InternshipTaskGroupInfo | null;
  /** Practice Lab exercise this task is done in, if any. */
  labScenarioId: string | null;
  /** Lab percentage needed to pass, for Practice Lab tasks. */
  labPassMark: number;
  /** Work-Life week this task launches, if selected as the task destination. */
  officeLifeDay: number | null;
  /** Office Life tasks: the linked workday, which decides the task (lib/office-life/tasks). */
  officeLife: InternshipOfficeLifeInfo | null;
};

export type InternshipOfficeLifeInfo = {
  day: number;
  title: string | null;
  state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  /** "Not started", "In progress (X of Y steps done)" or "Completed and submitted". */
  statusLabel: string;
  stepsDone: number;
  stepsTotal: number;
  /** When the workday is open (null: no cohort yet, or the workday isn't set up). */
  window: TaskWindow | null;
  opensLabel: string | null;
  dueLabel: string | null;
  completedLabel: string | null;
};

export type InternshipAlert = {
  id: string;
  text: string;
  tone: "orange" | "green" | "red" | "slate";
  postedLabel: string;
};

export type InternshipTaskListResponse = {
  hasProgram: boolean;
  /** False when the intern has not been placed in a cohort yet. */
  hasCohort: boolean;
  tasks: InternshipTaskItem[];
  stats: {
    pending: number;
    submitted: number;
    overdue: number;
    activeIndividual: number;
    activeGroup: number;
  };
  alerts: InternshipAlert[];
};
