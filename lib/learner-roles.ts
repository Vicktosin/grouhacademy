import { RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { LearnerTrack } from "@/lib/learner-tracks";

/** The role that gives access to each learner side. */
export const TRACK_ROLE: Record<LearnerTrack, RoleName> = {
  internship: RoleName.INTERN,
  courses: RoleName.STUDENT,
};

/**
 * Adds a user to a learner side (no-op if they are already on it). Called
 * when someone signs in or registers through that side's pages.
 */
export async function grantTrackRole(userId: string, track: LearnerTrack) {
  const prisma = getPrisma();
  const role = await prisma.role.findUnique({
    where: { name: TRACK_ROLE[track] },
    select: { id: true },
  });
  if (!role)
    throw new Error(`The ${TRACK_ROLE[track]} role is missing from RBAC data.`);
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}
