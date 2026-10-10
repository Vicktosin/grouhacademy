import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { listLevels } from "@/lib/internship-levels";
import {
  getPreviewPlacement,
  placePreviewIntern,
  PREVIEW_COOKIE,
  resetPreviewIntern,
} from "@/lib/preview-intern";

// "Experience as intern" (lib/preview-intern): the choices, entering the
// internship as the admin's preview intern at a track, level and cohort,
// resetting what it did, and leaving.

const PREVIEW_HOURS = 8;

/** Tracks, levels, cohorts, and where the admin's preview intern is. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const prisma = getPrisma();
  const [programs, levels, cohorts, placement] = await Promise.all([
    prisma.internshipProgram.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    listLevels(),
    prisma.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        programId: true,
        levelId: true,
        startDate: true,
        endDate: true,
      },
    }),
    getPreviewPlacement(adminId),
  ]);

  return NextResponse.json({
    programs,
    levels: levels.map((level) => ({ id: level.id, name: level.name })),
    cohorts: cohorts.map((cohort) => ({
      ...cohort,
      startDate: cohort.startDate.toISOString(),
      endDate: cohort.endDate.toISOString(),
    })),
    placement,
  });
}

/**
 * `{ programId, levelId, cohortId }`: place the preview intern there and
 * enter preview. `{ action: "reset" }`: clear what it did.
 */
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    programId?: unknown;
    levelId?: unknown;
    cohortId?: unknown;
  };

  if (body.action === "reset") {
    await resetPreviewIntern(adminId);
    return NextResponse.json({ success: true });
  }

  if (typeof body.programId !== "string" || typeof body.levelId !== "string") {
    return NextResponse.json({ error: "Choose a track and a level." }, { status: 400 });
  }
  const cohortId = typeof body.cohortId === "string" && body.cohortId ? body.cohortId : null;

  const prisma = getPrisma();
  const [program, level, cohort] = await Promise.all([
    prisma.internshipProgram.findUnique({ where: { id: body.programId }, select: { id: true } }),
    prisma.internshipLevel.findUnique({ where: { id: body.levelId }, select: { id: true } }),
    cohortId
      ? prisma.internshipCohort.findUnique({
          where: { id: cohortId },
          select: { programId: true, levelId: true },
        })
      : null,
  ]);
  if (!program || !level) {
    return NextResponse.json({ error: "That track or level doesn't exist." }, { status: 400 });
  }
  if (cohortId && (!cohort || cohort.programId !== program.id || cohort.levelId !== level.id)) {
    return NextResponse.json(
      { error: "That cohort isn't for this track and level." },
      { status: 400 },
    );
  }

  await placePreviewIntern(adminId, { programId: program.id, levelId: level.id, cohortId });

  const response = NextResponse.json({ success: true });
  response.cookies.set(PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREVIEW_HOURS * 60 * 60,
  });
  return response;
}

/** Leave preview: the internship's pages are the admin's own again. */
export async function DELETE() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const response = NextResponse.json({ success: true });
  response.cookies.delete(PREVIEW_COOKIE);
  return response;
}
