import { InternResourceStatus, RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Internship Resources: the interns' mini LMS. Interns reach a resource only
// through their track (InternshipProgram), never through the student-side
// Course/Enrollment models, and every intern-facing query goes through
// internResourceWhere() so a resource from another track is simply not found.

type Db = ReturnType<typeof getPrisma>;

export const internResourceInclude = {
  level: { select: { id: true, name: true, rank: true } },
  tracks: {
    orderBy: { program: { name: "asc" as const } },
    include: { program: { select: { id: true, name: true } } },
  },
  modules: {
    orderBy: { order: "asc" as const },
    include: {
      materials: { orderBy: { createdAt: "asc" as const } },
      lessons: {
        orderBy: { order: "asc" as const },
        include: { materials: { orderBy: { createdAt: "asc" as const } } },
      },
    },
  },
} as const;

export type InternResourceRecord = NonNullable<
  Awaited<ReturnType<typeof findResource>>
>;

function findResource(where: { id: string } | { slug: string }) {
  return getPrisma().internResource.findFirst({
    where,
    include: internResourceInclude,
  });
}

// ---------------------------------------------------------------------------
// Intern access
// ---------------------------------------------------------------------------

/** A track the intern belongs to, and the highest level they reached in it. */
export type InternTrackAccess = { programId: string; rank: number };

/**
 * The tracks an intern may see resources for, with their level in each:
 * every application that has unlocked the internship workspace (acceptance
 * fee paid), matching
 * hasInternshipWorkspaceAccess(). An intern has one application per level,
 * so the highest such level per track wins.
 */
export async function getInternTrackAccess(
  userId: string,
): Promise<InternTrackAccess[]> {
  const applications = await getPrisma().internshipApplication.findMany({
    where: {
      studentId: userId,
      status: { not: "REMOVED" },
      payment: { is: { status: "PAID" } },
    },
    select: { programId: true, level: { select: { rank: true } } },
  });
  const rankByTrack = new Map<string, number>();
  for (const { programId, level } of applications)
    rankByTrack.set(
      programId,
      Math.max(level.rank, rankByTrack.get(programId) ?? 0),
    );
  return [...rankByTrack].map(([programId, rank]) => ({ programId, rank }));
}

/**
 * Published resources on one of the intern's tracks, at their level in that
 * track or below. (No access → matches nothing.)
 */
export function internResourceWhere(access: InternTrackAccess[]) {
  return {
    status: InternResourceStatus.PUBLISHED,
    OR: access.map(({ programId, rank }) => ({
      tracks: { some: { programId } },
      level: { rank: { lte: rank } },
    })),
  };
}

export async function listResourcesForIntern(userId: string) {
  const access = await getInternTrackAccess(userId);
  if (!access.length) return [];
  const trackIds = access.map((item) => item.programId);
  const prisma = getPrisma();
  const resources = await prisma.internResource.findMany({
    where: internResourceWhere(access),
    orderBy: { createdAt: "desc" },
    include: {
      level: { select: { name: true } },
      tracks: {
        where: { programId: { in: trackIds } },
        include: { program: { select: { name: true } } },
      },
      modules: { select: { lessons: { select: { id: true } } } },
    },
  });

  const lessonIds = resources.flatMap((resource) =>
    resource.modules.flatMap((module) => module.lessons.map((l) => l.id)),
  );
  const completed = lessonIds.length
    ? await prisma.internResourceLessonProgress.findMany({
        where: { userId, completed: true, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedIds = new Set(completed.map((row) => row.lessonId));

  return resources.map((resource) => {
    const ids = resource.modules.flatMap((module) =>
      module.lessons.map((lesson) => lesson.id),
    );
    const done = ids.filter((id) => completedIds.has(id)).length;
    return {
      id: resource.id,
      levelId: resource.levelId,
      trackIds: resource.tracks.map((track) => track.programId),
      slug: resource.slug,
      title: resource.title,
      description: resource.description,
      thumbnail: resource.thumbnail,
      trackNames: resource.tracks.map((track) => track.program.name),
      levelName: resource.level.name,
      moduleCount: resource.modules.length,
      totalLessons: ids.length,
      completedLessons: done,
      progressPercent: ids.length ? Math.round((done / ids.length) * 100) : 0,
    };
  });
}

export type InternResourceSummary = Awaited<
  ReturnType<typeof listResourcesForIntern>
>[number];

const MAX_RECOMMENDED = 6;

/**
 * Resources recommended to the intern for their current track and level:
 * the admins' picks in order, or, when none are set, the newest resources
 * at their level. Only resources the intern can open are included.
 */
export async function listRecommendedForIntern(userId: string) {
  const prisma = getPrisma();
  const application = await prisma.internshipApplication.findFirst({
    where: { studentId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      programId: true,
      levelId: true,
      program: { select: { name: true } },
      level: { select: { name: true } },
    },
  });
  if (!application) return null;

  const visible = await listResourcesForIntern(userId);
  const byId = new Map(visible.map((resource) => [resource.id, resource]));
  const picks = await prisma.internResourceRecommendation.findMany({
    where: { programId: application.programId, levelId: application.levelId },
    orderBy: { order: "asc" },
    select: { resourceId: true },
  });
  const curated = picks.flatMap(({ resourceId }) => byId.get(resourceId) ?? []);

  return {
    programName: application.program.name,
    levelName: application.level.name,
    curated: curated.length > 0,
    resources: (curated.length
      ? curated
      : visible.filter(
          (resource) =>
            resource.levelId === application.levelId &&
            resource.trackIds.includes(application.programId),
        )
    ).slice(0, MAX_RECOMMENDED),
  };
}

/**
 * A resource the intern may open, or null if it isn't on their track or is
 * above their level.
 */
export async function getResourceForIntern(userId: string, slug: string) {
  const access = await getInternTrackAccess(userId);
  if (!access.length) return null;
  return getPrisma().internResource.findFirst({
    where: { slug, ...internResourceWhere(access) },
    include: internResourceInclude,
  });
}

export function resourceLessonIds(resource: InternResourceRecord) {
  return resource.modules.flatMap((module) =>
    module.lessons.map((lesson) => lesson.id),
  );
}

/** Lesson completion counts for one intern within one resource. */
export async function resourceProgress(
  userId: string,
  resource: InternResourceRecord,
) {
  const lessonIds = resourceLessonIds(resource);
  const rows = lessonIds.length
    ? await getPrisma().internResourceLessonProgress.findMany({
        where: { userId, completed: true, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    : [];
  const completedLessonIds = new Set(rows.map((row) => row.lessonId));
  const totalLessons = lessonIds.length;
  const completedLessons = completedLessonIds.size;
  return {
    completedLessonIds,
    completedLessons,
    totalLessons,
    progressPercent: totalLessons
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0,
  };
}

// ---------------------------------------------------------------------------
// Admin management
// ---------------------------------------------------------------------------

export function getResourceById(id: string) {
  return findResource({ id });
}

export function serializeAdminResource(resource: InternResourceRecord) {
  return {
    id: resource.id,
    slug: resource.slug,
    title: resource.title,
    description: resource.description,
    thumbnail: resource.thumbnail,
    status: resource.status,
    createdById: resource.createdById,
    reviewNote: resource.reviewNote,
    levelId: resource.levelId,
    levelName: resource.level.name,
    updatedAt: resource.updatedAt,
    tracks: resource.tracks.map((track) => ({
      id: track.program.id,
      name: track.program.name,
    })),
    modules: resource.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      videoUrl: module.videoUrl,
      content: module.content,
      materials: module.materials.map(({ id, title, url }) => ({
        id,
        title,
        url,
      })),
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        content: lesson.content,
        materials: lesson.materials.map(({ id, title, url }) => ({
          id,
          title,
          url,
        })),
      })),
    })),
  };
}

export type AdminInternResource = ReturnType<typeof serializeAdminResource>;

type MaterialInput = { id?: string; title: string; url: string };
type LessonInput = {
  id?: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  materials: MaterialInput[];
};
export type ResourceModuleInput = {
  id?: string;
  title: string;
  description: string | null;
  content: string | null;
  videoUrl: string | null;
  materials: MaterialInput[];
  lessons: LessonInput[];
};

export type ResourceWriteInput = {
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  status?: InternResourceStatus;
  /** Why an admin sent a Support Admin's resource back as a draft. */
  reviewNote?: string | null;
  levelId?: string;
  trackIds?: string[];
  modules?: ResourceModuleInput[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  return text(value) || null;
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function parseMaterials(value: unknown): MaterialInput[] {
  return list(value)
    .map((item) => ({
      id: optionalText(item.id) ?? undefined,
      url: text(item.url),
      title: text(item.title) || text(item.url),
    }))
    .filter((item) => item.url);
}

function parseModules(value: unknown): ResourceModuleInput[] {
  return list(value).map((module, index) => ({
    id: optionalText(module.id) ?? undefined,
    title: text(module.title) || `Module ${index + 1}`,
    description: optionalText(module.description),
    content: optionalText(module.content),
    videoUrl: optionalText(module.videoUrl),
    materials: parseMaterials(module.materials),
    lessons: list(module.lessons).map((lesson, lessonIndex) => ({
      id: optionalText(lesson.id) ?? undefined,
      title: text(lesson.title) || `Lesson ${lessonIndex + 1}`,
      content: optionalText(lesson.content),
      videoUrl: optionalText(lesson.videoUrl),
      materials: parseMaterials(lesson.materials),
    })),
  }));
}

/**
 * Validates an admin create/update body. `partial` (PATCH) leaves absent
 * fields undefined so they keep their current values.
 */
export function parseResourceInput(
  body: unknown,
  partial: boolean,
): { input: ResourceWriteInput } | { error: string } {
  if (typeof body !== "object" || body === null)
    return { error: "Resource details are required." };
  const raw = body as Record<string, unknown>;
  const input: ResourceWriteInput = {};

  if (!partial || raw.title !== undefined) {
    input.title = text(raw.title);
    if (!input.title) return { error: "Give the resource a title." };
  }
  if (raw.description !== undefined)
    input.description = optionalText(raw.description);
  if (raw.thumbnail !== undefined)
    input.thumbnail = optionalText(raw.thumbnail);
  if (raw.status !== undefined) {
    if (
      !Object.values(InternResourceStatus).includes(
        raw.status as InternResourceStatus,
      )
    )
      return { error: "Status must be DRAFT, PENDING_REVIEW or PUBLISHED." };
    input.status = raw.status as InternResourceStatus;
  }
  if (raw.reviewNote !== undefined)
    input.reviewNote = optionalText(raw.reviewNote)?.slice(0, 1000) ?? null;
  if (!partial || raw.trackIds !== undefined) {
    const ids = Array.isArray(raw.trackIds)
      ? raw.trackIds.filter((id): id is string => typeof id === "string")
      : [];
    input.trackIds = [...new Set(ids)];
    if (!input.trackIds.length)
      return { error: "Assign the resource to at least one track." };
  }
  if (raw.levelId !== undefined) {
    if (typeof raw.levelId !== "string" || !raw.levelId)
      return { error: "Choose a level for the resource." };
    input.levelId = raw.levelId;
  }
  if (raw.modules !== undefined) input.modules = parseModules(raw.modules);
  return { input };
}

/**
 * What a Support Admin may not do with a resource: they create drafts, send
 * them for review and edit their own until an admin publishes them. Only an
 * admin publishes, edits someone else's or a published resource, or deletes.
 * Returns the refusal, or null when it's allowed.
 */
export function supportAdminResourceError(
  userId: string,
  input: ResourceWriteInput,
  existing?: { createdById: string | null; status: InternResourceStatus },
) {
  if (input.status === InternResourceStatus.PUBLISHED)
    return "Only an administrator can publish resources. Send it for review instead.";
  if (input.reviewNote !== undefined)
    return "Only an administrator can review resources.";
  if (!existing) return null;
  if (existing.createdById !== userId)
    return "Only an administrator can change a resource someone else created.";
  if (existing.status === InternResourceStatus.PUBLISHED)
    return "This resource is published. Only an administrator can change it now.";
  return null;
}

/** Whether a Support Admin can still edit this resource (see above). */
export function supportAdminCanEdit(
  userId: string,
  resource: { createdById: string | null; status: InternResourceStatus },
) {
  return (
    resource.createdById === userId &&
    resource.status !== InternResourceStatus.PUBLISHED
  );
}

/**
 * The review fields that go with a status change: sending for review stamps
 * the time and clears an old review note; publishing clears the note.
 */
export function reviewFieldsFor(
  status: InternResourceStatus | undefined,
  previous: InternResourceStatus | null,
  reviewNote: string | null | undefined,
) {
  if (status === InternResourceStatus.PENDING_REVIEW && previous !== status)
    return { submittedForReviewAt: new Date(), reviewNote: null };
  if (status === InternResourceStatus.PUBLISHED) return { reviewNote: null };
  return reviewNote === undefined ? {} : { reviewNote };
}

/** Tells every admin that a Support Admin has sent a resource for review. */
export async function notifyAdminsOfReview(title: string, senderId: string) {
  const prisma = getPrisma();
  const [sender, admins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true, email: true },
    }),
    prisma.user.findMany({
      where: { roles: { some: { role: { name: RoleName.ADMIN } } } },
      select: { id: true },
    }),
  ]);
  if (!admins.length) return;
  const who = sender?.name?.trim() || sender?.email || "A Support Admin";
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: "Resource waiting for review",
      message: `${who} sent “${title}” for review. Publish it or send it back from Resources.`,
    })),
  });
}

/** Returns the ids that are not real tracks (empty when all are valid). */
export async function unknownTrackIds(db: Db, trackIds: string[]) {
  const found = await db.internshipProgram.findMany({
    where: { id: { in: trackIds } },
    select: { id: true },
  });
  const valid = new Set(found.map((track) => track.id));
  return trackIds.filter((id) => !valid.has(id));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function uniqueResourceSlug(db: Db, title: string) {
  const base = slugify(title) || "resource";
  let slug = base;
  for (let n = 2; await db.internResource.findUnique({ where: { slug } }); n++)
    slug = `${base}-${n}`;
  return slug;
}

function materialData(materials: MaterialInput[]) {
  return materials.map(({ title, url }) => ({ title, url }));
}

function lessonCreateData(lesson: LessonInput, order: number) {
  return {
    title: lesson.title,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    order,
    materials: { create: materialData(lesson.materials) },
  };
}

export function moduleCreateData(module: ResourceModuleInput, order: number) {
  return {
    title: module.title,
    description: module.description,
    videoUrl: module.videoUrl,
    content: module.content,
    order,
    materials: { create: materialData(module.materials) },
    lessons: {
      create: module.lessons.map((lesson, index) =>
        lessonCreateData(lesson, index),
      ),
    },
  };
}

/** Ids from `incoming` that still exist; everything else is new. */
function keptIds(incoming: { id?: string }[], existing: { id: string }[]) {
  const known = new Set(existing.map((item) => item.id));
  return incoming
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id && known.has(id)));
}

async function syncModuleMaterials(
  db: Db,
  moduleId: string,
  incoming: MaterialInput[],
  existing: { id: string }[],
) {
  const kept = keptIds(incoming, existing);
  await db.internResourceModuleMaterial.deleteMany({
    where: { moduleId, id: { notIn: kept } },
  });
  for (const material of incoming) {
    const data = { title: material.title, url: material.url };
    if (material.id && kept.includes(material.id))
      await db.internResourceModuleMaterial.update({
        where: { id: material.id },
        data,
      });
    else
      await db.internResourceModuleMaterial.create({
        data: { ...data, moduleId },
      });
  }
}

async function syncLessonMaterials(
  db: Db,
  lessonId: string,
  incoming: MaterialInput[],
  existing: { id: string }[],
) {
  const kept = keptIds(incoming, existing);
  await db.internResourceLessonMaterial.deleteMany({
    where: { lessonId, id: { notIn: kept } },
  });
  for (const material of incoming) {
    const data = { title: material.title, url: material.url };
    if (material.id && kept.includes(material.id))
      await db.internResourceLessonMaterial.update({
        where: { id: material.id },
        data,
      });
    else
      await db.internResourceLessonMaterial.create({
        data: { ...data, lessonId },
      });
  }
}

/**
 * Updates the curriculum in place, keeping the ids of modules and lessons
 * that still exist so interns' lesson progress survives an edit.
 */
export async function syncResourceCurriculum(
  db: Db,
  resource: InternResourceRecord,
  incoming: ResourceModuleInput[],
) {
  const keptModules = keptIds(incoming, resource.modules);
  await db.internResourceModule.deleteMany({
    where: { resourceId: resource.id, id: { notIn: keptModules } },
  });

  for (const [order, module] of incoming.entries()) {
    const existing = resource.modules.find((item) => item.id === module.id);
    if (!existing) {
      await db.internResourceModule.create({
        data: { ...moduleCreateData(module, order), resourceId: resource.id },
      });
      continue;
    }

    await db.internResourceModule.update({
      where: { id: existing.id },
      data: {
        title: module.title,
        description: module.description,
        videoUrl: module.videoUrl,
        content: module.content,
        order,
      },
    });
    await syncModuleMaterials(
      db,
      existing.id,
      module.materials,
      existing.materials,
    );

    const keptLessons = keptIds(module.lessons, existing.lessons);
    await db.internResourceLesson.deleteMany({
      where: { moduleId: existing.id, id: { notIn: keptLessons } },
    });
    for (const [lessonOrder, lesson] of module.lessons.entries()) {
      const existingLesson = existing.lessons.find(
        (item) => item.id === lesson.id,
      );
      if (!existingLesson) {
        await db.internResourceLesson.create({
          data: {
            ...lessonCreateData(lesson, lessonOrder),
            moduleId: existing.id,
          },
        });
        continue;
      }
      await db.internResourceLesson.update({
        where: { id: existingLesson.id },
        data: {
          title: lesson.title,
          content: lesson.content,
          videoUrl: lesson.videoUrl,
          order: lessonOrder,
        },
      });
      await syncLessonMaterials(
        db,
        existingLesson.id,
        lesson.materials,
        existingLesson.materials,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Recommendations (admin)
// ---------------------------------------------------------------------------

/**
 * Resources that may be recommended for a track at a level: on that track,
 * at that level or below. Drafts are listed too (they only reach interns
 * once published).
 */
async function recommendableResources(programId: string, levelId: string) {
  const prisma = getPrisma();
  const level = await prisma.internshipLevel.findUnique({
    where: { id: levelId },
    select: { rank: true },
  });
  if (!level) return null;
  return prisma.internResource.findMany({
    where: {
      tracks: { some: { programId } },
      level: { rank: { lte: level.rank } },
    },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      level: { select: { name: true } },
    },
  });
}

/** The recommended list for a track and level, and what can be added. */
export async function getRecommendations(programId: string, levelId: string) {
  const available = await recommendableResources(programId, levelId);
  if (!available) return null;
  const picks = await getPrisma().internResourceRecommendation.findMany({
    where: { programId, levelId },
    orderBy: { order: "asc" },
    select: { resourceId: true },
  });
  const byId = new Map(
    available.map((resource) => [
      resource.id,
      {
        id: resource.id,
        title: resource.title,
        status: resource.status,
        levelName: resource.level.name,
      },
    ]),
  );
  return {
    recommended: picks.flatMap(({ resourceId }) => byId.get(resourceId) ?? []),
    available: [...byId.values()],
  };
}

/** Replaces the recommended list (in order) for a track and level. */
export async function setRecommendations(
  programId: string,
  levelId: string,
  resourceIds: string[],
): Promise<{ error: string } | null> {
  const available = await recommendableResources(programId, levelId);
  if (!available) return { error: "Level not found." };
  const allowed = new Set(available.map((resource) => resource.id));
  const ids = [...new Set(resourceIds)];
  if (ids.some((id) => !allowed.has(id)))
    return {
      error:
        "Only resources on this track, at this level or below, can be recommended.",
    };

  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.internResourceRecommendation.deleteMany({
      where: { programId, levelId },
    }),
    prisma.internResourceRecommendation.createMany({
      data: ids.map((resourceId, order) => ({
        programId,
        levelId,
        resourceId,
        order,
      })),
    }),
  ]);
  return null;
}
