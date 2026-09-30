import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/route-guards";
import { getPrisma } from "@/lib/prisma";
import { ensureGroupMembership } from "@/lib/internship-groups";

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

async function getCurrentTask(programId: string, userId: string) {
  const prisma = getPrisma();
  // The next task still to do: never submitted, or sent back for changes.
  const task = await prisma.internshipTask.findFirst({
    where: {
      module: { programId },
      submissions: { none: { userId, status: { not: "REJECTED" } } },
    },
    orderBy: { dueDate: "asc" },
    include: {
      module: true,
      submissions: {
        where: { userId, status: "REJECTED" },
        select: { feedback: true },
        take: 1,
      },
    },
  });
  return task;
}

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId },
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
        select: { groupId: true },
      });
      if (!membership) return notInCohortResponse();

      const newMessages = await prisma.groupMessage.findMany({
        where: { groupId: membership.groupId, createdAt: { gt: since } },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      return NextResponse.json({
        messages: newMessages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          isMine: m.senderId === userId,
        })),
      });
    }

    const group = await ensureGroupMembership(application);
    if (!group) return notInCohortResponse();

    const [members, messages, meeting, currentTask] = await Promise.all([
      prisma.internshipGroupMember.findMany({
        where: { groupId: group.id },
        include: { user: true },
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
      getCurrentTask(application.programId, userId),
    ]);

    return NextResponse.json({
      groupNumber: group.number,
      isLeader: group.leaderId === userId,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? "Member",
        isLeader: m.userId === group.leaderId,
        isMe: m.userId === userId,
      })),
      messages: messages.reverse().map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isMine: m.senderId === userId,
      })),
      meeting: meeting
        ? {
            title: meeting.title,
            scheduledLabel: formatDateTime(meeting.scheduledAt),
            createdByName: meeting.createdBy.name,
          }
        : null,
      currentTask: currentTask
        ? {
            id: currentTask.id,
            title: currentTask.title,
            moduleTitle: currentTask.module.title,
            // Present when a mentor sent the previous submission back.
            changesRequested: currentTask.submissions.length > 0,
            feedback: currentTask.submissions[0]?.feedback ?? null,
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
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

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
      where: { studentId: userId },
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

    const message = await prisma.groupMessage.create({
      data: { groupId: group.id, senderId: userId, content },
    });

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
