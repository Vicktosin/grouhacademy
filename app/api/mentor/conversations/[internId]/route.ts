import { NextResponse } from "next/server";

import { requireMentorApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

type Context = { params: Promise<{ internId: string }> };

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Resolves the conversation between this mentor and an intern they are
 * actively assigned to, creating it on first use. Returns null otherwise.
 */
async function assignedConversation(
  mentorId: string,
  internId: string,
  programId: string | null,
) {
  const prisma = getPrisma();
  const assignment = await prisma.mentorAssignment.findFirst({
    where: {
      mentorId,
      internId,
      status: "ACTIVE",
      ...(programId ? { programId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { programId: true },
  });
  if (!assignment) return null;

  return prisma.conversation.upsert({
    where: {
      mentorId_internId_programId: {
        mentorId,
        internId,
        programId: assignment.programId,
      },
    },
    create: { mentorId, internId, programId: assignment.programId },
    update: {},
  });
}

function notAssigned() {
  return NextResponse.json(
    { error: "This intern isn't assigned to you." },
    { status: 404 },
  );
}

export async function GET(request: Request, { params }: Context) {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;

  const { internId } = await params;
  const searchParams = new URL(request.url).searchParams;
  const after = searchParams.get("after");
  const afterDate = after ? new Date(after) : null;

  try {
    const conversation = await assignedConversation(
      mentorId,
      internId,
      searchParams.get("programId"),
    );
    if (!conversation) return notAssigned();

    const prisma = getPrisma();
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        ...(afterDate && !Number.isNaN(afterDate.getTime())
          ? { createdAt: { gt: afterDate } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    // Opening the conversation marks the intern's messages as read.
    await prisma.message.updateMany({
      where: {
        conversationId: conversation.id,
        senderId: internId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return NextResponse.json({
      messages: messages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isMine: message.senderId === mentorId,
      })),
    });
  } catch (error) {
    console.error("Failed to load mentor conversation:", error);
    return NextResponse.json(
      { error: "Unable to load conversation." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: Context) {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;

  const { internId } = await params;
  const body = await request.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const programId = typeof body?.programId === "string" ? body.programId : null;

  if (!content) {
    return NextResponse.json(
      { error: "Message cannot be empty." },
      { status: 400 },
    );
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` },
      { status: 400 },
    );
  }

  try {
    const conversation = await assignedConversation(
      mentorId,
      internId,
      programId,
    );
    if (!conversation) return notAssigned();

    const message = await getPrisma().message.create({
      data: { conversationId: conversation.id, senderId: mentorId, content },
    });

    return NextResponse.json({
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      isMine: true,
    });
  } catch (error) {
    console.error("Failed to send mentor message:", error);
    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 },
    );
  }
}
