import { NextResponse } from "next/server";
import { requireSupportOrAdminApi } from "@/lib/api-guards";
import { getPrisma } from "@/lib/prisma";
import { resolveLevelId } from "@/lib/internship-levels";
import {
  internResourceInclude,
  moduleCreateData,
  notifyAdminsOfReview,
  parseResourceInput,
  reviewFieldsFor,
  serializeAdminResource,
  supportAdminCanEdit,
  supportAdminResourceError,
  uniqueResourceSlug,
  unknownTrackIds,
} from "@/lib/intern-resources";
import { storeImage } from "@/lib/stored-images";

/**
 * Every resource across all tracks, for the Resources table. Support Admins
 * see them all too, with which ones they can still edit.
 */
export async function GET() {
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;

  const resources = await getPrisma().internResource.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      level: { select: { id: true, name: true, rank: true } },
      tracks: {
        orderBy: { program: { name: "asc" } },
        include: { program: { select: { id: true, name: true } } },
      },
      modules: { select: { _count: { select: { lessons: true } } } },
      creator: { select: { name: true, email: true } },
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
      submittedForReviewAt: resource.submittedForReviewAt,
      reviewNote: resource.reviewNote,
      createdBy: resource.creator
        ? resource.creator.name?.trim() || resource.creator.email
        : null,
      canEdit:
        access.isMainAdmin || supportAdminCanEdit(access.userId, resource),
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
  const access = await requireSupportOrAdminApi();
  if (access instanceof NextResponse) return access;
  const adminId = access.userId;

  const parsed = parseResourceInput(
    await request.json().catch(() => null),
    false,
  );
  if ("error" in parsed)
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { input } = parsed;
  const refusal = access.isMainAdmin
    ? null
    : supportAdminResourceError(adminId, input);
  if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
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

  // A data: image thumbnail goes to Storage; only its URL is saved.
  try {
    input.thumbnail = await storeImage(input.thumbnail, "resource-thumbnails");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save the thumbnail." },
      { status: 400 },
    );
  }

  const resource = await prisma.internResource.create({
    data: {
      levelId,
      slug: await uniqueResourceSlug(prisma, input.title ?? ""),
      title: input.title ?? "",
      description: input.description ?? null,
      thumbnail: input.thumbnail ?? null,
      status: input.status,
      ...reviewFieldsFor(input.status, null, input.reviewNote),
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

  if (resource.status === "PENDING_REVIEW" && !access.isMainAdmin)
    await notifyAdminsOfReview(resource.title, adminId).catch((error) =>
      console.error("Failed to notify admins of a resource review:", error),
    );

  return NextResponse.json(
    { ...serializeAdminResource(resource), canEdit: true },
    { status: 201 },
  );
}
