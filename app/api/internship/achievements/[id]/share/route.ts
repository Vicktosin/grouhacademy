import { NextResponse } from "next/server";
import { SHARE_CHANNELS, type ShareChannel } from "@/lib/achievements-shared";
import { requireInternApi } from "@/lib/lab-api";
import { isLabMediaEnabled } from "@/lib/lab-media";
import { getPrisma } from "@/lib/prisma";
import { cardUrl, loadShareCard, shareForUnlock, shareText, shareUrl } from "@/lib/referrals";

/**
 * The intern's share link and card for an achievement they earned (created
 * the first time). Body { channel } also records where they shared it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const share = await shareForUnlock((await params).id, userId);
  if (!share) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const channel = body && typeof body === "object" && "channel" in body ? body.channel : null;
  if (SHARE_CHANNELS.includes(channel as ShareChannel)) {
    await getPrisma().$executeRaw`
      UPDATE "AchievementShare" SET "channels" = array_append("channels", ${channel as string})
      WHERE "code" = ${share.code} AND NOT (${channel as string} = ANY("channels"))`;
  }

  const card = await loadShareCard(share.code);
  if (!card) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  const url = shareUrl(card.code);
  return NextResponse.json({
    code: card.code,
    shareUrl: url,
    cardUrl: cardUrl(card.code, card.photoKey),
    shareText: shareText(card, url),
    customPhoto: Boolean(card.photoKey),
    canUploadPhoto: isLabMediaEnabled(),
  });
}
