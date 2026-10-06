import { InternResourceStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// Internship Resources: the interns' mini LMS. Interns reach a resource only
// through their track (InternshipProgram), never through the student-side
// Course/Enrollment models, and every intern-facing query goes through
// internResourceWhere() so a resource from another track is simply not found.

type Db = ReturnType<typeof getPrisma>;

export const internResourceInclude = {
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

/**
 * The tracks an intern may see resources for: those of every application
 * that has unlocked the internship workspace (acceptance fee paid and
 * entrance assessment passed), matching hasInternshipWorkspaceAccess().
 */
export async function getInternTrackIds(userId: string): Promise<string[]> {
  const applications = await getPrisma().internshipApplication.findMany({
    where: {
      studentId: userId,
      payment: { is: { status: "PAID" } },
      attempts: { some: { status: "PASSED" } },
    },
    select: { programId: true },
  });
  return [...new Set(applications.map((item) => item.programId))];
}

/** Published resources assigned to at least one of the given tracks. */
export function internResourceWhere(trackIds: string[]) {
  return {
    status: InternResourceStatus.PUBLISHED,
    tracks: { some: { programId: { in: trackIds } } },
  };
}

export async function listResourcesForIntern(userId: string) {
  const trackIds = await getInternTrackIds(userId);
  if (!trackIds.length) return [];
  const prisma = getPrisma();
  const resources = await prisma.internResource.findMany({
    where: internResourceWhere(trackIds),
    orderBy: { createdAt: "desc" },
    include: {
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
      slug: resource.slug,
      title: resource.title,
      description: resource.description,
      thumbnail: resource.thumbnail,
      trackNames: resource.tracks.map((track) => track.program.name),
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

/** A resource the intern may open, or null if it isn't on their track. */
export async function getResourceForIntern(userId: string, slug: string) {
  const trackIds = await getInternTrackIds(userId);
  if (!trackIds.length) return null;
  return getPrisma().internResource.findFirst({
    where: { slug, ...internResourceWhere(trackIds) },
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
      raw.status !== InternResourceStatus.DRAFT &&
      raw.status !== InternResourceStatus.PUBLISHED
    )
      return { error: "Status must be DRAFT or PUBLISHED." };
    input.status = raw.status;
  }
  if (!partial || raw.trackIds !== undefined) {
    const ids = Array.isArray(raw.trackIds)
      ? raw.trackIds.filter((id): id is string => typeof id === "string")
      : [];
    input.trackIds = [...new Set(ids)];
    if (!input.trackIds.length)
      return { error: "Assign the resource to at least one track." };
  }
  if (raw.modules !== undefined) input.modules = parseModules(raw.modules);
  return { input };
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
