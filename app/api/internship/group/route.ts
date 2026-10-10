import { NextResponse } from "next/server";
import { chatTopic, notifyChats } from "@/lib/realtime";
import { getPrisma } from "@/lib/prisma";
import { ensureGroupMembership } from "@/lib/internship-groups";
import { memberContacts } from "@/lib/member-contact";
import { serializeGroupMessages } from "@/lib/group-chat";
import { requireInternshipWorkspace } from "@/lib/internship-access";

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Groups belong to a cohort, so interns are placed only once they have one.
function notInCohortResponse() {
  return NextResponse.json(
    {
      error:
        "You'll be placed in a group once you've been assigned to a cohort. Please check back after your acceptance fee is confirmed.",
    },
    { status: 409 },
  );
}

export async function GET(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      // A removed intern has no group until an admin restores them.
      where: { studentId: userId, status: { not: "REMOVED" } },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No internship application found." },
        { status: 404 },
      );
    }

    // Poll requests (every few seconds while the chat is open) only need new
    // messages. The first load already placed the intern in a group and sent
    // members, the meeting and the task, so skip that work here.
    if (after) {
      const since = new Date(after);
      if (Number.isNaN(since.getTime())) {
        return NextResponse.json(
          { error: "Invalid 'after' timestamp." },
          { status: 400 },
        );
      }

      const membership = await prisma.internshipGroupMember.findUnique({
        where: {
          programId_userId: { programId: application.programId, userId },
        },
        select: { groupId: true, group: { select: { discussionOpen: true } } },
      });
      if (!membership) return notInCohortResponse();

      const newMessages = await prisma.groupMessage.findMany({
        where: { groupId: membership.groupId, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      return NextResponse.json({
        messages: await serializeGroupMessages(newMessages, userId),
        // An admin may pause or reopen the discussion at any time.
        discussionOpen: membership.group.discussionOpen,
      });
    }

    const group = await ensureGroupMembership(application);
    if (!group) return notInCohortResponse();

    const [members, messages, meeting] = await Promise.all([
      prisma.internshipGroupMember.findMany({
        where: { groupId: group.id },
        // Only the name: the full user row includes the avatar.
        include: { user: { select: { name: true } } },
        orderBy: { joinedAt: "asc" },
      }),
      // Newest 200 (fetched newest-first, reversed below) so a long chat opens
      // on the latest conversation rather than the oldest.
      prisma.groupMessage.findMany({
        where: { groupId: group.id },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.groupMeeting.findFirst({
        where: { groupId: group.id, scheduledAt: { gt: new Date() } },
        orderBy: { scheduledAt: "asc" },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);

    // The group leader sees teammates' phone numbers to organise group work.
    const isLeader = group.leaderId === userId;
    const contacts = isLeader
      ? await memberContacts(
          members.filter((m) => m.userId !== userId).map((m) => m.userId),
          group.programId,
        )
      : null;

    return NextResponse.json({
      groupNumber: group.number,
      discussionOpen: group.discussionOpen,
      // Where to listen for new messages (see lib/realtime).
      realtimeTopic: chatTopic({ kind: "group", groupId: group.id }),
      isLeader,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? "Member",
        isLeader: m.userId === group.leaderId,
        isMe: m.userId === userId,
        ...(contacts ? { contact: contacts.get(m.userId) ?? null } : {}),
      })),
      messages: await serializeGroupMessages(messages.reverse(), userId),
      meeting: meeting
        ? {
            title: meeting.title,
            scheduledLabel: formatDateTime(meeting.scheduledAt),
            createdByName: meeting.createdBy.name,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to load group discussion:", error);
    return NextResponse.json(
      { error: "Unable to load group discussion." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 },
    );
  }
  if (content.length > 2000) {
    return NextResponse.json(
      { error: "Message is too long (max 2000 characters)." },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      // A removed intern has no group until an admin restores them.
      where: { studentId: userId, status: { not: "REMOVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!application) {
      return NextResponse.json(
        { error: "No internship application found." },
        { status: 404 },
      );
    }

    const group = await ensureGroupMembership(application);
    if (!group) return notInCohortResponse();
    if (!group.discussionOpen)
      return NextResponse.json(
        { error: "The academy has paused your group's discussion for now. You can still read past messages." },
        { status: 403 },
      );

    const message = await prisma.groupMessage.create({
      data: { groupId: group.id, senderId: userId, content },
    });
    notifyChats([{ kind: "group", groupId: group.id }]);

    return NextResponse.json({
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      isMine: true,
    });
  } catch (error) {
    console.error("Failed to send group message:", error);
    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 },
    );
  }
}
