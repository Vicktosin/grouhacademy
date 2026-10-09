import type { Prisma, SubmissionStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Task submission history: every version submitted and every grade given
// (TaskSubmissionEvent). Written wherever a submission changes: the intern's
// submit route, mentor and admin grading, and the Practice Lab's automatic
// grading. Admins and mentors see it; interns see only the latest.

type Db = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export type SubmissionEventInput = Omit<Prisma.TaskSubmissionEventUncheckedCreateInput, "id" | "createdAt">;

export function recordSubmissionEvent(db: Db, event: SubmissionEventInput) {
  return db.taskSubmissionEvent.create({ data: event, select: { id: true } });
}

/** Statuses that are a grade (and so can be changed by whoever may). */
const GRADED: SubmissionStatus[] = ["ACCEPTED", "REJECTED"];

/**
 * Whether this person may grade the submission now: anything waiting for
 * review, or a grade already given if they're an admin or gave it.
 */
export function canGrade(
  who: { role: "ADMIN" | "MENTOR"; userId: string },
  submission: { status: SubmissionStatus; reviewedById: string | null },
) {
  if (submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW") return true;
  if (!GRADED.includes(submission.status)) return false;
  return who.role === "ADMIN" || submission.reviewedById === who.userId;
}

/** The submission's history, oldest first, with who did each thing. */
export async function submissionHistory(submissionId: string) {
  const events = await getPrisma().taskSubmissionEvent.findMany({
    where: { submissionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      content: true,
      fileUrl: true,
      status: true,
      score: true,
      feedback: true,
      actorRole: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
  return events.map(({ actor, createdAt, ...event }) => ({
    ...event,
    at: createdAt.toISOString(),
    actorName: actor ? actor.name?.trim() || actor.email : null,
  }));
}

export type SubmissionHistoryEntry = Awaited<ReturnType<typeof submissionHistory>>[number];
