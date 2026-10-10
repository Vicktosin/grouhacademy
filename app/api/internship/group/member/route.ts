import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { memberContacts } from "@/lib/member-contact";
import { requireInternshipWorkspace } from "@/lib/internship-access";

export async function GET(request: Request) {
  const access = await requireInternshipWorkspace();
  if ("response" in access) return access.response;
  const { userId } = access;

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const prisma = getPrisma();

  try {
    const application = await prisma.internshipApplication.findFirst({
      where: { studentId: userId, status: { not: "REMOVED" } },
      orderBy: { createdAt: "desc" },
    });
    if (!application) {
      return NextResponse.json(
        { error: "No internship application found." },
        { status: 404 },
      );
    }

    const myMembership = await prisma.internshipGroupMember.findUnique({
      where: { programId_userId: { programId: application.programId, userId } },
    });
    const targetMembership = await prisma.internshipGroupMember.findUnique({
      where: {
        programId_userId: {
          programId: application.programId,
          userId: targetUserId,
        },
      },
    });

    if (
      !myMembership ||
      !targetMembership ||
      myMembership.groupId !== targetMembership.groupId
    ) {
      return NextResponse.json(
        { error: "That member is not in your group." },
        { status: 403 },
      );
    }

    const [targetUser, targetSettings, targetProgress, group] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: targetUserId },
          include: { profile: true },
        }),
        prisma.userSettings.findUnique({ where: { userId: targetUserId } }),
        prisma.internshipProgress.findUnique({
          where: {
            userId_programId: {
              userId: targetUserId,
              programId: application.programId,
            },
          },
        }),
        prisma.internshipGroup.findUnique({
          where: { id: myMembership.groupId },
        }),
      ]);

    if (!targetUser) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    // Only the group leader gets teammates' phone numbers (even when the
    // rest of the profile is hidden), to organise group work.
    const viewerIsLeader = group?.leaderId === userId && targetUserId !== userId;
    const contact = viewerIsLeader
      ? ((await memberContacts([targetUserId], application.programId)).get(
          targetUserId,
        ) ?? null)
      : undefined;

    const profileVisible = targetSettings?.profileVisible ?? true;

    if (!profileVisible) {
      return NextResponse.json({
        visible: false,
        name: targetUser.name ?? "Member",
        isLeader: group?.leaderId === targetUserId,
        contact,
      });
    }

    return NextResponse.json({
      visible: true,
      name: targetUser.name ?? "Member",
      avatarUrl: targetUser.avatarUrl,
      bio: targetUser.profile?.bio ?? null,
      skills: targetUser.profile?.skills ?? [],
      isLeader: group?.leaderId === targetUserId,
      progressPercent: targetProgress?.progressPercent ?? 0,
      completedTasks: targetProgress?.completedTasks ?? 0,
      totalTasks: targetProgress?.totalTasks ?? 0,
      contact,
    });
  } catch (error) {
    console.error("Failed to load teammate profile:", error);
    return NextResponse.json(
      { error: "Unable to load member profile." },
      { status: 500 },
    );
  }
}
