import type { SubmissionStatus } from "@/generated/prisma/client";
import { formatWat, taskWindowState } from "@/lib/task-schedule";

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
      return "This submission is being reviewed and can't be changed right now.";
    case "ACCEPTED":
      return "This submission has already been accepted.";
    default:
      return null;
  }
}

/**
 * The single rule for who may submit a task right now. Returns why not, or
 * null when submitting is allowed. Used by both the task list and the
 * submit endpoint so they always agree.
 */
export function submissionBlockedReason({
  task,
  existingStatus,
  group,
  userId,
  now = new Date(),
}: {
  task: { kind: "INDIVIDUAL" | "GROUP"; opensAt: Date; dueDate: Date };
  existingStatus: SubmissionStatus | null | undefined;
  group: { leaderId: string | null; leaderName: string | null } | null;
  userId: string;
  now?: Date;
}): string | null {
  const window = taskWindowState(task.opensAt, task.dueDate, now);
  if (window === "UPCOMING")
    return `This task opens ${formatWat(task.opensAt)} (WAT).`;
  if (window === "CLOSED")
    return `The submission window closed ${formatWat(task.dueDate)} (WAT).`;

  if (task.kind === "GROUP") {
    if (!group)
      return "You'll be able to take part once you're placed in a group.";
    if (!group.leaderId)
      return "Your group doesn't have a leader yet, so group tasks can't be submitted. Please contact the academy team.";
    if (group.leaderId !== userId)
      return `Only your group leader${group.leaderName ? ` (${group.leaderName})` : ""} can submit group tasks.`;
  }

  return resubmissionBlockedReason(existingStatus);
}
