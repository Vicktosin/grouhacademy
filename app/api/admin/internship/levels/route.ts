import { NextResponse } from "next/server";
import { requireAdminApi, requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";

// Internship levels, managed by admins. Order (rank) decides which level an
// intern moves up to next, so levels can be reordered but not left with gaps
// that matter: only relative order is used.

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function levelsWithUsage() {
  const levels = await getPrisma().internshipLevel.findMany({
    orderBy: { rank: "asc" },
    include: {
      _count: {
        select: {
          applications: true,
          cohorts: true,
          assessments: true,
          resources: true,
        },
      },
    },
  });
  return levels.map(({ _count, ...level }) => ({
    ...level,
    usage: _count,
    inUse: Object.values(_count).some(Boolean),
  }));
}

export async function GET() {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  return NextResponse.json({ levels: await levelsWithUsage() });
}

/** Adds a level after the current highest one. */
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const name = text(body?.name);
  if (!name)
    return NextResponse.json(
      { error: "Give the level a name." },
      { status: 400 },
    );

  const prisma = getPrisma();
  if (await prisma.internshipLevel.findUnique({ where: { name } }))
    return NextResponse.json(
      { error: "A level with this name already exists." },
      { status: 409 },
    );
  const top = await prisma.internshipLevel.findFirst({
    orderBy: { rank: "desc" },
    select: { rank: true },
  });
  await prisma.internshipLevel.create({
    data: {
      name,
      description: text(body?.description) || null,
      rank: (top?.rank ?? 0) + 1,
    },
  });
  return NextResponse.json(
    { levels: await levelsWithUsage() },
    { status: 201 },
  );
}

/**
 * Body: { id, name?, description? } to edit, or { id, move: "up" | "down" }
 * to swap a level with its neighbour.
 */
export async function PATCH(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = text(body?.id);
  const prisma = getPrisma();
  const level = id
    ? await prisma.internshipLevel.findUnique({ where: { id } })
    : null;
  if (!level)
    return NextResponse.json({ error: "Level not found." }, { status: 404 });

  if (body?.move === "up" || body?.move === "down") {
    const neighbour = await prisma.internshipLevel.findFirst({
      where: {
        rank: body.move === "up" ? { lt: level.rank } : { gt: level.rank },
      },
      orderBy: { rank: body.move === "up" ? "desc" : "asc" },
    });
    if (neighbour)
      // rank is unique, so park one level on a free rank during the swap.
      await prisma.$transaction([
        prisma.internshipLevel.update({
          where: { id: level.id },
          data: { rank: -level.rank },
        }),
        prisma.internshipLevel.update({
          where: { id: neighbour.id },
          data: { rank: level.rank },
        }),
        prisma.internshipLevel.update({
          where: { id: level.id },
          data: { rank: neighbour.rank },
        }),
      ]);
    return NextResponse.json({ levels: await levelsWithUsage() });
  }

  const name = body?.name === undefined ? level.name : text(body.name);
  if (!name)
    return NextResponse.json(
      { error: "Give the level a name." },
      { status: 400 },
    );
  const duplicate = await prisma.internshipLevel.findFirst({
    where: { name, id: { not: level.id } },
    select: { id: true },
  });
  if (duplicate)
    return NextResponse.json(
      { error: "A level with this name already exists." },
      { status: 409 },
    );
  await prisma.internshipLevel.update({
    where: { id: level.id },
    data: {
      name,
      description:
        body?.description === undefined
          ? level.description
          : text(body.description) || null,
    },
  });
  return NextResponse.json({ levels: await levelsWithUsage() });
}

/** Deletes a level nothing uses yet. Body: { id }. */
export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const id = text(body?.id);
  const level = (await levelsWithUsage()).find((item) => item.id === id);
  if (!level)
    return NextResponse.json({ error: "Level not found." }, { status: 404 });
  if (level.inUse)
    return NextResponse.json(
      {
        error:
          "Interns, cohorts, assessments or resources use this level, so it can't be deleted. Rename it instead.",
      },
      { status: 409 },
    );
  const prisma = getPrisma();
  if ((await prisma.internshipLevel.count()) <= 1)
    return NextResponse.json(
      { error: "At least one level must remain." },
      { status: 409 },
    );
  await prisma.internshipLevel.delete({ where: { id } });
  return NextResponse.json({ levels: await levelsWithUsage() });
}
