import { LearnerAudience, RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { notifyChats } from "@/lib/realtime";

// Group discussion messages, including ones the academy team posts into a
// group's chat from the Groups page. Admins' messages are shown to interns
// as "Grouh Academy team", Support Admins' as "Support Admin".

export const TEAM_NAME = "Grouh Academy team";
export const SUPPORT_ADMIN_NAME = "Support Admin";
export const MAX_MESSAGE_LENGTH = 2000;

export type TeamRole = "ADMIN" | "SUPPORT_ADMIN";

/** How a team member's messages are signed. */
export const teamName = (role: TeamRole) =>
  role === "SUPPORT_ADMIN" ? SUPPORT_ADMIN_NAME : TEAM_NAME;

type StoredMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
};

/** Senders among these who are academy team (admins or Support Admins). */
async function teamSenders(senderIds: string[]) {
  const unique = [...new Set(senderIds)];
  const team = new Map<string, TeamRole>();
  if (!unique.length) return team;
  const roles = await getPrisma().userRole.findMany({
    where: {
      userId: { in: unique },
      role: { name: { in: [RoleName.ADMIN, RoleName.SUPPORT_ADMIN] } },
    },
    select: { userId: true, role: { select: { name: true } } },
  });
  // Someone with both roles signs as the admin team.
  for (const { userId, role } of roles)
    if (team.get(userId) !== "ADMIN")
      team.set(userId, role.name === RoleName.ADMIN ? "ADMIN" : "SUPPORT_ADMIN");
  return team;
}

/** Messages as interns receive them, with team messages marked. */
export async function serializeGroupMessages(
  messages: StoredMessage[],
  viewerId: string,
) {
  const team = await teamSenders(messages.map((m) => m.senderId));
  return messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    isMine: m.senderId === viewerId,
    fromTeam: team.has(m.senderId),
    teamRole: team.get(m.senderId) ?? null,
  }));
}

/** A group's latest messages with sender names, for the admin chat view. */
export async function adminGroupMessages(groupId: string, after?: Date) {
  const prisma = getPrisma();
  const messages = await prisma.groupMessage.findMany({
    where: { groupId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { sender: { select: { name: true, email: true } } },
  });
  const team = await teamSenders(messages.map((m) => m.senderId));
  return messages.reverse().map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    senderName: m.sender.name?.trim() || m.sender.email,
    fromTeam: team.has(m.senderId),
    teamRole: team.get(m.senderId) ?? null,
  }));
}

/**
 * Posts the same message from an admin or Support Admin into each group's
 * chat, and notifies every member so they see it even if they aren't in the
 * chat right now.
 */
export async function postTeamMessage(
  adminId: string,
  groupIds: string[],
  content: string,
) {
  const text = content.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return { error: "Write a message first.", status: 400 } as const;
  const prisma = getPrisma();
  const sender = teamName((await teamSenders([adminId])).get(adminId) ?? "ADMIN");
  const groups = await prisma.internshipGroup.findMany({
    where: { id: { in: [...new Set(groupIds)] } },
    select: {
      id: true,
      number: true,
      members: { select: { userId: true } },
    },
  });
  if (!groups.length) return { error: "Choose at least one group.", status: 400 } as const;

  const preview = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  await prisma.$transaction([
    prisma.groupMessage.createMany({
      data: groups.map((group) => ({ groupId: group.id, senderId: adminId, content: text })),
    }),
    prisma.notification.createMany({
      data: groups.flatMap((group) =>
        group.members.map((member) => ({
          userId: member.userId,
          title: `New message from ${sender === TEAM_NAME ? `the ${TEAM_NAME}` : sender}`,
          message: `In your Group ${group.number} discussion: ${preview}`,
          audience: LearnerAudience.INTERNSHIP,
        })),
      ),
    }),
  ]);
  notifyChats(groups.map((group) => ({ kind: "group" as const, groupId: group.id })));
  const people = groups.reduce((total, group) => total + group.members.length, 0);
  return { groups: groups.length, people } as const;
}
