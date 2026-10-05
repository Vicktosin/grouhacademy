import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import {
  internshipCertificateSelect,
  serializeInternshipCertificate,
} from "@/lib/internship-certificates";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const certificates = await getPrisma().internshipCertificate.findMany({
    orderBy: { issuedAt: "desc" },
    select: internshipCertificateSelect,
  });
  return NextResponse.json({
    certificates: certificates.map(serializeInternshipCertificate),
  });
}
