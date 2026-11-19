// How an intern learns a level: self-paced (start now, own schedule) or
// with the next cohort. Pure rules, shared by the server (lib/learning-mode)
// and tests (tests/learning-mode.test.ts).

export type LearningModeValue = "SELF_PACED" | "COHORT";
export type LearningModePolicyValue = "CHOOSE" | "COHORT_ONLY" | "SELF_PACED_ONLY";

export type ChoiceInput = {
  policy: LearningModePolicyValue;
  /** The track always uses cohorts (InternshipProgram.excludeFromSelfPacedAndPools). */
  programExcluded: boolean;
  /** The next cohort for this track and level that hasn't started, if any. */
  nextCohort: { id: string; name: string; startDate: Date } | null;
  now?: Date;
};

export type CohortOption = {
  available: boolean;
  /** No upcoming cohort: joining means the waiting list. */
  waitlist: boolean;
  startDate: string | null;
  daysLeft: number | null;
  cohortName: string | null;
};

export type ChoiceOptions = {
  selfPaced: { available: boolean };
  cohort: CohortOption;
  /** One plain sentence when only one way is offered. */
  note: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(date: Date, now = new Date()) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}

/** Which ways an intern may learn this level, and why when only one. */
export function choiceOptions({ policy, programExcluded, nextCohort, now = new Date() }: ChoiceInput): ChoiceOptions {
  const cohortDetails = nextCohort
    ? {
        waitlist: false,
        startDate: nextCohort.startDate.toISOString(),
        daysLeft: daysUntil(nextCohort.startDate, now),
        cohortName: nextCohort.name,
      }
    : { waitlist: true, startDate: null, daysLeft: null, cohortName: null };

  if (programExcluded)
    return {
      selfPaced: { available: false },
      cohort: { available: true, ...cohortDetails },
      note: "This track is only taught in cohorts, so you'll learn with a group.",
    };
  if (policy === "COHORT_ONLY")
    return {
      selfPaced: { available: false },
      cohort: { available: true, ...cohortDetails },
      note: "Right now everyone learns with a cohort.",
    };
  if (policy === "SELF_PACED_ONLY")
    return {
      selfPaced: { available: true },
      cohort: { available: false, ...cohortDetails },
      note: "Right now everyone learns at their own pace.",
    };
  // Interns choose; with no cohort coming up, self-paced is the way to start.
  if (!nextCohort)
    return {
      selfPaced: { available: true },
      cohort: { available: false, ...cohortDetails },
      note: "There's no new cohort scheduled for your track yet, so you can start now at your own pace.",
    };
  return { selfPaced: { available: true }, cohort: { available: true, ...cohortDetails }, note: null };
}

/**
 * The way an intern is learning now, including interns from before the
 * choice existed: a cohort wins, then self-paced, else not chosen yet.
 */
export function effectiveLearningMode(application: {
  learningMode: LearningModeValue | null;
  cohortId: string | null;
  selfPacedStartDate: Date | null;
}): LearningModeValue | null {
  if (application.cohortId) return "COHORT";
  if (application.learningMode) return application.learningMode;
  if (application.selfPacedStartDate) return "SELF_PACED";
  return null;
}

/** What the admin pages show: Self-paced, Cohort, Waiting or Choosing. */
export function learningStatusLabel(application: {
  learningMode: LearningModeValue | null;
  cohortId: string | null;
  selfPacedStartDate: Date | null;
}): "Self-paced" | "Cohort" | "Waiting" | "Choosing" {
  const mode = effectiveLearningMode(application);
  if (mode === "SELF_PACED") return "Self-paced";
  if (mode === "COHORT") return application.cohortId ? "Cohort" : "Waiting";
  return "Choosing";
}

/** A self-paced intern may join the next cohort once per level. */
export function canSwitchToCohort(
  application: { learningMode: LearningModeValue | null; cohortId: string | null; selfPacedStartDate: Date | null; switchedToCohortAt: Date | null },
  options: Pick<ChoiceInput, "programExcluded" | "policy" | "nextCohort">,
) {
  if (effectiveLearningMode(application) !== "SELF_PACED") return false;
  if (application.switchedToCohortAt) return false;
  if (options.policy === "SELF_PACED_ONLY") return false;
  return Boolean(options.nextCohort);
}

/** What paying decides on its own: the mode when only one is allowed. */
export function automaticModeOnPayment(policy: LearningModePolicyValue, programExcluded: boolean): LearningModeValue | null {
  if (programExcluded || policy === "COHORT_ONLY") return "COHORT";
  if (policy === "SELF_PACED_ONLY") return "SELF_PACED";
  return null;
}

/** The old on/off switch, kept in step with the policy. */
export function cohortSystemEnabledFor(policy: LearningModePolicyValue) {
  return policy !== "SELF_PACED_ONLY";
}

// ── Task Library: cohort task dates → week/day/time offsets ──────────────

const WAT_OFFSET_MS = 60 * 60 * 1000; // West Africa Time, UTC+1 (no DST)

function watParts(date: Date) {
  const wat = new Date(date.getTime() + WAT_OFFSET_MS);
  return {
    dayNumber: Math.floor(wat.getTime() / (24 * 60 * 60 * 1000)),
    time: `${String(wat.getUTCHours()).padStart(2, "0")}:${String(wat.getUTCMinutes()).padStart(2, "0")}`,
  };
}

/**
 * A cohort task's date as a schedule point from the cohort's start (WAT
 * calendar days): week 1 day 1 is the start day. Before the start counts as
 * week 1 day 1 (tasks often open the evening before).
 */
export function scheduleOffset(cohortStart: Date, date: Date) {
  const start = watParts(cohortStart);
  const point = watParts(date);
  const dayIndex = Math.max(0, point.dayNumber - start.dayNumber);
  const time = point.dayNumber < start.dayNumber ? "00:00" : point.time;
  return { week: Math.floor(dayIndex / 7) + 1, day: (dayIndex % 7) + 1, time };
}
