import { SubmissionStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import type {
  InternshipTaskItem,
  TaskStatusLabel,
  TaskTone,
} from "@/lib/internship-data";
import { formatWat, taskWindowState } from "@/lib/task-schedule";
import { submissionBlockedReason } from "@/lib/task-submission";

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

function displayName(user: { name: string | null; email: string }) {
  return user.name?.trim() || user.email;
}

function durationLabel(ms: number) {
  if (ms < MS_PER_HOUR)
    return `${Math.max(1, Math.round(ms / (1000 * 60)))} minutes`;
  if (ms < MS_PER_DAY) return `${Math.round(ms / MS_PER_HOUR)} hours`;
  const days = Math.round(ms / MS_PER_DAY);
  return `${days} day${days === 1 ? "" : "s"}`;
}

const REVIEW_STATUS: Record<
  SubmissionStatus,
  { status: TaskStatusLabel; tone: TaskTone } | null
> = {
  DRAFT: null,
  SUBMITTED: { status: "Submitted", tone: "green" },
  UNDER_REVIEW: { status: "Under review", tone: "green" },
  ACCEPTED: { status: "Passed", tone: "green" },
  REJECTED: { status: "Changes requested", tone: "red" },
};

/**
 * An intern's application, cohort and group: everything needed to decide
 * which tasks they see and whether they may submit.
 */
export async function getInternTaskContext(userId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    select: { programId: true, cohortId: true },
  });
  if (!application) return null;

  const membership = await prisma.internshipGroupMember.findUnique({
    where: {
      programId_userId: { programId: application.programId, userId },
    },
    select: {
      group: {
        select: {
          id: true,
          leaderId: true,
          leader: { select: { name: true, email: true } },
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              userId: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
  const group = membership?.group
    ? {
        id: membership.group.id,
        leaderId: membership.group.leaderId,
        leaderName: membership.group.leader
          ? displayName(membership.group.leader)
          : null,
        members: membership.group.members.map((member) => ({
          userId: member.userId,
          name: displayName(member.user),
        })),
      }
    : null;

  return { ...application, group };
}

export type InternTaskContext = NonNullable<
  Awaited<ReturnType<typeof getInternTaskContext>>
>;

/** The intern's view of every task in their cohort, in window order. */
export async function getInternTasks(
  userId: string,
  context: InternTaskContext,
): Promise<InternshipTaskItem[]> {
  if (!context.cohortId) return [];
  const { group } = context;
  const tasks = await getPrisma().internshipTask.findMany({
    where: { cohortId: context.cohortId },
    orderBy: [{ opensAt: "asc" }, { dueDate: "asc" }, { title: "asc" }],
    include: {
      submissions: {
        where: {
          OR: [
            { groupId: null, userId },
            ...(group ? [{ groupId: group.id }] : []),
          ],
        },
        include: {
          participants: { select: { userId: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const now = new Date();
  return tasks.map((task) => {
    const submission =
      task.kind === "GROUP"
        ? task.submissions.find((s) => group && s.groupId === group.id)
        : task.submissions.find((s) => s.groupId === null);
    const window = taskWindowState(task.opensAt, task.dueDate, now);
    const participantIds = submission?.participants.map((p) => p.userId) ?? [];
    const included =
      task.kind === "GROUP" && submission
        ? participantIds.includes(userId)
        : null;

    let label: { status: TaskStatusLabel; tone: TaskTone } | null = submission
      ? REVIEW_STATUS[submission.status]
      : null;
    if (submission && included === false)
      label = { status: "Not included", tone: "yellow" };
    if (!label)
      label =
        window === "UPCOMING"
          ? { status: "Not open yet", tone: "slate" }
          : window === "OPEN"
            ? { status: "Not submitted", tone: "slate" }
            : { status: "Missed", tone: "red" };

    // Interns left off a group submission get no credit for it.
    const credited = submission && included !== false;
    const score = credited ? submission.score : null;
    const blockedReason = submissionBlockedReason({
      task,
      existingStatus: submission?.status,
      group,
      userId,
      now,
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      kind: task.kind,
      labScenarioId: task.labScenarioId,
      labPassMark: task.labPassMark,
      weekLabel: `Week ${task.opensWeek}`,
      weekNumber: task.opensWeek,
      window,
      opensLabel: formatWat(task.opensAt),
      dueDateLabel: formatWat(task.dueDate),
      timeLeftLabel:
        window === "UPCOMING"
          ? `Opens in ${durationLabel(task.opensAt.getTime() - now.getTime())}`
          : window === "OPEN"
            ? `${durationLabel(task.dueDate.getTime() - now.getTime())} left`
            : "Closed",
      status: label.status,
      tone: label.tone,
      scoreLabel:
        score != null
          ? `${score}/${task.maxScore} marks`
          : `${task.maxScore} marks`,
      score,
      maxScore: task.maxScore,
      submittedAt: submission?.submittedAt.toISOString() ?? null,
      submission: submission
        ? {
            content:
              credited || group?.leaderId === userId
                ? submission.content
                : null,
            feedback: credited ? submission.feedback : null,
          }
        : null,
      canSubmit: blockedReason === null,
      blockedReason,
      group:
        task.kind === "GROUP" && group
          ? {
              isLeader: group.leaderId === userId,
              leaderId: group.leaderId,
              leaderName: group.leaderName,
              members: group.members,
              participantIds,
              submittedByName: submission ? displayName(submission.user) : null,
              included,
            }
          : null,
    };
  });
}
