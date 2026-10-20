import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-guards";
import {
  inviteSupportAdmin,
  listSupportAdmins,
  resendSupportAdminInvite,
  revokeSupportAdmin,
} from "@/lib/support-admin-invite";

// Support Admin accounts: only admins can see, invite or revoke them.

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  try {
    return NextResponse.json({ users: await listSupportAdmins() });
  } catch (error) {
    console.error("Failed to list Support Admins:", error);
    return NextResponse.json(
      { error: "Unable to load Support Admins." },
      { status: 500 },
    );
  }
}

/** Body: { name, email, password }. Emails the invitation to `email`. */
export async function POST(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 10 || !name)
    return NextResponse.json(
      { error: "Enter a name, a valid email and a password of at least 10 characters." },
      { status: 400 },
    );

  try {
    const result = await inviteSupportAdmin({ email, name, password });
    return NextResponse.json(
      { user: { id: result.userId, email, name }, emailed: result.sent, devLink: result.devLink },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Unable to invite this Support Admin.") },
      { status: 400 },
    );
  }
}

/** Body: { id, action: "resend" }: a new invitation email. */
export async function PATCH(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
  } | null;
  if (typeof body?.id !== "string" || body.action !== "resend")
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  try {
    const result = await resendSupportAdminInvite(body.id);
    return NextResponse.json({ emailed: result.sent, devLink: result.devLink });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Unable to resend the invitation.") },
      { status: 400 },
    );
  }
}

/** Body: { id }. Ends their access; their work stays attributed. */
export async function DELETE(request: Request) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string")
    return NextResponse.json({ error: "Choose a Support Admin." }, { status: 400 });
  try {
    await revokeSupportAdmin(body.id);
    return NextResponse.json({ revoked: body.id });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Unable to revoke access.") },
      { status: 400 },
    );
  }
}
