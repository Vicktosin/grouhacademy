import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  cardUrl,
  loadShareCard,
  REFERRAL_CLICK_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
  REFERRAL_VISITOR_COOKIE,
} from "@/lib/referrals";

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const code =
    body && typeof body === "object" && "code" in body && typeof body.code === "string"
      ? body.code.trim()
      : "";
  if (!code || code.length > 100) return NextResponse.json({ clickId: null });

  const prisma = getPrisma();
  const share = await prisma.achievementShare.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!share) return NextResponse.json({ clickId: null });

  const existingVisitor = request.cookies.get(REFERRAL_VISITOR_COOKIE)?.value;
  const visitorKey = existingVisitor || crypto.randomUUID();
  const now = new Date();
  const click = await prisma.referralClick.upsert({
    where: { shareId_visitorKey: { shareId: share.id, visitorKey } },
    create: { shareId: share.id, visitorKey, firstVisitedAt: now, lastVisitedAt: now },
    update: { lastVisitedAt: now },
    select: { id: true },
  });

  // Who invited them, for the welcome on the sign-up page.
  const card = await loadShareCard(code);
  const response = NextResponse.json({
    clickId: click.id,
    invite: card && {
      name: card.name,
      title: card.title,
      track: card.track,
      cardUrl: cardUrl(card.code, card.photoKey, "og"),
    },
  });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    path: "/",
  };
  response.cookies.set(REFERRAL_VISITOR_COOKIE, visitorKey, cookieOptions);
  response.cookies.set(REFERRAL_CLICK_COOKIE, click.id, cookieOptions);
  return response;
}
