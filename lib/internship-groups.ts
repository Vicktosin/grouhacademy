import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/platform-settings";

type Tx = Prisma.TransactionClient;

/**
 * Serialises group changes within one cohort for the rest of the transaction,
 * so two interns joining at once cannot overfill a group or create two groups
 * with the same number. Released automatically on commit or rollback.
 */
export async function lockCohortGroups(tx: Tx, cohortId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`internship-groups:${cohortId}`}))`;
}

export async function nextGroupNumber(tx: Tx, cohortId: string) {
  const last = await tx.internshipGroup.findFirst({
    where: { cohortId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/**
 * Keeps a group's leader valid after a member leaves: the longest-standing
 * remaining member takes over, or the group has no leader once empty.
 */
export async function reassignLeaderIfNeeded(tx: Tx, groupId: string) {
  const group = await tx.internshipGroup.findUniqueOrThrow({
    where: { id: groupId },
    select: { leaderId: true },
  });

  const leaderIsMember =
    group.leaderId !== null &&
    (await tx.internshipGroupMember.count({
      where: { groupId, userId: group.leaderId },
    })) > 0;
  if (leaderIsMember) return;

  const nextLeader = await tx.internshipGroupMember.findFirst({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });

  await tx.internshipGroup.update({
    where: { id: groupId },
    data: { leaderId: nextLeader?.userId ?? null },
  });
}

/**
 * Places an intern in a group of their cohort the first time they open the
 * group discussion. Existing memberships are kept as they are. Returns null
 * while the intern has not been assigned to a cohort yet.
 */
export async function ensureGroupMembership(application: {
  studentId: string;
  programId: string;
  cohortId: string | null;
}) {
  const { studentId: userId, programId, cohortId } = application;
  const prisma = getPrisma();

  const existingMembership = await prisma.internshipGroupMember.findUnique({
    where: { programId_userId: { programId, userId } },
    include: { group: true },
  });
  if (existingMembership) return existingMembership.group;
  if (!cohortId) return null;

  // Never place an intern using a cohort from another programme.
  const cohortMatchesProgram = await prisma.internshipCohort.count({
    where: { id: cohortId, programId },
  });
  if (!cohortMatchesProgram) return null;

  const { maxGroupSize } = await getPlatformSettings();

  return prisma.$transaction(async (tx) => {
    await lockCohortGroups(tx, cohortId);

    // Another request may have placed this intern while we waited.
    const placed = await tx.internshipGroupMember.findUnique({
      where: { programId_userId: { programId, userId } },
      include: { group: true },
    });
    if (placed) return placed.group;

    const groups = await tx.internshipGroup.findMany({
      where: { cohortId },
      orderBy: { number: "asc" },
      include: { _count: { select: { members: true } } },
    });

    const groupWithRoom = groups.find(
      (group) => group._count.members < group.capacity,
    );

    const targetGroup =
      groupWithRoom ??
      (await tx.internshipGroup.create({
        data: {
          programId,
          cohortId,
          number: await nextGroupNumber(tx, cohortId),
          capacity: maxGroupSize,
        },
      }));

    await tx.internshipGroupMember.create({
      data: { groupId: targetGroup.id, programId, userId },
    });

    // The first member of a group becomes its leader.
    if (!targetGroup.leaderId) {
      return tx.internshipGroup.update({
        where: { id: targetGroup.id },
        data: { leaderId: userId },
      });
    }

    return tx.internshipGroup.findUniqueOrThrow({
      where: { id: targetGroup.id },
    });
  });
}
