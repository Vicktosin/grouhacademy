import { LearnerAudience, NotificationType, Prisma } from "@/generated/prisma/client";
import type { NextRequest } from "next/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPrisma } from "@/lib/prisma";
import { REAL_USER } from "@/lib/real-user";
import { getSiteUrl } from "@/lib/site-url";

// The Affiliate Program: interns invite people on purpose with their own
// link (/invite/<code>) and earn a commission, set by the admin, on every
// internship payment those people make. Separate from referrals (lib/
// referrals), which are achievement cards interns post when they do well.
//
// Commissions are recorded once per paid internship payment, at the
// percentage set at that moment. The balance (commissions minus payouts)
// can only be cashed out in full once it reaches the admin's minimum
// (₦5,000 by default), on request or automatically at the end of a month.

export const AFFILIATE_CLICK_COOKIE = "ga_affiliate_click";
export const AFFILIATE_VISITOR_COOKIE = "ga_affiliate_visitor";
export const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const db = () => getPrisma();
type Tx = Prisma.TransactionClient;

export const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

export function inviteUrl(code: string) {
  return `${getSiteUrl()}/invite/${code}`;
}

/** Only admitted interns (paid, not removed) can be affiliates. */
export async function isAffiliateEligible(userId: string) {
  const admitted = await db().internshipApplication.findFirst({
    where: {
      studentId: userId,
      student: REAL_USER,
      status: { not: "REMOVED" },
      payment: { is: { status: "PAID" } },
    },
    select: { id: true },
  });
  return Boolean(admitted);
}

export async function getAffiliateSettings() {
  const settings = await getPlatformSettings();
  return {
    commissionPercent: settings.affiliateCommissionPercent,
    payoutMinimum: settings.affiliatePayoutMinimum,
  };
}

const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short, easy to read out, and not guessable from the intern's name. */
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** Signs an eligible intern up to the program (once; joining again is a no-op). */
export async function joinAffiliateProgram(userId: string) {
  const existing = await db().affiliateProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db().affiliateProfile.create({ data: { userId, code: newCode() } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
        throw error;
      // Joined twice at once, or (very rarely) a code clash.
      const joined = await db().affiliateProfile.findUnique({ where: { userId } });
      if (joined) return joined;
    }
  }
  throw new Error("Could not create an affiliate code.");
}

/** A visit to an affiliate link; repeat visits by the same browser count once. */
export async function recordAffiliateClick(code: string, visitorKey: string) {
  if (!code || code.length > 40) return null;
  const affiliate = await db().affiliateProfile.findUnique({
    where: { code },
    select: { userId: true },
  });
  if (!affiliate) return null;
  const now = new Date();
  return db().affiliateClick.upsert({
    where: { affiliateId_visitorKey: { affiliateId: affiliate.userId, visitorKey } },
    create: { affiliateId: affiliate.userId, visitorKey, firstVisitedAt: now, lastVisitedAt: now },
    update: { lastVisitedAt: now },
    select: { id: true },
  });
}

/**
 * Credits a new account to the affiliate whose link its browser opened
 * first. Only accounts created after that visit count, never the
 * affiliate's own, and each person belongs to one affiliate for good.
 */
export async function recordAffiliateRegistration(request: NextRequest, userId: string) {
  const clickId = request.cookies.get(AFFILIATE_CLICK_COOKIE)?.value;
  if (!clickId) return;
  const prisma = db();
  const [click, user] = await Promise.all([
    prisma.affiliateClick.findUnique({
      where: { id: clickId },
      select: { id: true, affiliateId: true, firstVisitedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
  ]);
  if (!click || !user || click.affiliateId === userId) return;
  if (click.firstVisitedAt > user.createdAt) return;
  try {
    await prisma.affiliateReferral.create({
      data: { affiliateId: click.affiliateId, referredUserId: userId, clickId: click.id },
      select: { id: true },
    });
  } catch (error) {
    // Already credited (callbacks can be replayed): the first one stands.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

/**
 * Records the commission for a paid internship payment, if the person who
 * paid came through an affiliate. Safe to call more than once per payment.
 * Never throws: a payment must not fail because of the affiliate program.
 */
export async function recordAffiliateCommission(internshipPaymentId: string) {
  try {
    const prisma = db();
    const payment = await prisma.internshipPayment.findUnique({
      where: { id: internshipPaymentId },
      select: {
        id: true,
        amount: true,
        status: true,
        affiliateCommission: { select: { id: true } },
        application: {
          select: {
            program: { select: { name: true } },
            student: {
              select: {
                name: true,
                affiliateReferredBy: { select: { id: true, affiliateId: true } },
              },
            },
          },
        },
      },
    });
    const referral = payment?.application.student.affiliateReferredBy;
    if (!payment || payment.status !== "PAID" || payment.affiliateCommission || !referral)
      return;
    const { commissionPercent } = await getAffiliateSettings();
    const amount = Math.round((payment.amount * commissionPercent) / 100);
    if (amount <= 0) return;
    try {
      await prisma.affiliateCommission.create({
        data: {
          affiliateId: referral.affiliateId,
          referralId: referral.id,
          internshipPaymentId: payment.id,
          paymentAmount: payment.amount,
          percent: commissionPercent,
          amount,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
    const firstName = payment.application.student.name?.trim().split(/\s+/)[0] || "Someone you invited";
    await prisma.notification.create({
      data: {
        userId: referral.affiliateId,
        title: `You earned ${naira(amount)} commission`,
        message: `${firstName} paid for the ${payment.application.program.name} internship through your affiliate link.`,
        type: NotificationType.SUCCESS,
        audience: LearnerAudience.INTERNSHIP,
      },
    });
  } catch (error) {
    console.error("Failed to record an affiliate commission:", error);
  }
}

/**
 * Catches up commissions for payments whose success wasn't seen (e.g. made
 * before someone was credited, or a missed webhook).
 */
export async function syncAffiliateCommissions(affiliateId?: string) {
  const missing = await db().internshipPayment.findMany({
    where: {
      status: "PAID",
      affiliateCommission: { is: null },
      application: {
        student: {
          affiliateReferredBy: affiliateId ? { is: { affiliateId } } : { isNot: null },
        },
      },
    },
    select: { id: true },
    take: 200,
  });
  for (const payment of missing) await recordAffiliateCommission(payment.id);
}

/**
 * Earned (commissions on payments that are still paid), already paid out or
 * requested, and what's left to cash out.
 */
export async function affiliateBalance(affiliateId: string, tx: Tx = db()) {
  const [earned, reserved] = await Promise.all([
    tx.affiliateCommission.aggregate({
      where: { affiliateId, internshipPayment: { status: "PAID" } },
      _sum: { amount: true },
    }),
    tx.affiliatePayout.groupBy({
      by: ["status"],
      where: { affiliateId, status: { in: ["PENDING", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);
  const sum = (status: "PENDING" | "PAID") =>
    reserved.find((row) => row.status === status)?._sum.amount ?? 0;
  const totalEarned = earned._sum.amount ?? 0;
  return {
    totalEarned,
    pending: sum("PENDING"),
    paidOut: sum("PAID"),
    available: Math.max(0, totalEarned - sum("PENDING") - sum("PAID")),
  };
}

const ACCOUNT_NUMBER = /^\d{10}$/;

/** Validates bank details from a form; returns the cleaned values or an error. */
export function parseBankDetails(body: Record<string, unknown>) {
  const text = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
  const bankName = text(body.bankName).slice(0, 80);
  const accountName = text(body.accountName).slice(0, 120);
  const accountNumber = text(body.accountNumber).replace(/\s/g, "");
  if (!bankName || !accountName)
    return { error: "Enter your bank name and the name on the account." } as const;
  if (!ACCOUNT_NUMBER.test(accountNumber))
    return { error: "Enter your 10-digit account number (NUBAN)." } as const;
  return { bankName, accountName, accountNumber } as const;
}

export type PayoutRefusal =
  | "no_bank_details"
  | "below_minimum"
  | "already_pending";

/**
 * Cashes out the whole available balance, if it has reached the minimum,
 * bank details are saved and nothing is already waiting to be paid.
 */
export async function requestAffiliatePayout(affiliateId: string, automatic = false) {
  const { payoutMinimum } = await getAffiliateSettings();
  const result = await db().$transaction(async (tx) => {
    // One request at a time per affiliate, even if they tap twice.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`affiliate-payout:${affiliateId}`}))`;
    const profile = await tx.affiliateProfile.findUnique({ where: { userId: affiliateId } });
    if (!profile?.bankName || !profile.accountNumber || !profile.accountName)
      return { refused: "no_bank_details" as PayoutRefusal };
    const pending = await tx.affiliatePayout.findFirst({
      where: { affiliateId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) return { refused: "already_pending" as PayoutRefusal };
    const { available } = await affiliateBalance(affiliateId, tx);
    if (available < payoutMinimum) return { refused: "below_minimum" as PayoutRefusal };
    const payout = await tx.affiliatePayout.create({
      data: {
        affiliateId,
        amount: available,
        automatic,
        bankName: profile.bankName,
        accountNumber: profile.accountNumber,
        accountName: profile.accountName,
      },
    });
    await tx.notification.create({
      data: {
        userId: affiliateId,
        title: automatic ? "Your month-end cash-out was requested" : "Cash-out requested",
        message: `${naira(payout.amount)} will be paid to ${profile.bankName} ${profile.accountNumber}. You'll be notified when it's sent.`,
        audience: LearnerAudience.INTERNSHIP,
      },
    });
    return { payout };
  });
  return { ...result, payoutMinimum };
}

/**
 * The end-of-month run (app/api/cron/affiliate-payouts): cashes out every
 * affiliate who chose it and whose balance has reached the minimum.
 */
export async function runMonthlyAffiliatePayouts() {
  await syncAffiliateCommissions();
  const profiles = await db().affiliateProfile.findMany({
    where: { autoMonthlyPayout: true },
    select: { userId: true },
  });
  let requested = 0;
  for (const { userId } of profiles) {
    const result = await requestAffiliatePayout(userId, true).catch((error) => {
      console.error("Month-end affiliate cash-out failed:", error);
      return null;
    });
    if (result?.payout) requested += 1;
  }
  return { checked: profiles.length, requested };
}

/** Everything an affiliate's dashboard shows. */
export async function affiliateDashboard(userId: string) {
  await syncAffiliateCommissions(userId);
  const prisma = db();
  const [profile, settings, balance, clicks, referrals, payouts] = await Promise.all([
    prisma.affiliateProfile.findUniqueOrThrow({ where: { userId } }),
    getAffiliateSettings(),
    affiliateBalance(userId),
    prisma.affiliateClick.count({ where: { affiliateId: userId } }),
    prisma.affiliateReferral.findMany({
      where: { affiliateId: userId },
      orderBy: { registeredAt: "desc" },
      take: 100,
      select: {
        id: true,
        registeredAt: true,
        referredUser: { select: { name: true, profile: { select: { firstName: true, lastName: true } } } },
        commissions: {
          where: { internshipPayment: { status: "PAID" } },
          select: { amount: true, createdAt: true },
        },
      },
    }),
    prisma.affiliatePayout.findMany({
      where: { affiliateId: userId },
      orderBy: { requestedAt: "desc" },
      take: 24,
      select: {
        id: true,
        amount: true,
        status: true,
        automatic: true,
        requestedAt: true,
        processedAt: true,
        adminNote: true,
      },
    }),
  ]);
  return {
    code: profile.code,
    link: inviteUrl(profile.code),
    commissionPercent: settings.commissionPercent,
    payoutMinimum: settings.payoutMinimum,
    bankDetails: profile.bankName
      ? { bankName: profile.bankName, accountNumber: profile.accountNumber!, accountName: profile.accountName! }
      : null,
    autoMonthlyPayout: profile.autoMonthlyPayout,
    joinedAt: profile.joinedAt.toISOString(),
    stats: {
      clicks,
      signUps: referrals.length,
      paid: referrals.filter((row) => row.commissions.length > 0).length,
    },
    balance,
    // First name and last initial only: affiliates don't need people's details.
    people: referrals.map((row) => {
      const first = row.referredUser.profile?.firstName?.trim() || row.referredUser.name?.trim().split(/\s+/)[0] || "New member";
      const last = row.referredUser.profile?.lastName?.trim() || row.referredUser.name?.trim().split(/\s+/)[1] || "";
      return {
        id: row.id,
        name: last ? `${first} ${last[0]}.` : first,
        joinedAt: row.registeredAt.toISOString(),
        earned: row.commissions.reduce((total, commission) => total + commission.amount, 0),
        paidAt: row.commissions[0]?.createdAt.toISOString() ?? null,
      };
    }),
    payouts: payouts.map((payout) => ({
      ...payout,
      requestedAt: payout.requestedAt.toISOString(),
      processedAt: payout.processedAt?.toISOString() ?? null,
    })),
  };
}
export type AffiliateDashboard = Awaited<ReturnType<typeof affiliateDashboard>>;
