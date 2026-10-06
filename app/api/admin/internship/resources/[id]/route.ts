import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { resolveLevelId } from "@/lib/internship-levels";
import {
  getResourceById,
  internResourceInclude,
  parseResourceInput,
  serializeAdminResource,
  syncResourceCurriculum,
  unknownTrackIds,
} from "@/lib/intern-resources";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Resource not found." }, { status: 404 });

export async function GET(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const resource = await getResourceById((await params).id);
  if (!resource) return notFound();
  return NextResponse.json(serializeAdminResource(resource));
}

/**
 * Partial update: any of title, description, thumbnail, status, trackIds and
 * modules. The resource list's publish/unpublish toggle sends only status.
 */
export async function PATCH(request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const existing = await getResourceById((await params).id);
  if (!existing) return notFound();

  const parsed = parseResourceInput(
    await request.json().catch(() => null),
    true,
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { input } = parsed;

  const prisma = getPrisma();
  if (input.trackIds && (await unknownTrackIds(prisma, input.trackIds)).length)
    return NextResponse.json(
      { error: "One of the selected tracks no longer exists." },
      { status: 400 },
    );

  if (input.levelId && !(await resolveLevelId(input.levelId)))
    return NextResponse.json(
      { error: "The selected level no longer exists." },
      { status: 400 },
    );

  const resource = await prisma.$transaction(
    async (tx) => {
      const db = tx as ReturnType<typeof getPrisma>;
      await db.internResource.update({
        where: { id: existing.id },
        data: {
          title: input.title,
          description: input.description,
          thumbnail: input.thumbnail,
          status: input.status,
          levelId: input.levelId,
        },
      });

      if (input.trackIds) {
        await db.internResourceTrack.deleteMany({
          where: {
            resourceId: existing.id,
            programId: { notIn: input.trackIds },
          },
        });
        await db.internResourceTrack.createMany({
          data: input.trackIds.map((programId) => ({
            resourceId: existing.id,
            programId,
          })),
          skipDuplicates: true,
        });
      }

      if (input.modules)
        await syncResourceCurriculum(db, existing, input.modules);

      return db.internResource.findUniqueOrThrow({
        where: { id: existing.id },
        include: internResourceInclude,
      });
      // A long curriculum is synced row by row; allow more than the 5s default.
    },
    { timeout: 30_000 },
  );

  return NextResponse.json(serializeAdminResource(resource));
}

export async function DELETE(_request: Request, { params }: Params) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;

  const existing = await getResourceById((await params).id);
  if (!existing) return notFound();
  await getPrisma().internResource.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
