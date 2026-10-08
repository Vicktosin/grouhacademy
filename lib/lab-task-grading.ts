// Grades a task from its linked Practice Lab exercise: the lab percentage
// against the task's pass mark. Kept free of database code so it can be
// tested on its own.

export const DEFAULT_LAB_PASS_MARK = 70;

/** A valid pass mark (1–100), or null. */
export function parseLabPassMark(value: unknown): number | null {
  const mark = Number(value);
  return Number.isInteger(mark) && mark >= 1 && mark <= 100 ? mark : null;
}

/**
 * Coding exercises: the checks run in the intern's browser, so only results
 * for the exercise's own checks count, and a check with no result fails.
 */
export function scoreCodeChecks(
  checkLabels: string[],
  results: Array<{ label: string; passed: boolean }>,
) {
  const passedLabels = new Set(
    results.filter((result) => result.passed).map((result) => result.label),
  );
  const missed = checkLabels.filter((label) => !passedLabels.has(label));
  const percent = checkLabels.length
    ? Math.round(((checkLabels.length - missed.length) / checkLabels.length) * 100)
    : 0;
  return { percent, missed };
}

export type LabTaskGrade = {
  status: "ACCEPTED" | "REJECTED";
  passed: boolean;
  percent: number;
  score: number;
  feedback: string;
};

export function gradeLabTask({
  percent,
  passMark,
  maxScore,
  missed,
  missedLabel,
}: {
  percent: number;
  passMark: number;
  maxScore: number;
  /** Checks or goals not met. */
  missed: string[];
  /** "checks" or "goals", for the feedback. */
  missedLabel: string;
}): LabTaskGrade {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const passed = safe >= passMark;
  const lines = [
    passed
      ? `Passed in the Practice Lab: ${safe}% (pass mark ${passMark}%).`
      : `Not passed yet: ${safe}% in the Practice Lab, and the pass mark is ${passMark}%. Improve your work in the Practice Lab and submit again before the deadline.`,
  ];
  if (missed.length)
    lines.push(
      "",
      `${missedLabel[0].toUpperCase()}${missedLabel.slice(1)} not met:`,
      ...missed.map((label) => `• ${label}`),
    );
  return {
    status: passed ? "ACCEPTED" : "REJECTED",
    passed,
    percent: safe,
    score: Math.round((safe / 100) * maxScore),
    feedback: lines.join("\n"),
  };
}
