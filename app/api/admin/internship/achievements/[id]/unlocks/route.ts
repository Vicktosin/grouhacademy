import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const unlocks = await getPrisma().achievementUnlock.findMany({
    where: { definitionId: id },
    orderBy: { unlockedAt: "desc" },
    take: 200,
    select: {
      id: true,
      titleSnapshot: true,
      unlockedAt: true,
      accomplishment: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      share: {
        select: {
          _count: { select: { clicks: true, attributions: true } },
        },
      },
    },
  });
  return NextResponse.json({ unlocks });
}
