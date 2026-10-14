import { Prisma } from "@/generated/prisma/client";
import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

export const REFERRAL_CLICK_COOKIE = "ga_referral_click";
export const REFERRAL_VISITOR_COOKIE = "ga_referral_visitor";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Validates the persisted signup intent; an arbitrary query string is not attribution. */
export async function recordReferralRegistration(
  request: NextRequest,
  userId: string,
  explicitClickId?: string | null,
) {
  const clickId =
    explicitClickId || request.cookies.get(REFERRAL_CLICK_COOKIE)?.value;
  if (!clickId) return;

  const prisma = getPrisma();
  const click = await prisma.referralClick.findUnique({
    where: { id: clickId },
    select: {
      id: true,
      firstVisitedAt: true,
      registrationStartedAt: true,
      share: { select: { id: true, referrerId: true } },
    },
  });
  if (!click || !click.registrationStartedAt) return;
  if (click.share.referrerId === userId) return;

  const referredUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (
    !referredUser ||
    click.firstVisitedAt > referredUser.createdAt ||
    click.registrationStartedAt > referredUser.createdAt
  ) {
    return;
  }

  try {
    await prisma.referralAttribution.create({
      data: {
        shareId: click.share.id,
        clickId: click.id,
        referrerId: click.share.referrerId,
        referredUserId: userId,
      },
      select: { id: true },
    });
  } catch (error) {
    // A referred account has one immutable attribution, even if auth callbacks
    // are replayed. Other database failures must remain visible.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A short, unguessable code for share links (grouhacademy.com/brag/k3Fq9xPa). */
function newShareCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** The intern's share of an achievement they earned, created the first time they brag. */
export async function shareForUnlock(unlockId: string, userId: string) {
  const prisma = getPrisma();
  const unlock = await prisma.achievementUnlock.findFirst({
    where: { id: unlockId, userId },
    select: { id: true, share: { select: { code: true, photoKey: true } } },
  });
  if (!unlock) return null;
  if (unlock.share) return unlock.share;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.achievementShare.create({
        data: { achievementUnlockId: unlock.id, referrerId: userId, code: newShareCode() },
        select: { code: true, photoKey: true },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      // Shared twice at once, or (very rarely) a code clash: use the one that exists.
      const existing = await prisma.achievementShare.findUnique({
        where: { achievementUnlockId: unlock.id },
        select: { code: true, photoKey: true },
      });
      if (existing) return existing;
    }
  }
  throw new Error("Could not create a share link.");
}

export function shareUrl(code: string) {
  return `${getSiteUrl()}/brag/${code}`;
}

/** The card image; `v` changes with the photo, so previews and caches refresh. */
export function cardUrl(code: string, photoKey: string | null, size: "full" | "og" = "full") {
  const query = new URLSearchParams({ v: photoKey ? photoKey.slice(-12, -4) : "p" });
  if (size === "og") query.set("size", "og");
  return `${getSiteUrl()}/brag/${code}/card?${query}`;
}

/** Everything the public card and landing page show about a share. */
export async function loadShareCard(code: string) {
  if (!code || code.length > 40) return null;
  const share = await getPrisma().achievementShare.findUnique({
    where: { code },
    select: {
      code: true,
      photoKey: true,
      referrer: { select: { name: true, avatarUrl: true, profile: { select: { firstName: true, lastName: true } } } },
      achievementUnlock: {
        select: {
          titleSnapshot: true,
          descriptionSnapshot: true,
          raritySnapshot: true,
          iconSnapshot: true,
          accomplishment: true,
        },
      },
    },
  });
  if (!share) return null;
  const unlock = share.achievementUnlock;
  const raw = unlock.accomplishment && typeof unlock.accomplishment === "object" && !Array.isArray(unlock.accomplishment)
    ? (unlock.accomplishment as Record<string, unknown>)
    : {};
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const number = (value: unknown) => (typeof value === "number" ? value : null);
  const profileName = [share.referrer.profile?.firstName, share.referrer.profile?.lastName].filter(Boolean).join(" ");
  return {
    code: share.code,
    photoKey: share.photoKey,
    name: share.referrer.name?.trim() || profileName.trim() || "A Grouh Academy intern",
    avatarUrl: share.referrer.avatarUrl,
    title: unlock.titleSnapshot,
    description: unlock.descriptionSnapshot,
    rarity: unlock.raritySnapshot,
    icon: unlock.iconSnapshot,
    track: text(raw.track),
    level: text(raw.level),
    accomplishment: {
      taskTitle: text(raw.taskTitle),
      score: number(raw.score),
      maxScore: number(raw.maxScore),
      scorePercent: number(raw.scorePercent),
    },
  };
}
export type ShareCard = NonNullable<Awaited<ReturnType<typeof loadShareCard>>>;

/** The caption that goes out with the card. */
export function shareText(card: Pick<ShareCard, "title" | "track">, url: string) {
  const where = card.track ? `in Grouh Academy's ${card.track} internship` : "at Grouh Academy";
  return `🏆 I just unlocked "${card.title}" ${where}! Start your own internship here 👉 ${url}`;
}
