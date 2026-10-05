import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/student/certificates/[id]">,
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const certificate = await getPrisma().certificate.findUnique({
    where: { id },
    select: {
      id: true,
      certificateNumber: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      user: {
        select: {
          name: true,
          email: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      },
      course: {
        select: {
          title: true,
          instructors: { select: { instructor: { select: { name: true } } } },
        },
      },
    },
  });
  if (!certificate)
    return NextResponse.json(
      { error: "Certificate not found." },
      { status: 404 },
    );
  const student =
    [certificate.user.profile?.firstName, certificate.user.profile?.lastName]
      .filter(Boolean)
      .join(" ") ||
    certificate.user.name ||
    "Unnamed learner";
  return NextResponse.json({
    id: certificate.id,
    certificateNumber: certificate.certificateNumber,
    issuedAt: certificate.issuedAt.toISOString(),
    revokedAt: certificate.revokedAt?.toISOString() ?? null,
    revokedReason: certificate.revokedReason,
    student,
    email: certificate.user.email,
    course: certificate.course.title,
    instructor:
      certificate.course.instructors
        .map(({ instructor }) => instructor.name)
        .filter(Boolean)
        .join(", ") || "Unassigned instructor",
    verificationId: `VR-${certificate.id.slice(-8).toUpperCase()}`,
  });
}

const MAX_REASON_LENGTH = 500;

/**
 * Revokes or reinstates a certificate. A revoked certificate stays on the
 * student's account marked "Revoked" and is never re-issued automatically.
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/student/certificates/[id]">,
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

  const result = await getPrisma().certificate.updateMany({
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
 * Permanently deletes a certificate. Nothing is kept, so if the student
 * completes the course again a new certificate is issued; revoke instead to
 * keep it from coming back.
 */
export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/admin/student/certificates/[id]">,
) {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const { id } = await params;
  const result = await getPrisma().certificate.deleteMany({ where: { id } });
  if (!result.count)
    return NextResponse.json(
      { error: "Certificate not found." },
      { status: 404 },
    );
  return new NextResponse(null, { status: 204 });
}
