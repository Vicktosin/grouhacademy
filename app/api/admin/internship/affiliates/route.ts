import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import {
  affiliateBalance,
  getAffiliateSettings,
  syncAffiliateCommissions,
} from "@/lib/affiliates";
import { getPlatformSettings } from "@/lib/platform-settings";
import { getPrisma } from "@/lib/prisma";

/** The Affiliates admin page: settings, cash-out requests and every affiliate. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  await syncAffiliateCommissions();
  const prisma = getPrisma();
  const [settings, profiles, payouts] = await Promise.all([
    getAffiliateSettings(),
    prisma.affiliateProfile.findMany({
      orderBy: { joinedAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { clicks: true, referrals: true } },
        referrals: {
          where: { commissions: { some: { internshipPayment: { status: "PAID" } } } },
          select: { id: true },
        },
      },
    }),
    prisma.affiliatePayout.findMany({
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
      take: 300,
      include: { affiliate: { select: { user: { select: { name: true, email: true } } } } },
    }),
  ]);

  const affiliates = await Promise.all(
    profiles.map(async (profile) => ({
      id: profile.userId,
      name: profile.user.name?.trim() || profile.user.email,
      email: profile.user.email,
      code: profile.code,
      joinedAt: profile.joinedAt.toISOString(),
      clicks: profile._count.clicks,
      signUps: profile._count.referrals,
      paid: profile.referrals.length,
      autoMonthlyPayout: profile.autoMonthlyPayout,
      bankDetails: profile.bankName
        ? { bankName: profile.bankName, accountNumber: profile.accountNumber, accountName: profile.accountName }
        : null,
      ...(await affiliateBalance(profile.userId)),
    })),
  );

  return NextResponse.json({
    settings,
    affiliates,
    payouts: payouts.map((payout) => ({
      id: payout.id,
      name: payout.affiliate.user.name?.trim() || payout.affiliate.user.email,
      email: payout.affiliate.user.email,
      amount: payout.amount,
      status: payout.status,
      automatic: payout.automatic,
      bankName: payout.bankName,
      accountNumber: payout.accountNumber,
      accountName: payout.accountName,
      requestedAt: payout.requestedAt.toISOString(),
      processedAt: payout.processedAt?.toISOString() ?? null,
      adminNote: payout.adminNote,
    })),
  });
}

/**
 * Body: { commissionPercent, payoutMinimum }. A new percentage applies to
 * payments from now on; commissions already earned keep theirs.
 */
export async function PATCH(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const percent = body?.commissionPercent;
  const minimum = body?.payoutMinimum;
  if (typeof percent !== "number" || !Number.isInteger(percent) || percent < 0 || percent > 100)
    return NextResponse.json(
      { error: "Commission must be a whole percentage from 0 to 100." },
      { status: 400 },
    );
  if (typeof minimum !== "number" || !Number.isInteger(minimum) || minimum < 1 || minimum > 10_000_000)
    return NextResponse.json(
      { error: "The minimum cash-out must be a whole naira amount above zero." },
      { status: 400 },
    );
  await getPlatformSettings(); // makes sure the settings row exists
  await getPrisma().platformSettings.update({
    where: { id: "singleton" },
    data: { affiliateCommissionPercent: percent, affiliatePayoutMinimum: minimum },
  });
  return NextResponse.json({ settings: await getAffiliateSettings() });
}
