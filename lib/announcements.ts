import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import {
  isAnnouncementForViewer,
  parseAnnouncementInput,
  pendingPopups,
  type AnnouncementInput,
  type AnnouncementViewer,
  type AnnouncementWorkspace,
} from "@/lib/announcement-targeting";

// Announcements in the database: who a learner is (for targeting), their
// feed and pop-ups, and the create / update / delete used by the admin page
// and the MCP server. Targeting rules live in lib/announcement-targeting.

// Feeds look at this many recent announcements before targeting; plenty for
// a feed that shows the latest few.
const FEED_WINDOW = 200;

export async function loadAnnouncementViewer(
  userId: string,
  db: PrismaClient = getPrisma(),
): Promise<AnnouncementViewer> {
  const [applications, mentors] = await Promise.all([
    db.internshipApplication.findMany({
      where: { studentId: userId, status: { not: "REMOVED" } },
      select: { programId: true, cohortId: true },
    }),
    db.mentorAssignment.findMany({
      where: { internId: userId, status: "ACTIVE" },
      select: { mentorId: true },
    }),
  ]);
  return {
    programIds: [...new Set(applications.map((a) => a.programId))],
    cohortIds: [
      ...new Set(applications.flatMap((a) => (a.cohortId ? [a.cohortId] : []))),
    ],
    activeMentorIds: mentors.map((m) => m.mentorId),
  };
}

/** The newest announcements this learner may see, newest first. */
export async function announcementsForUser(
  userId: string,
  workspace: AnnouncementWorkspace | null,
  take: number,
) {
  const db = getPrisma();
  const [viewer, candidates] = await Promise.all([
    loadAnnouncementViewer(userId, db),
    db.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: FEED_WINDOW,
      include: { author: { select: { name: true } } },
    }),
  ]);
  return candidates
    .filter((a) => isAnnouncementForViewer(a, viewer, workspace))
    .slice(0, take);
}

/** Pop-ups this intern hasn't pressed "Got it" on yet, oldest first. */
export async function pendingPopupsForUser(userId: string) {
  const db = getPrisma();
  const [viewer, popups, dismissals] = await Promise.all([
    loadAnnouncementViewer(userId, db),
    db.announcement.findMany({
      where: { showAsPopup: true },
      orderBy: { createdAt: "desc" },
      take: FEED_WINDOW,
    }),
    db.announcementDismissal.findMany({
      where: { userId },
      select: { announcementId: true },
    }),
  ]);
  return pendingPopups(
    popups,
    viewer,
    dismissals.map((d) => d.announcementId),
  );
}

/** "Got it": the pop-up is never shown to this intern again. */
export async function dismissPopup(userId: string, announcementId: string) {
  const db = getPrisma();
  const exists = await db.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true },
  });
  if (!exists) return false;
  await db.announcementDismissal.upsert({
    where: { announcementId_userId: { announcementId, userId } },
    create: { announcementId, userId },
    update: {},
  });
  return true;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Track and cohorts exist, and the cohorts are on the track (when both). */
async function checkTargets(
  db: PrismaClient,
  input: Pick<AnnouncementInput, "programId" | "cohortIds">,
): Promise<string | null> {
  if (input.programId) {
    const program = await db.internshipProgram.findUnique({
      where: { id: input.programId },
      select: { id: true },
    });
    if (!program) return "Track not found.";
  }
  if (input.cohortIds.length) {
    const cohorts = await db.internshipCohort.findMany({
      where: { id: { in: input.cohortIds } },
      select: { id: true, programId: true },
    });
    const missing = input.cohortIds.filter((id) => !cohorts.some((c) => c.id === id));
    if (missing.length) return `Cohort not found: ${missing.join(", ")}.`;
    if (input.programId && cohorts.some((c) => c.programId !== input.programId))
      return "Every chosen cohort must be on the chosen track (or leave the track empty).";
  }
  return null;
}

/** Cohort-targeted and pop-up announcements only make sense for interns. */
function withAudience(input: AnnouncementInput): AnnouncementInput {
  return input.audience === null && (input.cohortIds.length > 0 || input.showAsPopup)
    ? { ...input, audience: "INTERNSHIP" }
    : input;
}

export async function createAnnouncement(
  authorId: string,
  body: Record<string, unknown>,
  db: PrismaClient = getPrisma(),
): Promise<Result<{ id: string }>> {
  const parsed = parseAnnouncementInput(body, { partial: false });
  if (!parsed.ok) return parsed;
  const input = withAudience(parsed.value as AnnouncementInput);
  const targetError = await checkTargets(db, input);
  if (targetError) return { ok: false, error: targetError };
  const announcement = await db.announcement.create({
    data: { authorId, scope: "GLOBAL", ...input },
    select: { id: true },
  });
  return { ok: true, value: announcement };
}

export async function updateAnnouncement(
  id: string,
  body: Record<string, unknown>,
  db: PrismaClient = getPrisma(),
): Promise<Result<{ id: string }>> {
  const existing = await db.announcement.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Announcement not found." };
  const patch = parseAnnouncementInput(body, { partial: true });
  if (!patch.ok) return patch;
  // Re-check the announcement as a whole, so e.g. adding cohorts to a
  // courses-only announcement is caught.
  const merged = parseAnnouncementInput(
    {
      title: existing.title,
      message: existing.message,
      audience: existing.audience,
      programId: existing.programId,
      cohortIds: existing.cohortIds,
      showAsPopup: existing.showAsPopup,
      ...patch.value,
    },
    { partial: false },
  );
  if (!merged.ok) return merged;
  const input = withAudience(merged.value as AnnouncementInput);
  const targetError = await checkTargets(db, input);
  if (targetError) return { ok: false, error: targetError };
  await db.announcement.update({ where: { id }, data: input });
  return { ok: true, value: { id } };
}

export async function deleteAnnouncement(
  id: string,
  db: PrismaClient = getPrisma(),
): Promise<Result<{ id: string }>> {
  const existing = await db.announcement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Announcement not found." };
  await db.announcement.delete({ where: { id } });
  return { ok: true, value: { id } };
}

/** Admin list: every announcement with its targets named, newest first. */
export async function listAnnouncementsForAdmin(
  take: number,
  db: PrismaClient = getPrisma(),
) {
  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      author: { select: { name: true, email: true } },
      program: { select: { name: true } },
      _count: { select: { dismissals: true } },
    },
  });
  const cohortIds = [...new Set(announcements.flatMap((a) => a.cohortIds))];
  const cohorts = cohortIds.length
    ? await db.internshipCohort.findMany({
        where: { id: { in: cohortIds } },
        select: { id: true, name: true },
      })
    : [];
  const cohortName = new Map(cohorts.map((c) => [c.id, c.name]));
  return announcements.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    scope: a.scope,
    audience: a.audience,
    programId: a.programId,
    programName: a.program?.name ?? null,
    cohorts: a.cohortIds.map((id) => ({
      id,
      name: cohortName.get(id) ?? "(deleted cohort)",
    })),
    showAsPopup: a.showAsPopup,
    popupSeenCount: a._count.dismissals,
    author: a.author.name ?? a.author.email,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
}
