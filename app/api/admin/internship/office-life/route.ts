import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { defaultOfficeLifeContent, parseOfficeLifeContent } from "@/lib/office-life/content";
import { getPrisma } from "@/lib/prisma";
import { listLevels } from "@/lib/internship-levels";
import { saveOfficeLifeContent } from "@/lib/office-life/admin";

export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
  const prisma = getPrisma();
  const programId = new URL(request.url).searchParams.get("programId");
  const levelId = new URL(request.url).searchParams.get("levelId");
  if (!programId || !levelId) {
    const [programs, levels] = await Promise.all([
      prisma.internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      }),
      listLevels(),
    ]);
    return NextResponse.json({ tracks: programs, levels: levels.map(({ id, name, rank }) => ({ id, name, rank })) });
  }

  const track = await prisma.internshipProgram.findUnique({
    where: { id: programId },
    select: { id: true, name: true },
  });
  if (!track) return NextResponse.json({ error: "Track not found." }, { status: 404 });
  const level = await prisma.internshipLevel.findUnique({ where: { id: levelId }, select: { id: true, name: true, rank: true } });
  if (!level) return NextResponse.json({ error: "Level not found." }, { status: 404 });
  const [savedRow, scenarios] = await Promise.all([
    prisma.officeLifeContent.findUnique({ where: { programId_levelId: { programId, levelId } }, select: { content: true } }),
    prisma.labScenario.findMany({
      where: { programId, published: true, level: { rank: { lte: level.rank } } },
      orderBy: [{ level: { rank: "asc" } }, { title: "asc" }],
      select: { id: true, title: true, kind: true, level: { select: { name: true } } },
    }),
  ]);
  const saved = parseOfficeLifeContent(savedRow?.content);
  return NextResponse.json({
    id: track.id,
    name: track.name,
    level: { id: level.id, name: level.name, rank: level.rank },
    customized: Boolean(saved),
    content: saved ?? defaultOfficeLifeContent(track.name, level.name),
    labScenarios: scenarios.map(({ id, title, kind, level: scenarioLevel }) => ({ id, title, kind, level: scenarioLevel.name })),
  });
  } catch (error) {
    console.error("[office-life admin] Failed to load content.", error);
    return NextResponse.json({ error: process.env.NODE_ENV === "development" && error instanceof Error ? error.message : "Unable to load Office Life content." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.programId !== "string" || typeof body.levelId !== "string")
    return NextResponse.json({ error: "Choose a track and level." }, { status: 400 });
  const result = await saveOfficeLifeContent(body.programId, body.levelId, body.content);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const params = new URL(request.url).searchParams;
  const programId = params.get("programId");
  const levelId = params.get("levelId");
  if (!programId || !levelId) return NextResponse.json({ error: "Choose a track and level." }, { status: 400 });
  await getPrisma().officeLifeContent.deleteMany({ where: { programId, levelId } });
  return NextResponse.json({ ok: true });
}