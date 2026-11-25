import { NextResponse } from "next/server";
import { AccountDeletionError, deleteLearnerAccount, deletionSummary } from "@/lib/account-deletion";
import { requireAdminApi } from "@/lib/api-guards";

type Context = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function failure(error: unknown) {
  if (error instanceof AccountDeletionError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Account deletion failed.", error);
  return NextResponse.json({ error: "Something went wrong and nothing was deleted. Please try again." }, { status: 500 });
}

/** What deleting this account would remove. */
export async function GET(_request: Request, { params }: Context) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  try {
    return NextResponse.json({ summary: await deletionSummary(id) });
  } catch (error) {
    return failure(error);
  }
}

/** Permanently deletes it: { confirmEmail }. Full administrators only. */
export async function DELETE(request: Request, { params }: Context) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { confirmEmail?: unknown } | null;
  if (typeof body?.confirmEmail !== "string")
    return NextResponse.json({ error: "Confirm the account's email." }, { status: 400 });
  try {
    await deleteLearnerAccount(id, { confirmEmail: body.confirmEmail, adminId });
    return NextResponse.json({ message: "Account permanently deleted." });
  } catch (error) {
    return failure(error);
  }
}
