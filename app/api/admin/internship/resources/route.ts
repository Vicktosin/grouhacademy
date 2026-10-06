import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { resolveLevelId } from "@/lib/internship-levels";
import {
  internResourceInclude,
  moduleCreateData,
  parseResourceInput,
  serializeAdminResource,
  uniqueResourceSlug,
  unknownTrackIds,
} from "@/lib/intern-resources";

/** Every resource across all tracks, for the admin Resources table. */
export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const resources = await getPrisma().internResource.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      level: { select: { id: true, name: true, rank: true } },
      tracks: {
        orderBy: { program: { name: "asc" } },
        include: { program: { select: { id: true, name: true } } },
      },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });

  return NextResponse.json({
    resources: resources.map((resource) => ({
      id: resource.id,
      slug: resource.slug,
      title: resource.title,
      status: resource.status,
      level: resource.level,
      updatedAt: resource.updatedAt,
      tracks: resource.tracks.map((track) => track.program),
      moduleCount: resource.modules.length,
      lessonCount: resource.modules.reduce(
        (total, module) => total + module._count.lessons,
        0,
      ),
    })),
  });
}

export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const parsed = parseResourceInput(
    await request.json().catch(() => null),
    false,
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { input } = parsed;
  const trackIds = input.trackIds ?? [];

  const prisma = getPrisma();
  if ((await unknownTrackIds(prisma, trackIds)).length)
    return NextResponse.json(
      { error: "One of the selected tracks no longer exists." },
      { status: 400 },
    );

  // Without a level, a new resource is for Entry.
  const levelId = await resolveLevelId(input.levelId);
  if (!levelId)
    return NextResponse.json(
      { error: "The selected level no longer exists." },
      { status: 400 },
    );

  const resource = await prisma.internResource.create({
    data: {
      levelId,
      slug: await uniqueResourceSlug(prisma, input.title ?? ""),
      title: input.title ?? "",
      description: input.description ?? null,
      thumbnail: input.thumbnail ?? null,
      status: input.status,
      createdById: adminId,
      tracks: { create: trackIds.map((programId) => ({ programId })) },
      modules: {
        create: (input.modules ?? []).map((module, order) =>
          moduleCreateData(module, order),
        ),
      },
    },
    include: internResourceInclude,
  });

  return NextResponse.json(serializeAdminResource(resource), { status: 201 });
}
