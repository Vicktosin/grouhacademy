import { NextResponse } from "next/server";
import { requireInternApi } from "@/lib/lab-api";
import { MediaError, saveSharePhoto } from "@/lib/lab-media";
import { getPrisma } from "@/lib/prisma";
import { cardUrl, shareForUnlock } from "@/lib/referrals";

// The photo on an achievement card: the intern's own upload (body: the image,
// already shrunk in the browser) or, after DELETE, their profile picture.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const share = await shareForUnlock((await params).id, userId);
  if (!share) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  const bytes = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)));
  try {
    const photoKey = await saveSharePhoto(userId, bytes, share.photoKey);
    await getPrisma().achievementShare.update({ where: { code: share.code }, data: { photoKey } });
    return NextResponse.json({ cardUrl: cardUrl(share.code, photoKey), customPhoto: true });
  } catch (error) {
    if (error instanceof MediaError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[achievements] Share photo upload failed.", error);
    return NextResponse.json({ error: "Your photo couldn't be saved. Try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireInternApi();
  if (userId instanceof NextResponse) return userId;
  const share = await shareForUnlock((await params).id, userId);
  if (!share) return NextResponse.json({ error: "Achievement not found." }, { status: 404 });
  await getPrisma().achievementShare.update({ where: { code: share.code }, data: { photoKey: null } });
  return NextResponse.json({ cardUrl: cardUrl(share.code, null), customPhoto: false });
}
