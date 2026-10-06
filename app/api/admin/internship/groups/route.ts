import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/api-guards";
import {
  lockCohortGroups,
  nextGroupNumber,
  reassignLeaderIfNeeded,
} from "@/lib/internship-groups";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPrisma } from "@/lib/prisma";

const MAX_CAPACITY = 100;
/** Selects groups created before groups were scoped to cohorts. */
const UNASSIGNED = "unassigned";

class GroupActionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function cohortStatus(startDate: Date, endDate: Date) {
  const now = new Date();
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "COMPLETED";
  return "ACTIVE";
}

function displayName(user: { name: string | null; email: string }) {
  return user.name?.trim() || user.email;
}

function parseCapacity(value: unknown) {
  const capacity = Number(value);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY)
    throw new GroupActionError(
      `Capacity must be a whole number between 1 and ${MAX_CAPACITY}.`,
    );
  return capacity;
}

function requireString(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new GroupActionError(`${label} is required.`);
  return text;
}

export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  try {
    return await loadGroups(request);
  } catch (error) {
    console.error("Failed to load internship groups:", error);
    return NextResponse.json(
      {
        error:
          "Unable to load groups. If this follows a deployment, check that all database migrations have been applied.",
      },
      { status: 500 },
    );
  }
}

async function loadGroups(request: Request) {
  const prisma = getPrisma();
  const requested = new URL(request.url).searchParams.get("cohortId");

  const [cohortRows, legacyGroupCount, settings] = await Promise.all([
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      include: {
        program: { select: { name: true } },
        _count: { select: { groups: true } },
      },
    }),
    prisma.internshipGroup.count({ where: { cohortId: null } }),
    getPlatformSettings(),
  ]);

  const cohorts = cohortRows.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    programId: cohort.programId,
    programName: cohort.program.name,
    status: cohortStatus(cohort.startDate, cohort.endDate),
    groupCount: cohort._count.groups,
  }));

  const selected =
    requested === UNASSIGNED ||
    (requested && cohorts.some((c) => c.id === requested))
      ? requested
      : (cohorts.find((c) => c.status === "ACTIVE") ??
          cohorts.find((c) => c.status === "UPCOMING") ??
          cohorts[0])?.id ?? null;

  if (!selected) {
    return NextResponse.json({
      cohorts,
      legacyGroupCount,
      selected: null,
      defaultCapacity: settings.maxGroupSize,
      groups: [],
      unplaced: [],
    });
  }

  const isLegacy = selected === UNASSIGNED;
  const groups = await prisma.internshipGroup.findMany({
    where: { cohortId: isLegacy ? null : selected },
    orderBy: isLegacy ? [{ programId: "asc" }, { number: "asc" }] : { number: "asc" },
    include: {
      program: { select: { name: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  // Legacy members can only move into groups of their own cohort.
  const legacyMoveTargets = new Map<string, { id: string; label: string }[]>();
  if (isLegacy) {
    const memberships = groups.flatMap((group) =>
      group.members.map((member) => ({
        userId: member.userId,
        programId: member.programId,
      })),
    );
    const applications = memberships.length
      ? await prisma.internshipApplication.findMany({
          where: { OR: memberships.map((m) => ({ studentId: m.userId, programId: m.programId })) },
          select: {
            studentId: true,
            cohort: {
              select: {
                name: true,
                groups: { orderBy: { number: "asc" }, select: { id: true, number: true } },
              },
            },
          },
        })
      : [];
    for (const application of applications) {
      legacyMoveTargets.set(
        application.studentId,
        (application.cohort?.groups ?? []).map((group) => ({
          id: group.id,
          label: `${application.cohort!.name}: Group ${group.number}`,
        })),
      );
    }
  }

  const unplaced = isLegacy
    ? []
    : (
        await prisma.internshipApplication.findMany({
          where: {
            cohortId: selected,
            // Interns who have moved up to the next level have left this
            // cohort's groups on purpose.
            NOT: {
              promotedTo: { is: { payment: { is: { status: "PAID" } } } },
            },
            student: {
              groupMemberships: {
                none: { programId: cohorts.find((c) => c.id === selected)!.programId },
              },
            },
          },
          orderBy: { createdAt: "asc" },
          select: { student: { select: { id: true, name: true, email: true } } },
        })
      ).map(({ student }) => ({
        userId: student.id,
        name: displayName(student),
        email: student.email,
      }));

  return NextResponse.json({
    cohorts,
    legacyGroupCount,
    selected,
    defaultCapacity: settings.maxGroupSize,
    groups: groups.map((group) => ({
      id: group.id,
      number: group.number,
      programName: group.program.name,
      capacity: group.capacity,
      leaderId: group.leaderId,
      members: group.members.map((member) => ({
        userId: member.userId,
        name: displayName(member.user),
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        joinedAt: member.joinedAt.toISOString(),
        moveTargets: isLegacy ? (legacyMoveTargets.get(member.userId) ?? []) : undefined,
      })),
    })),
    unplaced,
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = body?.action;
  const prisma = getPrisma();

  try {
    switch (action) {
      case "createGroup": {
        const cohortId = requireString(body?.cohortId, "A cohort");
        const cohort = await prisma.internshipCohort.findUnique({
          where: { id: cohortId },
        });
        if (!cohort) throw new GroupActionError("Cohort not found.", 404);
        const capacity =
          body?.capacity === undefined || body.capacity === ""
            ? (await getPlatformSettings()).maxGroupSize
            : parseCapacity(body.capacity);

        const group = await prisma.$transaction(async (tx) => {
          await lockCohortGroups(tx, cohortId);
          return tx.internshipGroup.create({
            data: {
              programId: cohort.programId,
              cohortId,
              number: await nextGroupNumber(tx, cohortId),
              capacity,
            },
          });
        });
        return NextResponse.json({
          success: true,
          message: `Group ${group.number} created.`,
        });
      }

      case "updateCapacity": {
        const groupId = requireString(body?.groupId, "A group");
        const capacity = parseCapacity(body?.capacity);
        const group = await prisma.internshipGroup.findUnique({
          where: { id: groupId },
          include: { _count: { select: { members: true } } },
        });
        if (!group) throw new GroupActionError("Group not found.", 404);
        if (capacity < group._count.members)
          throw new GroupActionError(
            `Group ${group.number} has ${group._count.members} members. Move or remove members before lowering its capacity below that.`,
          );
        await prisma.internshipGroup.update({
          where: { id: groupId },
          data: { capacity },
        });
        return NextResponse.json({
          success: true,
          message: `Group ${group.number} capacity set to ${capacity}.`,
        });
      }

      case "addMember": {
        const groupId = requireString(body?.groupId, "A group");
        const userId = requireString(body?.userId, "An intern");

        const message = await prisma.$transaction(async (tx) => {
          const target = await tx.internshipGroup.findUnique({
            where: { id: groupId },
          });
          if (!target) throw new GroupActionError("Group not found.", 404);
          if (!target.cohortId)
            throw new GroupActionError(
              "Groups without a cohort can't take new members. Choose a group in the intern's cohort.",
            );
          await lockCohortGroups(tx, target.cohortId);

          // An intern has one application per level, so look for the one in
          // this group's cohort.
          const application = await tx.internshipApplication.findFirst({
            where: {
              studentId: userId,
              programId: target.programId,
              cohortId: target.cohortId,
            },
            select: { id: true },
          });
          if (!application)
            throw new GroupActionError(
              "This intern isn't in this group's cohort.",
            );

          const memberCount = await tx.internshipGroupMember.count({
            where: { groupId },
          });
          if (memberCount >= target.capacity)
            throw new GroupActionError(
              `Group ${target.number} is full. Increase its capacity first.`,
              409,
            );

          const existing = await tx.internshipGroupMember.findUnique({
            where: {
              programId_userId: { programId: target.programId, userId },
            },
          });
          if (existing?.groupId === groupId)
            throw new GroupActionError("This intern is already in this group.", 409);

          if (existing) {
            await tx.internshipGroupMember.update({
              where: { id: existing.id },
              data: { groupId, joinedAt: new Date() },
            });
            await reassignLeaderIfNeeded(tx, existing.groupId);
          } else {
            await tx.internshipGroupMember.create({
              data: { groupId, programId: target.programId, userId },
            });
          }

          // An empty group's first member becomes its leader.
          if (!target.leaderId)
            await tx.internshipGroup.update({
              where: { id: groupId },
              data: { leaderId: userId },
            });

          return existing
            ? `Intern moved to Group ${target.number}.`
            : `Intern added to Group ${target.number}.`;
        });
        return NextResponse.json({ success: true, message });
      }

      case "removeMember": {
        const groupId = requireString(body?.groupId, "A group");
        const userId = requireString(body?.userId, "An intern");

        await prisma.$transaction(async (tx) => {
          const group = await tx.internshipGroup.findUnique({
            where: { id: groupId },
          });
          if (!group) throw new GroupActionError("Group not found.", 404);
          if (group.cohortId) await lockCohortGroups(tx, group.cohortId);

          const removed = await tx.internshipGroupMember.deleteMany({
            where: { groupId, userId },
          });
          if (removed.count === 0)
            throw new GroupActionError("This intern isn't in this group.", 404);

          await reassignLeaderIfNeeded(tx, groupId);
        });
        return NextResponse.json({
          success: true,
          message: "Intern removed from the group.",
        });
      }

      case "setLeader": {
        const groupId = requireString(body?.groupId, "A group");
        const userId = requireString(body?.userId, "An intern");
        const membership = await prisma.internshipGroupMember.findFirst({
          where: { groupId, userId },
          include: { group: { select: { number: true } } },
        });
        if (!membership)
          throw new GroupActionError(
            "Only a member of this group can be its leader.",
          );
        await prisma.internshipGroup.update({
          where: { id: groupId },
          data: { leaderId: userId },
        });
        return NextResponse.json({
          success: true,
          message: `New leader set for Group ${membership.group.number}.`,
        });
      }

      case "deleteGroup": {
        const groupId = requireString(body?.groupId, "A group");
        const group = await prisma.internshipGroup.findUnique({
          where: { id: groupId },
          include: { _count: { select: { members: true } } },
        });
        if (!group) throw new GroupActionError("Group not found.", 404);
        if (group._count.members > 0)
          throw new GroupActionError(
            "Only empty groups can be deleted. Move its members first.",
            409,
          );
        await prisma.internshipGroup.delete({ where: { id: groupId } });
        return NextResponse.json({
          success: true,
          message: `Group ${group.number} deleted.`,
        });
      }

      default:
        throw new GroupActionError("Unknown group action.");
    }
  } catch (error) {
    if (error instanceof GroupActionError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Failed to update internship groups:", error);
    return NextResponse.json(
      { error: "Unable to update the group. Please try again." },
      { status: 500 },
    );
  }
}
