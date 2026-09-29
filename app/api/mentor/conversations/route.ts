import { NextResponse } from "next/server";

import { requireMentorApi } from "@/lib/api-guards";
import { getMentorInterns } from "@/lib/mentor-data";
import { getPrisma } from "@/lib/prisma";

/** One entry per assigned intern, most recent conversation first. */
export async function GET() {
  const mentorId = await requireMentorApi();
  if (mentorId instanceof NextResponse) return mentorId;

  try {
    const prisma = getPrisma();
    const [interns, conversations] = await Promise.all([
      getMentorInterns(mentorId),
      prisma.conversation.findMany({
        where: { mentorId },
        select: {
          internId: true,
          programId: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, createdAt: true, senderId: true },
          },
          _count: {
            select: {
              messages: { where: { readAt: null, senderId: { not: mentorId } } },
            },
          },
        },
      }),
    ]);

    const byIntern = new Map(
      conversations.map((c) => [`${c.internId}:${c.programId}`, c]),
    );

    const rows = interns.map((intern) => {
      const conversation = byIntern.get(`${intern.internId}:${intern.programId}`);
      const last = conversation?.messages[0];
      return {
        internId: intern.internId,
        programId: intern.programId,
        name: intern.name,
        avatarUrl: intern.avatarUrl,
        subtitle: [intern.programName, intern.cohortName]
          .filter(Boolean)
          .join(" · "),
        unread: conversation?._count.messages ?? 0,
        lastMessage: last
          ? {
              content: last.content,
              createdAt: last.createdAt.toISOString(),
              isMine: last.senderId === mentorId,
            }
          : null,
      };
    });

    rows.sort(
      (a, b) =>
        (b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0) -
        (a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0),
    );

    return NextResponse.json({ conversations: rows });
  } catch (error) {
    console.error("Failed to load mentor conversations:", error);
    return NextResponse.json(
      { error: "Unable to load conversations." },
      { status: 500 },
    );
  }
}
