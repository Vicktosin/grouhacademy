import {
  InternshipApplicationStatus,
  MentorAssignmentStatus,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  lockCohortGroups,
  reassignLeaderIfNeeded,
} from "@/lib/internship-groups";
import { recomputeInternProgress } from "@/lib/internship-progress";

// Admin control over one intern's place in the internship: move them to
// another track, level, cohort or group, take them out (removable), or bring
// them back. Payments, assessment results and submitted work stay attached to
// the application whatever happens here.

export class InternControlError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Tx = Parameters<
  Parameters<ReturnType<typeof getPrisma>["$transaction"]>[0]
>[0];

/** Takes the intern out of their group on a track, keeping it led. */
async function leaveGroup(tx: Tx, userId: string, programId: string) {
  const membership = await tx.internshipGroupMember.findUnique({
    where: { programId_userId: { programId, userId } },
    include: { group: { select: { cohortId: true } } },
  });
  if (!membership) return;
  if (membership.group.cohortId)
    await lockCohortGroups(tx, membership.group.cohortId);
  await tx.internshipGroupMember.delete({ where: { id: membership.id } });
  await reassignLeaderIfNeeded(tx, membership.groupId);
}

/** Puts the intern in a specific group of their (new) cohort. */
async function joinGroup(
  tx: Tx,
  userId: string,
  programId: string,
  cohortId: string,
  groupId: string,
) {
  await lockCohortGroups(tx, cohortId);
  const group = await tx.internshipGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });
  if (!group || group.cohortId !== cohortId || group.programId !== programId)
    throw new InternControlError("Choose a group in the selected cohort.");
  if (group._count.members >= group.capacity)
    throw new InternControlError(
      `Group ${group.number} is full. Choose another group or increase its capacity on the Groups page.`,
      409,
    );
  await tx.internshipGroupMember.create({
    data: { groupId, programId, userId },
  });
  if (!group.leaderId)
    await tx.internshipGroup.update({
      where: { id: groupId },
      data: { leaderId: userId },
    });
}

/**
 * Moves an intern's application to another track/level/cohort and,
 * optionally, a specific group. With no group chosen, the intern is placed in
 * a group with room automatically the next time they open the discussion.
 */
export async function moveIntern(
  applicationId: string,
  input: {
    programId: string;
    levelId: string;
    cohortId: string | null;
    groupId: string | null;
  },
) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new InternControlError("Intern not found.", 404);
  if (application.status === InternshipApplicationStatus.REMOVED)
    throw new InternControlError("Restore this intern before moving them.");

  const [program, level, cohort] = await Promise.all([
    prisma.internshipProgram.findUnique({ where: { id: input.programId } }),
    prisma.internshipLevel.findUnique({ where: { id: input.levelId } }),
    input.cohortId
      ? prisma.internshipCohort.findUnique({ where: { id: input.cohortId } })
      : null,
  ]);
  if (!program || !level)
    throw new InternControlError("Choose a valid track and level.");
  if (input.cohortId && !cohort)
    throw new InternControlError("That cohort no longer exists.");
  if (
    cohort &&
    (cohort.programId !== input.programId || cohort.levelId !== input.levelId)
  )
    throw new InternControlError(
      "The cohort must belong to the chosen track and level.",
    );
  if (input.groupId && !cohort)
    throw new InternControlError("Choose a cohort before choosing a group.");

  const trackChanged =
    application.programId !== input.programId ||
    application.levelId !== input.levelId;
  if (trackChanged) {
    const clash = await prisma.internshipApplication.findFirst({
      where: {
        studentId: application.studentId,
        programId: input.programId,
        levelId: input.levelId,
        id: { not: application.id },
      },
      select: { id: true },
    });
    if (clash)
      throw new InternControlError(
        `This intern already has a separate application for ${program.name} (${level.name}). Manage that one instead.`,
        409,
      );
  }

  const currentGroup = await prisma.internshipGroupMember.findUnique({
    where: {
      programId_userId: {
        programId: application.programId,
        userId: application.studentId,
      },
    },
    select: { groupId: true },
  });
  const groupChanged =
    trackChanged ||
    application.cohortId !== input.cohortId ||
    (input.groupId !== null && input.groupId !== currentGroup?.groupId);

  await prisma.$transaction(async (tx) => {
    await tx.internshipApplication.update({
      where: { id: application.id },
      data: {
        programId: input.programId,
        levelId: input.levelId,
        cohortId: input.cohortId,
      },
    });

    if (groupChanged) {
      await leaveGroup(tx, application.studentId, application.programId);
      if (input.groupId && input.cohortId)
        await joinGroup(
          tx,
          application.studentId,
          input.programId,
          input.cohortId,
          input.groupId,
        );
    }

    // A mentor on the old track no longer looks after this intern.
    if (application.programId !== input.programId)
      await tx.mentorAssignment.updateMany({
        where: {
          internId: application.studentId,
          programId: application.programId,
          status: MentorAssignmentStatus.ACTIVE,
        },
        data: { status: MentorAssignmentStatus.ARCHIVED },
      });
  });

  await recomputeInternProgress(application.studentId, input.programId);
  if (application.programId !== input.programId)
    await recomputeInternProgress(application.studentId, application.programId);
}

/** Takes an intern out: no workspace access, out of their group and mentor. */
export async function removeIntern(applicationId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new InternControlError("Intern not found.", 404);
  if (application.status === InternshipApplicationStatus.REMOVED) return;

  await prisma.$transaction(async (tx) => {
    await tx.internshipApplication.update({
      where: { id: application.id },
      data: { status: InternshipApplicationStatus.REMOVED },
    });
    await leaveGroup(tx, application.studentId, application.programId);
    await tx.mentorAssignment.updateMany({
      where: {
        internId: application.studentId,
        programId: application.programId,
        status: MentorAssignmentStatus.ACTIVE,
      },
      data: { status: MentorAssignmentStatus.ARCHIVED },
    });
  });
}

/**
 * Brings a removed intern back. Their mentor is restored; they rejoin a group
 * automatically when they next open the discussion (or the admin picks one).
 */
export async function restoreIntern(applicationId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new InternControlError("Intern not found.", 404);
  if (application.status !== InternshipApplicationStatus.REMOVED) return;

  await prisma.$transaction([
    prisma.internshipApplication.update({
      where: { id: application.id },
      data: { status: InternshipApplicationStatus.ACTIVE },
    }),
    prisma.mentorAssignment.updateMany({
      where: {
        internId: application.studentId,
        programId: application.programId,
        status: MentorAssignmentStatus.ARCHIVED,
      },
      data: { status: MentorAssignmentStatus.ACTIVE },
    }),
  ]);
}
