import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import { findUnmatchedPayments, settleVerifiedReference } from "@/lib/paystack-reconcile";

// Listing pages of Paystack transactions can take a few seconds.
export const maxDuration = 60;

function secretKey() {
  return process.env.PAYSTACK_SECRET_KEY ?? null;
}

const notConfigured = () =>
  NextResponse.json(
    { error: "Paystack isn't configured on this server (PAYSTACK_SECRET_KEY)." },
    { status: 503 },
  );

/** Successful Paystack payments the site hasn't recorded. ?days=30 (1-90). */
export async function GET(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const key = secretKey();
  if (!key) return notConfigured();
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  try {
    return NextResponse.json({ days, ...(await findUnmatchedPayments({ days, secretKey: key })) });
  } catch (error) {
    console.error("Failed to check Paystack payments.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach Paystack." },
      { status: 502 },
    );
  }
}

/** Settles one payment after re-checking it with Paystack. Body: { reference }. */
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const key = secretKey();
  if (!key) return notConfigured();
  const body = (await request.json().catch(() => null)) as { reference?: unknown } | null;
  if (typeof body?.reference !== "string" || !body.reference.trim())
    return NextResponse.json({ error: "A payment reference is required." }, { status: 400 });
  const result = await settleVerifiedReference({ reference: body.reference.trim(), secretKey: key });
  if ("error" in result)
    return NextResponse.json({ error: result.error }, { status: result.status });
  console.info("[paystack-reconcile] Settled by admin.", { reference: body.reference, adminId });
  return NextResponse.json(result);
}
