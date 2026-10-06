import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { getEntryLevel, listLevels } from "@/lib/internship-levels";

// Acceptance fees per track and level. Entry is the track's own fee (the one
// on the Tracks page); higher levels are InternshipLevelFee rows. A level is
// open to applicants on a track once it has a fee and an entrance assessment.

async function feeTable() {
  const prisma = getPrisma();
  const [levels, tracks, fees, assessments] = await Promise.all([
    listLevels(),
    prisma.internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, acceptanceFee: true },
    }),
    prisma.internshipLevelFee.findMany(),
    prisma.internshipAssessment.findMany({
      where: { questions: { some: {} } },
      select: { programId: true, levelId: true },
    }),
  ]);
  const entryId = levels[0]?.id;
  const feeFor = new Map(
    fees.map((fee) => [`${fee.programId}:${fee.levelId}`, fee.acceptanceFee]),
  );
  const hasAssessment = new Set(
    assessments.map((item) => `${item.programId}:${item.levelId}`),
  );

  return {
    levels: levels.map(({ id, name }) => ({ id, name })),
    tracks: tracks.map((track) => ({
      id: track.id,
      name: track.name,
      status: track.status,
      levels: levels.map((level) => {
        const key = `${track.id}:${level.id}`;
        const fee =
          level.id === entryId ? track.acceptanceFee : feeFor.get(key);
        return {
          levelId: level.id,
          acceptanceFee: fee ?? null,
          hasAssessment: hasAssessment.has(key),
        };
      }),
    })),
  };
}

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  return NextResponse.json(await feeTable());
}

/**
 * Sets one fee. Body: { programId, levelId, acceptanceFee } in naira; an
 * empty fee closes a level above Entry for that track.
 */
export async function PUT(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const programId = typeof body?.programId === "string" ? body.programId : "";
  const levelId = typeof body?.levelId === "string" ? body.levelId : "";
  const raw = body?.acceptanceFee;
  const fee = raw === null || raw === "" ? null : Number(raw);
  if (fee !== null && (!Number.isInteger(fee) || fee < 0))
    return NextResponse.json(
      { error: "Enter the fee as a whole number of naira." },
      { status: 400 },
    );

  const prisma = getPrisma();
  const [program, level] = await Promise.all([
    prisma.internshipProgram.findUnique({
      where: { id: programId },
      select: { id: true },
    }),
    prisma.internshipLevel.findUnique({
      where: { id: levelId },
      select: { id: true },
    }),
  ]);
  if (!program || !level)
    return NextResponse.json(
      { error: "Track or level not found." },
      { status: 404 },
    );

  if (levelId === (await getEntryLevel()).id) {
    if (fee === null)
      return NextResponse.json(
        { error: "Entry level always needs a fee." },
        { status: 400 },
      );
    await prisma.internshipProgram.update({
      where: { id: programId },
      data: { acceptanceFee: fee },
    });
  } else if (fee === null) {
    await prisma.internshipLevelFee.deleteMany({
      where: { programId, levelId },
    });
  } else {
    await prisma.internshipLevelFee.upsert({
      where: { programId_levelId: { programId, levelId } },
      create: { programId, levelId, acceptanceFee: fee },
      update: { acceptanceFee: fee },
    });
  }

  return NextResponse.json(await feeTable());
}
