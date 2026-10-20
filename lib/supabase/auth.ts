import { RoleName } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getUserRBAC } from "@/lib/rbac";
import type { LearnerTrack } from "@/lib/learner-tracks";

export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const rolePriority: RoleName[] = [
  RoleName.ADMIN,
  RoleName.SUPPORT_ADMIN,
  RoleName.INSTRUCTOR,
  RoleName.MENTOR,
  RoleName.INTERN,
  RoleName.STUDENT,
];

export function getAuthorizedHomeRouteForRoles(roles: RoleName[]): string {
  for (const role of rolePriority) {
    if (roles.includes(role)) {
      switch (role) {
        case RoleName.ADMIN:
          return "/admin/student";
        case RoleName.SUPPORT_ADMIN:
          return "/support";
        case RoleName.INSTRUCTOR:
          return "/instructor";
        case RoleName.MENTOR:
          return "/mentor";
        case RoleName.INTERN:
          return "/internship/dashboard";
        case RoleName.STUDENT:
        default:
          return "/student";
      }
    }
  }

  return "/student";
}

export function getInitialStudentRoute(
  hasInternshipApplication: boolean,
): string {
  return hasInternshipApplication
    ? "/internship/dashboard"
    : "/internship/onboarding";
}

/**
 * Where a signed-in user belongs. Staff go to their workspace. Learners go
 * to the side they signed in through (`track`); without one, interns go to
 * the internship and course-only students to their courses.
 */
export async function getAuthorizedHomeRouteForUserId(
  userId: string,
  track?: LearnerTrack | null,
): Promise<string> {
  const { roles } = await getUserRBAC(userId);
  const baseRoute = getAuthorizedHomeRouteForRoles(roles);
  if (baseRoute !== "/student" && baseRoute !== "/internship/dashboard")
    return baseRoute;

  const toCourses =
    track === "courses" ||
    (!track &&
      roles.includes(RoleName.STUDENT) &&
      !roles.includes(RoleName.INTERN));
  if (toCourses) return "/student";

  const existingApplication = await getPrisma().internshipApplication.findFirst(
    {
      where: { studentId: userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    },
  );
  return getInitialStudentRoute(Boolean(existingApplication));
}

/**
 * Finds or creates the app user for a Supabase login. New users (and users
 * without any role) get `defaultRole`: interns by default, since the
 * existing sign-up pages are the internship's; the courses pages pass
 * STUDENT.
 */
export async function ensurePrismaUserForSupabaseAuth(
  authUser: SupabaseAuthUser,
  defaultRole: RoleName = RoleName.INTERN,
): Promise<string> {
  return (await ensurePrismaUserWithRoles(authUser, defaultRole)).id;
}

/** The same, with the user's role names (read in the same query). */
export async function ensurePrismaUserWithRoles(
  authUser: SupabaseAuthUser,
  defaultRole: RoleName = RoleName.INTERN,
): Promise<{ id: string; roles: RoleName[] }> {
  if (!authUser.id) {
    throw new Error("Supabase auth user is missing an id.");
  }

  const prisma = getPrisma();

  const existingUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { roles: { include: { role: true } } },
  });

  if (existingUser) {
    if (existingUser.roles.length === 0) {
      const defaultRoleRecord = await prisma.role.findUnique({
        where: { name: defaultRole },
      });

      if (!defaultRoleRecord) return { id: existingUser.id, roles: [] };

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: existingUser.id,
            roleId: defaultRoleRecord.id,
          },
        },
        update: {},
        create: {
          userId: existingUser.id,
          roleId: defaultRoleRecord.id,
        },
      });
      return { id: existingUser.id, roles: [defaultRole] };
    }

    return { id: existingUser.id, roles: existingUser.roles.map((userRole) => userRole.role.name) };
  }

  const defaultRoleRecord = await prisma.role.findUnique({
    where: { name: defaultRole },
  });

  if (!defaultRoleRecord) {
    throw new Error(
      `The ${defaultRole} role was not found in the Prisma RBAC data.`,
    );
  }

  const createdUser = await prisma.user.create({
    data: {
      id: authUser.id,
      email: authUser.email ?? `${authUser.id}@supabase.local`,
      name:
        typeof authUser.user_metadata?.full_name === "string"
          ? authUser.user_metadata.full_name
          : typeof authUser.user_metadata?.name === "string"
            ? authUser.user_metadata.name
            : (authUser.email?.split("@")[0] ?? "Supabase User"),
      status: "ACTIVE",
    },
  });

  await prisma.userRole.create({
    data: {
      userId: createdUser.id,
      roleId: defaultRoleRecord.id,
    },
  });

  return { id: createdUser.id, roles: [defaultRole] };
}
