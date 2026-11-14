import type { Prisma, PrismaClient, TestimonialStatus } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { REAL_USER } from "@/lib/real-user";
import { isGoogleDriveUrl } from "@/lib/platform-settings-validation";
import {
  VOICE_NOTE_HARD_LIMIT,
  VOICE_NOTE_LIMIT,
  VOICE_NOTES_CLOSED,
  parseTestimonialTags,
  resolveDriveFolderUrl,
  type TestimonialCsvRow,
  type TestimonialInput,
} from "@/lib/testimonial-input";

// Graduation testimonials in the database: the flyer, and a video link,
// voice note or writing (see lib/testimonial-input). Used by the graduation
// pop-up (components/graduation), the testimonial page, the admin page and
// the MCP server.

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
      level: { select: { name: true } },
      cohort: { select: { name: true, testimonialDriveUrl: true } },
      testimonial: true,
    },
  });
}

function fullName(user: { name: string | null; email: string; profile: { firstName: string | null; lastName: string | null } | null }) {
  return (
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ").trim() ||
    user.name?.trim() ||
    user.email.split("@")[0]
  );
}

const nameSelect = {
  name: true,
  email: true,
  profile: { select: { firstName: true, lastName: true } },
} as const;

/**
 * Whether this intern has graduated: holds an internship certificate that
 * isn't revoked. An admin's preview intern counts as graduated, so the admin
 * can see the graduation experience. Returns the name for the flyer.
 */
async function graduation(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { ...nameSelect, isPreview: true, previewOwnerId: true },
  });
  if (!user) return null;
  if (user.isPreview) {
    // The flyer shows the admin's own name rather than "Preview Intern".
    const owner = user.previewOwnerId
      ? await db.user.findUnique({ where: { id: user.previewOwnerId }, select: nameSelect })
      : null;
    return { graduated: true, isPreview: true, certificateId: null, name: fullName(owner ?? user) };
  }
  const certificate = await db.internshipCertificate.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { issuedAt: "desc" },
    select: { id: true },
  });
  return { graduated: Boolean(certificate), isPreview: false, certificateId: certificate?.id ?? null, name: fullName(user) };
}

/** What the graduation pop-up and the testimonial page show. */
export async function getInternTestimonialForm(userId: string, db: PrismaClient = getPrisma()) {
  const [application, fallback, grad] = await Promise.all([
    currentApplication(db, userId),
    globalDriveUrl(db),
    graduation(db, userId),
  ]);
  if (!application || !grad) return null;
  const t = application.testimonial;
  return {
    trackName: application.program.name,
    levelName: application.level?.name ?? null,
    cohortName: application.cohort?.name ?? null,
    driveFolderUrl: resolveDriveFolderUrl(application.cohort?.testimonialDriveUrl, fallback),
    /** Holds an internship certificate (or is an admin's preview intern). */
    graduated: grad.graduated,
    /** The certificate the graduation is for (null for a preview). */
    certificateId: grad.certificateId,
    isPreview: grad.isPreview,
    /** Voice notes are still open to this intern (see voiceNotesOpen). */
    voiceNotesOpen: await voiceNotesOpen(userId, db),
    /** Has shared their experience (on any application, not just this one). */
    experienceShared: await hasSharedExperience(userId, db),
    /** The name printed on the flyer. */
    studentName: grad.name,
    flyerUrl: t?.flyerUrl ?? null,
    testimonial:
      t && (t.videoLink || t.voiceNoteUrl || t.testimonial)
        ? {
            videoLink: t.videoLink,
            voiceNoteUrl: t.voiceNoteUrl,
            testimonial: t.testimonial,
            rating: t.rating,
            consent: t.consent,
            updatedAt: t.updatedAt.toISOString(),
          }
        : null,
  };
}

/** Saves (or edits) the intern's experience for their current application. */
export async function saveInternTestimonial(
  userId: string,
  input: TestimonialInput,
  db: PrismaClient = getPrisma(),
) {
  const application = await currentApplication(db, userId);
  if (!application) return { ok: false as const, error: "No internship application found." };
  const data = {
    videoLink: input.videoLink,
    voiceNoteUrl: input.voiceNoteUrl,
    testimonial: input.testimonial,
    rating: input.rating,
    consent: input.consent,
  };
  const write = (client: Db) =>
    client.internTestimonial.upsert({
      where: { applicationId: application.id },
      create: {
        ...data,
        userId,
        applicationId: application.id,
        cohortId: application.cohortId,
        programId: application.programId,
      },
      // An edited testimonial goes back for approval (the flyer is kept).
      update: { ...data, status: "PENDING" },
    });
  if (!input.voiceNoteUrl) {
    await write(db);
    return { ok: true as const };
  }
  // A voice note: strictly at most VOICE_NOTE_HARD_LIMIT people. The lock
  // makes simultaneous submissions take turns, so none can slip past it.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sabirole-voice-notes'))`;
    if (!(await hasOwnVoiceNote(userId, tx)) && (await countVoiceNotePeople(tx)) >= VOICE_NOTE_HARD_LIMIT)
      return { ok: false as const, error: VOICE_NOTES_CLOSED, closed: true };
    await write(tx);
    return { ok: true as const };
  });
}

/** Records the graduate's flyer (after they download or share it). */
export async function saveInternFlyer(userId: string, flyerUrl: string, db: PrismaClient = getPrisma()) {
  const [application, grad] = await Promise.all([currentApplication(db, userId), graduation(db, userId)]);
  if (!application) return { ok: false as const, error: "No internship application found." };
  if (!grad?.graduated) return { ok: false as const, error: "The graduation flyer is for interns who have completed." };
  const previous = application.testimonial?.flyerUrl ?? null;
  await db.internTestimonial.upsert({
    where: { applicationId: application.id },
    create: {
      flyerUrl,
      userId,
      applicationId: application.id,
      cohortId: application.cohortId,
      programId: application.programId,
    },
    update: { flyerUrl },
  });
  /** The flyer this one replaces (to delete from storage), if any. */
  return { ok: true as const, replaced: previous && previous !== flyerUrl ? previous : null };
}

/** Whether the intern has ever shared their experience (any application). */
export async function hasSharedExperience(userId: string, db: PrismaClient = getPrisma()) {
  const found = await db.internTestimonial.findFirst({
    where: {
      userId,
      OR: [{ videoLink: { not: null } }, { voiceNoteUrl: { not: null } }, { testimonial: { not: "" } }],
    },
    select: { id: true },
  });
  return Boolean(found);
}

/**
 * Whether this intern must share their experience before downloading their
 * certificate: they hold one, and haven't shared yet. An admin's preview
 * intern is never held back.
 */
export async function mustShareExperience(userId: string, db: PrismaClient = getPrisma()) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isPreview: true } });
  if (!user || user.isPreview) return false;
  const certificate = await db.internshipCertificate.findFirst({
    where: { userId, revokedAt: null },
    select: { id: true },
  });
  if (!certificate) return false;
  return !(await hasSharedExperience(userId, db));
}

/** Every flyer and voice note URL a testimonial still points to. */
export async function testimonialMediaInUse(db: PrismaClient = getPrisma()) {
  const rows = await db.internTestimonial.findMany({
    where: { OR: [{ flyerUrl: { not: null } }, { voiceNoteUrl: { not: null } }] },
    select: { flyerUrl: true, voiceNoteUrl: true },
  });
  return rows.flatMap((row) => [row.flyerUrl, row.voiceNoteUrl]);
}

/** Whether the intern may make a flyer (graduated, or an admin's preview). */
type Db = PrismaClient | Prisma.TransactionClient;

function hasOwnVoiceNote(userId: string, db: Db) {
  return db.internTestimonial
    .findFirst({ where: { userId, voiceNoteUrl: { not: null } }, select: { id: true } })
    .then(Boolean);
}

/** How many different real interns have sent a voice note. */
export async function countVoiceNotePeople(db: Db = getPrisma()) {
  const rows = await db.internTestimonial.findMany({
    where: { voiceNoteUrl: { not: null }, user: REAL_USER },
    distinct: ["userId"],
    select: { userId: true },
  });
  return rows.length;
}

/**
 * Whether this intern may send a voice note: the option shows until
 * VOICE_NOTE_LIMIT people have sent one (pass VOICE_NOTE_HARD_LIMIT to check
 * the strict maximum). Someone who already has one may still replace it.
 */
export async function voiceNotesOpen(
  userId: string,
  db: PrismaClient = getPrisma(),
  limit: number = VOICE_NOTE_LIMIT,
) {
  if (await hasOwnVoiceNote(userId, db)) return true;
  return (await countVoiceNotePeople(db)) < limit;
}

export async function canMakeFlyer(userId: string, db: PrismaClient = getPrisma()) {
  return Boolean((await graduation(db, userId))?.graduated);
}

export type TestimonialFilter = {
  cohortId?: string | null;
  programId?: string | null;
  status?: TestimonialStatus | null;
  consentOnly?: boolean;
  /**
   * Also include this admin's own preview intern's testimonial (flagged
   * isPreview), so they can check what they sent while previewing. Never
   * anyone else's preview, and never in exports.
   */
  includePreviewOf?: string | null;
};

export async function listTestimonials(filter: TestimonialFilter, db: PrismaClient = getPrisma()) {
  const user: Prisma.UserWhereInput = filter.includePreviewOf
    ? { OR: [REAL_USER, { previewOwnerId: filter.includePreviewOf }] }
    : REAL_USER;
  const rows = await db.internTestimonial.findMany({
    where: {
      user,
      ...(filter.cohortId && { cohortId: filter.cohortId }),
      ...(filter.programId && { programId: filter.programId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.consentOnly && { consent: true }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      videoLink: true,
      voiceNoteUrl: true,
      flyerUrl: true,
      testimonial: true,
      rating: true,
      consent: true,
      status: true,
      tags: true,
      createdAt: true,
      updatedAt: true,
      cohortId: true,
      programId: true,
      user: { select: { id: true, isPreview: true, ...nameSelect } },
      program: { select: { name: true } },
      cohort: { select: { name: true } },
      application: { select: { level: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.user.id,
    name: fullName(row.user),
    email: row.user.email,
    isPreview: row.user.isPreview,
    programId: row.programId,
    track: row.program.name,
    level: row.application.level?.name ?? null,
    cohortId: row.cohortId,
    cohort: row.cohort?.name ?? null,
    rating: row.rating,
    testimonial: row.testimonial,
    videoLink: row.videoLink,
    voiceNoteUrl: row.voiceNoteUrl,
    flyerUrl: row.flyerUrl,
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
    voiceNoteUrl: item.voiceNoteUrl,
    flyerUrl: item.flyerUrl,
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
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
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

/** Real interns with a non-revoked internship certificate (admin count). */
export function countGraduates(db: PrismaClient = getPrisma()) {
  return db.user.count({
    where: { ...REAL_USER, internshipCertificates: { some: { revokedAt: null } } },
  });
}
