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
