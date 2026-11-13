import type { PrismaClient, TestimonialStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { REAL_USER } from "@/lib/real-user";
import { isGoogleDriveUrl } from "@/lib/platform-settings-validation";
import {
  parseTestimonialTags,
  resolveDriveFolderUrl,
  type TestimonialCsvRow,
  type TestimonialInput,
} from "@/lib/testimonial-input";

// Testimonials in the database (text only; see lib/testimonial-input).
// Used by the intern form, the admin page and the MCP server.

async function globalDriveUrl(db: PrismaClient) {
  const settings = await db.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { testimonialDriveUrl: true },
  });
  return settings?.testimonialDriveUrl ?? null;
}

/** The intern's current application (newest), as the rest of the app. */
function currentApplication(db: PrismaClient, userId: string) {
  return db.internshipApplication.findFirst({
    where: { studentId: userId, status: { not: "REMOVED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programId: true,
      cohortId: true,
      program: { select: { name: true } },
      cohort: { select: { name: true, testimonialDriveUrl: true } },
      testimonial: true,
    },
  });
}

/** What the intern's testimonial form shows. */
export async function getInternTestimonialForm(userId: string, db: PrismaClient = getPrisma()) {
  const [application, fallback] = await Promise.all([currentApplication(db, userId), globalDriveUrl(db)]);
  if (!application) return null;
  const t = application.testimonial;
  return {
    trackName: application.program.name,
    cohortName: application.cohort?.name ?? null,
    driveFolderUrl: resolveDriveFolderUrl(application.cohort?.testimonialDriveUrl, fallback),
    testimonial: t
      ? {
          videoLink: t.videoLink,
          testimonial: t.testimonial,
          rating: t.rating,
          consent: t.consent,
          updatedAt: t.updatedAt.toISOString(),
        }
      : null,
  };
}

/** Saves (or edits) the intern's testimonial for their current application. */
export async function saveInternTestimonial(
  userId: string,
  input: TestimonialInput,
  db: PrismaClient = getPrisma(),
) {
  const application = await currentApplication(db, userId);
  if (!application) return { ok: false as const, error: "No internship application found." };
  const data = {
    videoLink: input.videoLink,
    testimonial: input.testimonial,
    rating: input.rating,
    consent: input.consent,
  };
  await db.internTestimonial.upsert({
    where: { applicationId: application.id },
    create: {
      ...data,
      userId,
      applicationId: application.id,
      cohortId: application.cohortId,
      programId: application.programId,
    },
    // An edited testimonial goes back for approval.
    update: { ...data, status: "PENDING" },
  });
  return { ok: true as const };
}

export type TestimonialFilter = {
  cohortId?: string | null;
  programId?: string | null;
  status?: TestimonialStatus | null;
  consentOnly?: boolean;
};

export async function listTestimonials(filter: TestimonialFilter, db: PrismaClient = getPrisma()) {
  const rows = await db.internTestimonial.findMany({
    where: {
      user: REAL_USER,
      ...(filter.cohortId && { cohortId: filter.cohortId }),
      ...(filter.programId && { programId: filter.programId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.consentOnly && { consent: true }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      videoLink: true,
      testimonial: true,
      rating: true,
      consent: true,
      status: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      cohortId: true,
      programId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      program: { select: { name: true } },
      cohort: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.user.id,
    name:
      [row.user.profile?.firstName, row.user.profile?.lastName].filter(Boolean).join(" ").trim() ||
      row.user.name ||
      row.user.email,
    email: row.user.email,
    programId: row.programId,
    track: row.program.name,
    cohortId: row.cohortId,
    cohort: row.cohort?.name ?? null,
    rating: row.rating,
    testimonial: row.testimonial,
    videoLink: row.videoLink,
    consent: row.consent,
    status: row.status,
    tags: row.tags,
    submittedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export type TestimonialListItem = Awaited<ReturnType<typeof listTestimonials>>[number];

export function csvRows(items: TestimonialListItem[]): TestimonialCsvRow[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    track: item.track,
    cohort: item.cohort,
    rating: item.rating,
    testimonial: item.testimonial,
    videoLink: item.videoLink,
    consent: item.consent,
    status: item.status,
    tags: item.tags,
    submittedAt: item.submittedAt,
  }));
}

/** Approve / reject and tag a testimonial. */
export async function reviewTestimonial(
  id: string,
  body: { status?: unknown; tags?: unknown },
  db: PrismaClient = getPrisma(),
) {
  const data: { status?: TestimonialStatus; tags?: string[] } = {};
  if (body.status !== undefined) {
    if (body.status !== "PENDING" && body.status !== "APPROVED" && body.status !== "REJECTED")
      return { ok: false as const, error: "status must be PENDING, APPROVED or REJECTED." };
    data.status = body.status;
  }
  if (body.tags !== undefined) {
    const tags = parseTestimonialTags(body.tags);
    if (!tags) return { ok: false as const, error: "tags must be up to 10 short words." };
    data.tags = tags;
  }
  const existing = await db.internTestimonial.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false as const, error: "Testimonial not found." };
  await db.internTestimonial.update({ where: { id }, data });
  return { ok: true as const };
}

/**
 * Sets the Drive folder link for one cohort, or the global fallback when
 * cohortId is null. An empty link clears it.
 */
export async function setTestimonialDriveUrl(
  cohortId: string | null,
  url: string | null,
  updatedById: string | null,
  db: PrismaClient = getPrisma(),
) {
  const link = url?.trim() || null;
  if (link && (link.length > 2000 || !isGoogleDriveUrl(link)))
    return { ok: false as const, error: "Use a Google Drive link (https://drive.google.com/…)." };
  if (cohortId) {
    const cohort = await db.internshipCohort.findUnique({ where: { id: cohortId }, select: { id: true } });
    if (!cohort) return { ok: false as const, error: "Cohort not found." };
    await db.internshipCohort.update({ where: { id: cohortId }, data: { testimonialDriveUrl: link } });
  } else {
    await db.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", testimonialDriveUrl: link, updatedById },
      update: { testimonialDriveUrl: link, updatedById },
    });
  }
  return { ok: true as const, url: link };
}

/** The global link and each cohort's own link, for the admin page / MCP. */
export async function listTestimonialDriveLinks(db: PrismaClient = getPrisma()) {
  const [global, cohorts] = await Promise.all([
    globalDriveUrl(db),
    db.internshipCohort.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        testimonialDriveUrl: true,
        program: { select: { name: true } },
      },
    }),
  ]);
  return {
    global,
    cohorts: cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      programName: c.program.name,
      driveUrl: c.testimonialDriveUrl,
    })),
  };
}
