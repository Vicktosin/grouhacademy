import type { SubmissionStatus } from "@/generated/prisma/client";

export const MAX_SUBMISSION_LENGTH = 10_000;

/**
 * Whether an intern may (re)submit a task, given their existing submission.
 * Submissions a reviewer is working on, or has accepted, are locked. A
 * rejected or not-yet-reviewed submission can be replaced.
 */
export function resubmissionBlockedReason(
  status: SubmissionStatus | null | undefined,
): string | null {
  switch (status) {
    case "UNDER_REVIEW":
      return "Your submission is being reviewed and can't be changed right now.";
    case "ACCEPTED":
      return "Your submission has already been accepted.";
    default:
      return null;
  }
}
