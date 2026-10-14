import { getPrisma } from "@/lib/prisma";

// The admin Referrals page: how achievement sharing turns into visits,
// sign-ups and paid enrolments. Preview interns (admins' test accounts) are
// left out everywhere.

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export async function referralStats(days: number | null) {
  const prisma = getPrisma();
  const since = days ? new Date(Date.now() - days * DAY) : new Date(0);
  const real = { isPreview: false };

  const [unlocks, celebrated, shares, clicks, attributions] = await Promise.all([
    prisma.achievementUnlock.count({ where: { unlockedAt: { gte: since }, user: real } }),
    prisma.achievementUnlock.count({ where: { celebratedAt: { gte: since }, user: real } }),
    prisma.achievementShare.findMany({
      where: { createdAt: { gte: since }, referrer: real },
      select: {
        id: true,
        referrerId: true,
        channels: true,
        achievementUnlock: { select: { definitionId: true, titleSnapshot: true, definition: { select: { title: true } } } },
      },
    }),
    prisma.referralClick.findMany({
      where: { firstVisitedAt: { gte: since }, share: { referrer: real } },
      select: { shareId: true, firstVisitedAt: true, registrationStartedAt: true, share: { select: { referrerId: true } } },
    }),
    prisma.referralAttribution.findMany({
      where: { registeredAt: { gte: since }, referrer: real },
      orderBy: { registeredAt: "desc" },
      select: {
        shareId: true,
        referrerId: true,
        referredUserId: true,
        registeredAt: true,
        referredUser: { select: { name: true, email: true } },
        referrer: { select: { name: true, email: true } },
        share: { select: { achievementUnlock: { select: { titleSnapshot: true } } } },
      },
    }),
  ]);

  // What referred people went on to do: apply, and pay (internship fees and courses).
  const referredIds = attributions.map((row) => row.referredUserId);
  const [applications, coursePayments] = referredIds.length
    ? await Promise.all([
        prisma.internshipApplication.findMany({
          where: { studentId: { in: referredIds } },
          select: { studentId: true, program: { select: { name: true } }, payment: { select: { status: true, amount: true } } },
        }),
        prisma.payment.findMany({
          where: { userId: { in: referredIds }, status: "PAID" },
          select: { userId: true, amount: true },
        }),
      ])
    : [[], []];
  const outcome = new Map<string, { applied: boolean; track: string | null; paid: number }>();
  for (const id of referredIds) outcome.set(id, { applied: false, track: null, paid: 0 });
  for (const application of applications) {
    const row = outcome.get(application.studentId)!;
    row.applied = true;
    row.track ??= application.program.name;
    if (application.payment?.status === "PAID") row.paid += application.payment.amount;
  }
  for (const payment of coursePayments) outcome.get(payment.userId)!.paid += payment.amount;

  // Per share, then per intern and per achievement.
  const byShare = new Map<string, { visits: number; started: number; registrations: number; paid: number; revenue: number }>();
  const shareRow = (id: string) => {
    let row = byShare.get(id);
    if (!row) byShare.set(id, (row = { visits: 0, started: 0, registrations: 0, paid: 0, revenue: 0 }));
    return row;
  };
  for (const click of clicks) {
    const row = shareRow(click.shareId);
    row.visits += 1;
    if (click.registrationStartedAt) row.started += 1;
  }
  for (const attribution of attributions) {
    const row = shareRow(attribution.shareId);
    const result = outcome.get(attribution.referredUserId)!;
    row.registrations += 1;
    if (result.paid > 0) {
      row.paid += 1;
      row.revenue += result.paid;
    }
  }

  type Totals = { shares: number; visits: number; registrations: number; paid: number; revenue: number };
  const empty = (): Totals => ({ shares: 0, visits: 0, registrations: 0, paid: 0, revenue: 0 });
  const add = (target: Totals, shareId: string) => {
    const row = byShare.get(shareId);
    if (!row) return;
    target.visits += row.visits;
    target.registrations += row.registrations;
    target.paid += row.paid;
    target.revenue += row.revenue;
  };

  const shareOwner = new Map(shares.map((share) => [share.id, share]));
  const referrers = new Map<string, Totals>();
  const achievements = new Map<string, Totals & { title: string }>();
  const channels = new Map<string, number>();
  // Activity on shares made before the period still counts toward their intern.
  const shareIds = new Set([...shares.map((share) => share.id), ...byShare.keys()]);
  const olderShares = [...shareIds].filter((id) => !shareOwner.has(id));
  const older = olderShares.length
    ? await prisma.achievementShare.findMany({
        where: { id: { in: olderShares } },
        select: { id: true, referrerId: true, achievementUnlock: { select: { definitionId: true, definition: { select: { title: true } } } } },
      })
    : [];
  for (const share of older) shareOwner.set(share.id, { ...share, channels: [], achievementUnlock: { ...share.achievementUnlock, titleSnapshot: share.achievementUnlock.definition.title } });

  for (const id of shareIds) {
    const share = shareOwner.get(id);
    if (!share) continue;
    const isNew = shares.some((item) => item.id === id);
    const person = referrers.get(share.referrerId) ?? empty();
    if (isNew) person.shares += 1;
    add(person, id);
    referrers.set(share.referrerId, person);
    const definitionId = share.achievementUnlock.definitionId;
    const award = achievements.get(definitionId) ?? { ...empty(), title: share.achievementUnlock.definition.title };
    if (isNew) award.shares += 1;
    add(award, id);
    achievements.set(definitionId, award);
  }
  for (const share of shares) for (const channel of share.channels) channels.set(channel, (channels.get(channel) ?? 0) + 1);

  const people = referrers.size
    ? await prisma.user.findMany({
        where: { id: { in: [...referrers.keys()] } },
        select: {
          id: true,
          name: true,
          email: true,
          internshipApplications: { orderBy: { createdAt: "desc" }, take: 1, select: { program: { select: { name: true } } } },
        },
      })
    : [];
  const person = new Map(people.map((user) => [user.id, user]));

  // Daily visits and sign-ups (the last 90 days at most).
  const chartDays = Math.min(days ?? 90, 90);
  const daily = Array.from({ length: chartDays }, (_, index) => ({
    date: dayKey(new Date(Date.now() - (chartDays - 1 - index) * DAY)),
    visits: 0,
    registrations: 0,
  }));
  const dayIndex = new Map(daily.map((row, index) => [row.date, index]));
  for (const click of clicks) {
    const index = dayIndex.get(dayKey(click.firstVisitedAt));
    if (index !== undefined) daily[index].visits += 1;
  }
  for (const attribution of attributions) {
    const index = dayIndex.get(dayKey(attribution.registeredAt));
    if (index !== undefined) daily[index].registrations += 1;
  }

  const totals = {
    unlocks,
    celebrated,
    shares: shares.length,
    visits: clicks.length,
    started: clicks.filter((click) => click.registrationStartedAt).length,
    registrations: attributions.length,
    applied: [...outcome.values()].filter((row) => row.applied).length,
    paid: [...outcome.values()].filter((row) => row.paid > 0).length,
    revenue: [...outcome.values()].reduce((sum, row) => sum + row.paid, 0),
  };

  return {
    totals,
    daily,
    channels: [...channels.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count),
    referrers: [...referrers.entries()]
      .map(([id, stats]) => ({
        id,
        name: person.get(id)?.name ?? "Intern",
        email: person.get(id)?.email ?? "",
        track: person.get(id)?.internshipApplications[0]?.program.name ?? null,
        ...stats,
      }))
      .sort((a, b) => b.registrations - a.registrations || b.paid - a.paid || b.visits - a.visits || b.shares - a.shares)
      .slice(0, 50),
    achievements: [...achievements.values()].sort((a, b) => b.registrations - a.registrations || b.visits - a.visits || b.shares - a.shares),
    recent: attributions.slice(0, 50).map((row) => {
      const result = outcome.get(row.referredUserId)!;
      return {
        name: row.referredUser.name || row.referredUser.email,
        email: row.referredUser.email,
        registeredAt: row.registeredAt.toISOString(),
        referrer: row.referrer.name || row.referrer.email,
        achievement: row.share.achievementUnlock.titleSnapshot,
        track: result.track,
        status: result.paid > 0 ? "Paid" : result.applied ? "Applied" : "Signed up",
        amount: result.paid,
      };
    }),
  };
}
export type ReferralStats = Awaited<ReturnType<typeof referralStats>>;
