import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";

// The pop-up checks this often, so it only asks who's signed in: there's no
// workspace-access query, since only interns ever have unlocks and every
// query is scoped to the signed-in user's own.
async function requireUser(): Promise<string | NextResponse> {
  return (await getCurrentUserId()) ?? NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export async function GET() {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const unlock = await getPrisma().achievementUnlock.findFirst({
    where: { userId, celebratedAt: null },
    // Rarest first when several arrive together (a perfect score can unlock a few).
    orderBy: [{ raritySnapshot: "desc" }, { unlockedAt: "asc" }],
    select: {
      id: true,
      titleSnapshot: true,
      descriptionSnapshot: true,
      messageSnapshot: true,
      categorySnapshot: true,
      raritySnapshot: true,
      iconSnapshot: true,
      accomplishment: true,
      unlockedAt: true,
      user: { select: { name: true, avatarUrl: true } },
    },
  });
  return NextResponse.json({ unlock });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (userId instanceof NextResponse) return userId;
  const body: unknown = await request.json().catch(() => null);
  const unlockId =
    body && typeof body === "object" && "unlockId" in body &&
    typeof body.unlockId === "string"
      ? body.unlockId
      : "";
  if (!unlockId) return NextResponse.json({ error: "Achievement is required." }, { status: 400 });
  await getPrisma().achievementUnlock.updateMany({
    where: { id: unlockId, userId, celebratedAt: null },
    data: { celebratedAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
