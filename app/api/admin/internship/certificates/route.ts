import { NextResponse } from "next/server";
import { listCohortOptions } from "@/lib/admin-cohort-options";
import { getPrisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/api-guards";
import {
  internshipCertificateSelect,
  serializeInternshipCertificate,
} from "@/lib/internship-certificates";
import { REAL_USER } from "@/lib/real-user";

export async function GET() {
  const adminId = await requireAdminApi();
  if (adminId instanceof NextResponse) return adminId;
  const certificates = await getPrisma().internshipCertificate.findMany({
    where: { user: REAL_USER },
    orderBy: { issuedAt: "desc" },
    select: internshipCertificateSelect,
  });
  return NextResponse.json({
    certificates: certificates.map((certificate) => ({
      ...serializeInternshipCertificate(certificate),
      // For the track and cohort filter.
      trackName: certificate.program.name,
      cohortId: certificate.application?.cohort?.id ?? null,
    })),
    cohorts: await listCohortOptions(),
  });
}
