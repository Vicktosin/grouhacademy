import { NextResponse } from "next/server";
import { hashRecoveryCode } from "@/lib/mfa-recovery";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMfaVerificationPending } from "@/lib/supabase/mfa";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Redeems a backup code for a user who has signed in with their password but
 * can no longer produce an authenticator code. A valid code removes all of
 * the user's MFA factors so they can sign in and enrol a new device.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim())
    return NextResponse.json(
      { error: "Enter one of your backup codes." },
      { status: 400 },
    );

  // The password step must already be complete: only a signed-in session
  // that is waiting on its second factor may redeem a code.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Sign in with your password first." },
      { status: 401 },
    );
  if (!(await isMfaVerificationPending(supabase, user)))
    return NextResponse.json(
      { error: "This account does not need a backup code right now." },
      { status: 409 },
    );

  const prisma = getPrisma();
  const codeHash = hashRecoveryCode(code);

  // Consume atomically so the same code cannot be redeemed twice.
  const consumed = await prisma.mfaRecoveryCode.updateMany({
    where: { userId: user.id, codeHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1)
    return NextResponse.json(
      { error: "That backup code is not valid or has already been used." },
      { status: 400 },
    );

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.mfa.listFactors({
      userId: user.id,
    });
    if (error) throw error;

    for (const factor of data.factors) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
        userId: user.id,
        id: factor.id,
      });
      if (deleteError) throw deleteError;
    }
  } catch (error) {
    console.error("Failed to remove MFA factors during recovery:", error);
    // Give the code back so the user is not left worse off by our failure.
    await prisma.mfaRecoveryCode.updateMany({
      where: { userId: user.id, codeHash },
      data: { usedAt: null },
    });
    return NextResponse.json(
      { error: "Unable to recover your account right now. Please try again." },
      { status: 500 },
    );
  }

  // The remaining codes belonged to the removed authenticator.
  await prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ redirectTo: "/auth/mfa/setup" });
}
