import { getPrisma } from "@/lib/prisma";

/**
 * Whether the user has a verified MFA factor, read from Supabase Auth's own
 * table (auth.mfa_factors) in the database: authoritative, unlike the
 * session cookie's copy of the user, and without a request to Supabase
 * Auth (each of which is logged). Kept apart from lib/supabase/mfa, which
 * the proxy imports and must stay free of the database client.
 */
export async function hasVerifiedFactorInDatabase(userId: string): Promise<boolean> {
  const rows = await getPrisma().$queryRaw<{ has: boolean }[]>`
    select exists(
      select 1 from auth.mfa_factors
      where user_id = ${userId}::uuid and status = 'verified'
    ) as has`;
  return rows[0]?.has === true;
}
