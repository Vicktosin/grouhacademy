function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

/**
 * What a certificate says the intern achieved: the track, plus the level for
 * anything above the first level (so Entry certificates read as before).
 */
export function internshipAchievement(
  programName: string,
  level: { name: string; rank: number } | null | undefined,
) {
  return level && level.rank > 1
    ? `${programName} (${level.name} Level)`
    : programName;
}

/** Prisma select for everything an internship certificate shows. */
export const internshipCertificateSelect = {
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
  program: { select: { name: true } },
  application: {
    select: {
      cohort: { select: { name: true, startDate: true, endDate: true } },
      level: { select: { name: true, rank: true } },
    },
  },
} as const;

type InternshipCertificateRecord = {
  id: string;
  certificateNumber: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  user: {
    name: string | null;
    email: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
  program: { name: string };
  application: {
    cohort: { name: string; startDate: Date; endDate: Date } | null;
    level: { name: string; rank: number };
  } | null;
};

/** The certificate as the intern, admin and PDF see it. */
export function serializeInternshipCertificate(
  certificate: InternshipCertificateRecord,
) {
  const fullName = [
    certificate.user.profile?.firstName,
    certificate.user.profile?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const cohort = certificate.application?.cohort ?? null;
  return {
    id: certificate.id,
    studentName: fullName || certificate.user.name || "Intern",
    email: certificate.user.email,
    programName: internshipAchievement(
      certificate.program.name,
      certificate.application?.level,
    ),
    cohortName: cohort?.name ?? null,
    periodLabel: cohort
      ? `${formatDate(cohort.startDate)} – ${formatDate(cohort.endDate)}`
      : null,
    certificateNumber: certificate.certificateNumber,
    verificationId: `VR-${certificate.id.slice(-8).toUpperCase()}`,
    issuedAt: certificate.issuedAt.toISOString(),
    revokedAt: certificate.revokedAt?.toISOString() ?? null,
    revokedReason: certificate.revokedReason,
  };
}

export type InternshipCertificateView = ReturnType<
  typeof serializeInternshipCertificate
>;
