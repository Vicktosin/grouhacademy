import { NextResponse } from "next/server";
import { adminOnly, requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { resolveLevelId } from "@/lib/internship-levels";
import {
  getResourceById,
  internResourceInclude,
  notifyAdminsOfReview,
  parseResourceInput,
  reviewFieldsFor,
  serializeAdminResource,
  supportAdminCanEdit,
  supportAdminResourceError,
  syncResourceCurriculum,
  unknownTrackIds,
} from "@/lib/intern-resources";
import { storeImage } from "@/lib/stored-images";

type Params = { params: Promise<{ id: string }> };

const notFound = () =>
  NextResponse.json({ error: "Resource not found." }, { status: 404 });

export async function GET(_request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const resource = await getResourceById((await params).id);
  if (!resource) return notFound();
  return NextResponse.json({
    ...serializeAdminResource(resource),
    canEdit: access.isMainAdmin || supportAdminCanEdit(access.userId, resource),
  });
}

/**
 * Partial update: any of title, description, thumbnail, status, reviewNote,
 * trackIds and modules. The resource list's publish/unpublish and review
 * buttons send only status (and reviewNote).
 */
export async function PATCH(request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const existing = await getResourceById((await params).id);
  if (!existing) return notFound();

  const parsed = parseResourceInput(
    await request.json().catch(() => null),
    true,
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { input } = parsed;
  const refusal = access.isMainAdmin
    ? null
    : supportAdminResourceError(access.userId, input, existing);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });

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

  // A data: image thumbnail goes to Storage; only its URL is saved.
  try {
    input.thumbnail = await storeImage(input.thumbnail, "resource-thumbnails");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save the thumbnail." },
      { status: 400 },
    );
  }

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
          ...reviewFieldsFor(input.status, existing.status, input.reviewNote),
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

  if (
    !access.isMainAdmin &&
    resource.status === "PENDING_REVIEW" &&
    existing.status !== "PENDING_REVIEW"
  )
    await notifyAdminsOfReview(resource.title, access.userId).catch((error) =>
      console.error("Failed to notify admins of a resource review:", error),
    );

  return NextResponse.json({
    ...serializeAdminResource(resource),
    canEdit: access.isMainAdmin || supportAdminCanEdit(access.userId, resource),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  if (!access.isMainAdmin) return adminOnly("delete resources");

  const existing = await getResourceById((await params).id);
  if (!existing) return notFound();
  await getPrisma().internResource.delete({ where: { id: existing.id } });
  return new NextResponse(null, { status: 204 });
}
