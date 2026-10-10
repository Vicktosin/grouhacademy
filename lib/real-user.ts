/**
 * Prisma `where` for a user who is a real person, not an admin's hidden
 * preview intern ("Experience as intern", lib/preview-intern). Every list,
 * count, report, email and notification about interns uses it.
 */
export const REAL_USER = { isPreview: false } as const;
