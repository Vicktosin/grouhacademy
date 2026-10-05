import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

const MAX_REASON_LENGTH = 500;

/**
 * Revokes or reinstates an internship certificate. A revoked certificate
 * stays on the intern's account marked "Revoked" and is never re-issued.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/internship/certificates/[id]">,
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.revoked !== "boolean")
    return NextResponse.json(
      { error: "Say whether the certificate should be revoked." },
      { status: 400 },
    );
  const reason =
    typeof body.reason === "string" ? body.reason.trim() || null : null;
  if (reason && reason.length > MAX_REASON_LENGTH)
    return NextResponse.json(
      { error: `Keep the reason under ${MAX_REASON_LENGTH} characters.` },
      { status: 400 },
    );

  const result = await getPrisma().internshipCertificate.updateMany({
    where: { id },
    data: body.revoked
      ? { revokedAt: new Date(), revokedReason: reason }
      : { revokedAt: null, revokedReason: null },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Certificate not found." },
      { status: 404 },
    );
  return NextResponse.json({ success: true });
}

/**
 * Permanently deletes an internship certificate. Nothing is kept, so if the
 * intern still qualifies, a new certificate is issued the next time they open
 * their certificate page; revoke instead to keep it from coming back.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/admin/internship/certificates/[id]">,
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const result = await getPrisma().internshipCertificate.deleteMany({
    where: { id },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Certificate not found." },
      { status: 404 },
    );
  return new NextResponse(null, { status: 204 });
}
