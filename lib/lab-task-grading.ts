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

/** Code without comments or spacing, to compare with the starter. */
function essence(code: string) {
  return code
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, "");
}

/**
 * Code exercises' checks run in the intern's browser, so a passing result
 * could be faked. These are signs a pass needs a mentor's look (empty when
 * nothing looks wrong): the code is still the starter code, or the results
 * sent don't match the exercise's checks (edited by hand). Cheap: uses only
 * what the submission already contains.
 */
export function codeSubmissionFlags({
  starter,
  files,
  checkLabels,
  results,
}: {
  starter: Record<string, string>;
  files: Record<string, string>;
  checkLabels: string[];
  results: Array<{ label: string }>;
}) {
  const flags: string[] = [];
  const names = Object.keys(starter);
  if (names.length && names.every((name) => essence(files[name] ?? "") === essence(starter[name] ?? "")))
    flags.push("The submitted code is the same as the starter code, yet the checks were reported as passing.");
  const known = new Set(checkLabels);
  const seen = new Set<string>();
  const tampered = results.some((result) => {
    const bad = !known.has(result.label) || seen.has(result.label);
    seen.add(result.label);
    return bad;
  });
  if (tampered || results.length > checkLabels.length)
    flags.push("The check results sent don't match this exercise's checks, so they may have been edited.");
  return flags;
}

export type LabTaskGrade = {
  status: "ACCEPTED" | "REJECTED" | "UNDER_REVIEW";
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
  needsReview = false,
}: {
  percent: number;
  passMark: number;
  maxScore: number;
  /** Checks or goals not met. */
  missed: string[];
  /** "checks" or "goals", for the feedback. */
  missedLabel: string;
  /** A pass that a mentor should confirm (see codeSubmissionFlags). */
  needsReview?: boolean;
}): LabTaskGrade {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const passed = safe >= passMark;
  const pending = passed && needsReview;
  const lines = [
    pending
      ? `Practice Lab result: ${safe}% (pass mark ${passMark}%). A mentor will confirm it shortly.`
      : passed
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
    status: pending ? "UNDER_REVIEW" : passed ? "ACCEPTED" : "REJECTED",
    passed,
    percent: safe,
    score: Math.round((safe / 100) * maxScore),
    feedback: lines.join("\n"),
  };
}
