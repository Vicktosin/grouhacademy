import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { requireAdminApi } from "@/lib/api-guards";
import { AchievementDefinitionInputSchema } from "@/lib/achievements";
import { getPrisma } from "@/lib/prisma";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();
  const [definitions, shares, clicks, attributions] = await Promise.all([
    prisma.achievementDefinition.findMany({
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { title: "asc" }],
      include: {
        program: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        _count: { select: { unlocks: true } },
      },
    }),
    prisma.achievementShare.findMany({
      select: {
        id: true,
        achievementUnlock: { select: { definitionId: true } },
      },
    }),
    prisma.referralClick.groupBy({
      by: ["shareId"],
      _count: { _all: true },
    }),
    prisma.referralAttribution.groupBy({
      by: ["shareId"],
      _count: { _all: true },
    }),
  ]);
  const shareDefinition = new Map(
    shares.map((share) => [share.id, share.achievementUnlock.definitionId]),
  );
  const stats = new Map<string, { shares: number; clicks: number; registrations: number }>();
  for (const share of shares) {
    const current = stats.get(share.achievementUnlock.definitionId) ?? {
      shares: 0,
      clicks: 0,
      registrations: 0,
    };
    current.shares += 1;
    stats.set(share.achievementUnlock.definitionId, current);
  }
  for (const row of clicks) {
    const definitionId = shareDefinition.get(row.shareId);
    if (definitionId) stats.get(definitionId)!.clicks += row._count._all;
  }
  for (const row of attributions) {
    const definitionId = shareDefinition.get(row.shareId);
    if (definitionId) stats.get(definitionId)!.registrations += row._count._all;
  }

  const [programs, levels] = await Promise.all([
    prisma.internshipProgram.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.internshipLevel.findMany({
      select: { id: true, name: true },
      orderBy: { rank: "asc" },
    }),
  ]);
  return NextResponse.json({
    definitions: definitions.map(({ _count, ...definition }) => ({
      ...definition,
      stats: {
        unlocks: _count.unlocks,
        ...(stats.get(definition.id) ?? { shares: 0, clicks: 0, registrations: 0 }),
      },
    })),
    programs,
    levels,
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body: unknown = await request.json().catch(() => null);
  const parsed = AchievementDefinitionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the achievement details." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const prisma = getPrisma();
  if (input.programId && !(await prisma.internshipProgram.findUnique({ where: { id: input.programId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose an existing internship track." }, { status: 400 });
  }
  if (input.levelId && !(await prisma.internshipLevel.findUnique({ where: { id: input.levelId }, select: { id: true } }))) {
    return NextResponse.json({ error: "Choose an existing internship level." }, { status: 400 });
  }

  const definition = await prisma.$transaction(async (tx) => {
    const created = await tx.achievementDefinition.create({
      data: {
        ...input,
        conditions: input.conditions as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "ACHIEVEMENT_CREATED",
        resourceType: "AchievementDefinition",
        resourceId: created.id,
        details: { title: created.title, trigger: created.trigger },
      },
      select: { id: true },
    });
    return created;
  });
  return NextResponse.json({ definition }, { status: 201 });
}
