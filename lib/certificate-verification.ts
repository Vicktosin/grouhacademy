import { getPrisma } from "@/lib/prisma";
import { internshipAchievement } from "@/lib/internship-certificates";

// Public certificate lookup. Returns only what an employer needs to confirm a
// certificate (holder, achievement, dates, status), never contact details or
// revocation reasons.

export type VerifiedCertificate = {
  kind: "course" | "internship";
  holderName: string;
  achievement: string;
  periodLabel: string | null;
  certificateNumber: string;
  verificationId: string;
  issuedAt: string;
  revokedAt: string | null;
};

export type VerificationResult =
  | { status: "found"; certificate: VerifiedCertificate }
  | { status: "not_found" };

const VERIFICATION_ID = /^VR-?([A-Z0-9]{8})$/;
const MAX_CODE_LENGTH = 64;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

function holderName(user: {
  name: string | null;
  profile: { firstName: string | null; lastName: string | null } | null;
}) {
  return (
    [user.profile?.firstName, user.profile?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    user.name ||
    "Certificate holder"
  );
}

const userSelect = {
  select: {
    name: true,
    profile: { select: { firstName: true, lastName: true } },
  },
} as const;

/** Verification IDs are "VR-" plus the last 8 characters of the record id. */
export function verificationIdFor(id: string) {
  return `VR-${id.slice(-8).toUpperCase()}`;
}

export function normalizeCertificateCode(raw: string) {
  return raw.trim().replace(/\s+/g, "").toUpperCase().slice(0, MAX_CODE_LENGTH);
}

/**
 * Looks a certificate up by its number AND verification ID. Both must belong
 * to the same certificate; any mismatch is reported as not found, so the page
 * never reveals which certificate numbers exist (student numbers are
 * sequential and would otherwise expose every holder's name).
 */
export async function verifyCertificate(
  rawNumber: string,
  rawVerificationId: string,
): Promise<VerificationResult> {
  const number = normalizeCertificateCode(rawNumber);
  const idSuffix = VERIFICATION_ID.exec(
    normalizeCertificateCode(rawVerificationId),
  )?.[1]?.toLowerCase();
  if (!number || !idSuffix) return { status: "not_found" };
  const prisma = getPrisma();

  const courseWhere = {
    certificateNumber: { equals: number, mode: "insensitive" as const },
    id: { endsWith: idSuffix },
  };

  const [courseCertificates, internshipCertificates] = await Promise.all([
    prisma.certificate.findMany({
      where: courseWhere,
      take: 2,
      select: {
        id: true,
        certificateNumber: true,
        issuedAt: true,
        revokedAt: true,
        user: userSelect,
        course: { select: { title: true } },
      },
    }),
    prisma.internshipCertificate.findMany({
      where: courseWhere,
      take: 2,
      select: {
        id: true,
        certificateNumber: true,
        issuedAt: true,
        revokedAt: true,
        user: userSelect,
        program: { select: { name: true } },
        application: {
          select: {
            cohort: { select: { startDate: true, endDate: true } },
            level: { select: { name: true, rank: true } },
          },
        },
      },
    }),
  ]);

  const matches: VerifiedCertificate[] = [
    ...courseCertificates.map((certificate) => ({
      kind: "course" as const,
      holderName: holderName(certificate.user),
      achievement: certificate.course.title,
      periodLabel: null,
      certificateNumber: certificate.certificateNumber,
      verificationId: verificationIdFor(certificate.id),
      issuedAt: formatDate(certificate.issuedAt),
      revokedAt: certificate.revokedAt
        ? formatDate(certificate.revokedAt)
        : null,
    })),
    ...internshipCertificates.map((certificate) => {
      const cohort = certificate.application?.cohort;
      return {
        kind: "internship" as const,
        holderName: holderName(certificate.user),
        achievement: internshipAchievement(
          certificate.program.name,
          certificate.application?.level,
        ),
        periodLabel: cohort
          ? `${formatDate(cohort.startDate)} – ${formatDate(cohort.endDate)}`
          : null,
        certificateNumber: certificate.certificateNumber,
        verificationId: verificationIdFor(certificate.id),
        issuedAt: formatDate(certificate.issuedAt),
        revokedAt: certificate.revokedAt
          ? formatDate(certificate.revokedAt)
          : null,
      };
    }),
  ];

  // Certificate numbers are unique within each kind; a number shared by a
  // course and an internship certificate is still told apart by the ID.
  if (matches.length !== 1) return { status: "not_found" };
  return { status: "found", certificate: matches[0] };
}
