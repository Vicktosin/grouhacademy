import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const userId = await requireAdminApi();
  if (userId instanceof NextResponse) return userId;

  const prisma = getPrisma();

  try {
    const [user, unreadNotificationCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          avatarUrl: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "Administrator account was not found." },
        { status: 404 },
      );
    }

    const profileName = [user.profile?.firstName, user.profile?.lastName]
      .filter(Boolean)
      .join(" ");

    return NextResponse.json({
      name: profileName || user.name || "Administrator",
      avatarUrl: user.avatarUrl,
      unreadNotificationCount,
    });
  } catch (error) {
    console.error("Failed to load administrator context:", error);
    return NextResponse.json(
      { error: "Unable to load administrator context." },
      { status: 500 },
    );
  }
}
