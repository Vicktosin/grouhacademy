import { LearnerAudience } from "@/generated/prisma/client";
import { parseTrack, type LearnerTrack } from "@/lib/learner-tracks";

// Notifications and announcements belong to one learner side (or both when
// audience is null). Each workspace shows its own side plus site-wide ones.

export const TRACK_AUDIENCE: Record<LearnerTrack, LearnerAudience> = {
  courses: LearnerAudience.COURSES,
  internship: LearnerAudience.INTERNSHIP,
};

/** Prisma filter for a workspace (`?workspace=courses|internship`); no workspace means everything. */
export function audienceWhere(workspace: LearnerTrack | null) {
  if (!workspace) return {};
  return {
    OR: [{ audience: TRACK_AUDIENCE[workspace] }, { audience: null }],
  };
}

/** Reads `?workspace=` from a request URL. */
export function workspaceFromRequest(request: Request) {
  return parseTrack(new URL(request.url).searchParams.get("workspace"));
}
