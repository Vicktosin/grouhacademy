import { NextResponse } from "next/server";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { listLevels } from "@/lib/internship-levels";
import { getRecommendations, setRecommendations } from "@/lib/intern-resources";

/**
 * Tracks and levels to choose from, plus, for ?programId=&levelId=, that
 * pair's recommended resources and the resources that can be added.
 */
export async function GET(request: Request) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;

  const params = new URL(request.url).searchParams;
  const programId = params.get("programId");
  const levelId = params.get("levelId");
  const [tracks, levels] = await Promise.all([
    getPrisma().internshipProgram.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listLevels(),
  ]);

  const selection =
    programId && levelId ? await getRecommendations(programId, levelId) : null;
  return NextResponse.json({
    tracks,
    levels: levels.map(({ id, name }) => ({ id, name })),
    ...(selection ?? { recommended: [], available: [] }),
  });
}

/** Body: { programId, levelId, resourceIds } in display order. */
export async function PUT(request: Request) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const programId = typeof body?.programId === "string" ? body.programId : "";
  const levelId = typeof body?.levelId === "string" ? body.levelId : "";
  const resourceIds = Array.isArray(body?.resourceIds)
    ? body.resourceIds.filter((id): id is string => typeof id === "string")
    : null;
  if (!programId || !levelId || !resourceIds)
    return NextResponse.json(
      { error: "Choose a track, a level and the resources to recommend." },
      { status: 400 },
    );
  const track = await getPrisma().internshipProgram.findUnique({
    where: { id: programId },
    select: { id: true },
  });
  if (!track)
    return NextResponse.json({ error: "Track not found." }, { status: 404 });

  const failure = await setRecommendations(programId, levelId, resourceIds);
  if (failure) return NextResponse.json(failure, { status: 400 });
  return NextResponse.json(await getRecommendations(programId, levelId));
}
