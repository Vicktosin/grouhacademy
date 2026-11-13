// Who sees an announcement. Pure functions, shared by every announcement
// feed, the pop-up check, the admin page and the MCP server, so targeting
// behaves the same everywhere (tests/announcement-targeting.test.ts).
//
// An announcement reaches a learner when all of these hold:
//  - its audience matches the workspace (or it has none: both sides);
//  - GLOBAL ones reach everyone; MENTOR_MENTEES ones only reach interns whose
//    active mentor posted them;
//  - with a programId, only interns on that track;
//  - with cohortIds, only interns in one of those cohorts.

export type AnnouncementWorkspace = "courses" | "internship";

export type TargetedAnnouncement = {
  id: string;
  scope: "GLOBAL" | "MENTOR_MENTEES";
  authorId: string;
  programId: string | null;
  cohortIds: string[];
  audience: "COURSES" | "INTERNSHIP" | null;
  showAsPopup: boolean;
};

export type AnnouncementViewer = {
  /** Tracks of the viewer's internship applications (not removed). */
  programIds: string[];
  /** Cohorts of the viewer's internship applications (not removed). */
  cohortIds: string[];
  /** Mentors currently assigned to the viewer. */
  activeMentorIds: string[];
};

const WORKSPACE_AUDIENCE: Record<AnnouncementWorkspace, "COURSES" | "INTERNSHIP"> = {
  courses: "COURSES",
  internship: "INTERNSHIP",
};

export function isAnnouncementForViewer(
  announcement: TargetedAnnouncement,
  viewer: AnnouncementViewer,
  workspace: AnnouncementWorkspace | null,
): boolean {
  if (
    workspace &&
    announcement.audience !== null &&
    announcement.audience !== WORKSPACE_AUDIENCE[workspace]
  )
    return false;
  if (
    announcement.scope === "MENTOR_MENTEES" &&
    !viewer.activeMentorIds.includes(announcement.authorId)
  )
    return false;
  if (announcement.programId && !viewer.programIds.includes(announcement.programId))
    return false;
  if (
    announcement.cohortIds.length > 0 &&
    !announcement.cohortIds.some((id) => viewer.cohortIds.includes(id))
  )
    return false;
  return true;
}

/**
 * Pop-ups the viewer still has to see: targeted at them, marked as a pop-up,
 * and not yet dismissed ("Got it"). Oldest first, so they read in order.
 */
export function pendingPopups<T extends TargetedAnnouncement & { createdAt: Date }>(
  announcements: T[],
  viewer: AnnouncementViewer,
  dismissedIds: Iterable<string>,
): T[] {
  const dismissed = new Set(dismissedIds);
  return announcements
    .filter(
      (a) =>
        a.showAsPopup &&
        !dismissed.has(a.id) &&
        isAnnouncementForViewer(a, viewer, "internship"),
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export const ANNOUNCEMENT_TITLE_MAX = 160;
export const ANNOUNCEMENT_MESSAGE_MAX = 2000;
export const ANNOUNCEMENT_MAX_COHORTS = 50;

export type AnnouncementInput = {
  title: string;
  message: string;
  audience: "COURSES" | "INTERNSHIP" | null;
  programId: string | null;
  cohortIds: string[];
  showAsPopup: boolean;
};

/**
 * Checks the shape of an announcement (create: every field; update: only the
 * fields given). Cohort/track existence is checked against the database by
 * lib/announcements.
 */
export function parseAnnouncementInput(
  body: Record<string, unknown>,
  { partial }: { partial: boolean },
): { ok: true; value: Partial<AnnouncementInput> } | { ok: false; error: string } {
  const value: Partial<AnnouncementInput> = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > ANNOUNCEMENT_TITLE_MAX)
      return { ok: false, error: `Give the announcement a title (up to ${ANNOUNCEMENT_TITLE_MAX} characters).` };
    value.title = title;
  }
  if (!partial || body.message !== undefined) {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > ANNOUNCEMENT_MESSAGE_MAX)
      return { ok: false, error: `Write a message (up to ${ANNOUNCEMENT_MESSAGE_MAX} characters).` };
    value.message = message;
  }
  if (!partial || body.audience !== undefined) {
    const audience = body.audience ?? null;
    if (audience !== null && audience !== "COURSES" && audience !== "INTERNSHIP")
      return { ok: false, error: "Audience must be INTERNSHIP, COURSES or empty (both)." };
    value.audience = audience;
  }
  if (!partial || body.programId !== undefined) {
    const programId = body.programId ?? null;
    if (programId !== null && (typeof programId !== "string" || !programId.trim()))
      return { ok: false, error: "programId must be a track id or empty." };
    value.programId = programId === null ? null : programId.trim();
  }
  if (!partial || body.cohortIds !== undefined) {
    const raw = body.cohortIds ?? [];
    if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || !id.trim()))
      return { ok: false, error: "cohortIds must be a list of cohort ids." };
    const cohortIds = [...new Set(raw.map((id: string) => id.trim()))];
    if (cohortIds.length > ANNOUNCEMENT_MAX_COHORTS)
      return { ok: false, error: `Pick at most ${ANNOUNCEMENT_MAX_COHORTS} cohorts.` };
    value.cohortIds = cohortIds;
  }
  if (!partial || body.showAsPopup !== undefined) {
    const showAsPopup = body.showAsPopup ?? false;
    if (typeof showAsPopup !== "boolean")
      return { ok: false, error: "showAsPopup must be true or false." };
    value.showAsPopup = showAsPopup;
  }

  // Cohorts and pop-ups are internship features.
  const targetsCohorts = (value.cohortIds?.length ?? 0) > 0;
  if ((targetsCohorts || value.showAsPopup) && value.audience === "COURSES")
    return { ok: false, error: "Cohort-targeted and pop-up announcements are for interns: set audience to INTERNSHIP." };

  return { ok: true, value };
}
