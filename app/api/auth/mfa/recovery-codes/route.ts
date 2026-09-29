import { NextResponse } from "next/server";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/mfa-recovery";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/route-guards";
import { hasVerifiedFactor } from "@/lib/supabase/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// getCurrentUserId() already rejects sessions that still owe the MFA
// challenge, so a non-null result for a user with a factor means AAL2.
async function currentUserWithFactor() {
  const userId = await getCurrentUserId();
  if (!userId) return { userId: null, hasFactor: false };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { userId, hasFactor: Boolean(user && hasVerifiedFactor(user)) };
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );

  const remaining = await getPrisma().mfaRecoveryCode.count({
    where: { userId, usedAt: null },
  });

  return NextResponse.json({ remaining });
}

/** Replaces any existing codes. The plaintext is returned only here. */
export async function POST() {
  const { userId, hasFactor } = await currentUserWithFactor();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (!hasFactor)
    return NextResponse.json(
      { error: "Set up an authenticator app before creating backup codes." },
      { status: 400 },
    );

  const codes = generateRecoveryCodes();
  const prisma = getPrisma();

  await prisma.$transaction([
    prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
    prisma.mfaRecoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    }),
  ]);

  return NextResponse.json({ codes });
}

/** Called after the authenticator is removed; the codes no longer apply. */
export async function DELETE() {
  const { userId, hasFactor } = await currentUserWithFactor();
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (hasFactor)
    return NextResponse.json(
      { error: "Remove the authenticator app first." },
      { status: 409 },
    );

  await getPrisma().mfaRecoveryCode.deleteMany({ where: { userId } });

  return new NextResponse(null, { status: 204 });
}
