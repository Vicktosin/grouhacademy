import type { CertificateContent } from "./Certificate";

// The wording of each certificate type, shared by the student, intern and
// admin pages so every view and PDF of a certificate is identical.

export function formatCertificateDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Lagos",
  });
}

function revokedLabel(revokedAt: string | null | undefined) {
  return revokedAt ? `on ${formatCertificateDate(revokedAt)}` : null;
}

export function courseCertificateContent(certificate: {
  studentName: string;
  courseTitle: string;
  issuedAt: string;
  certificateNumber: string;
  verificationId: string;
  revokedAt?: string | null;
}): CertificateContent {
  const issued = formatCertificateDate(certificate.issuedAt);
  return {
    eyebrow: "Official certification",
    heading: "Certificate of Completion",
    recipientName: certificate.studentName,
    statement:
      "For successfully completing the advanced industry certification curriculum and demonstrating mastery of professional standards in",
    achievement: certificate.courseTitle,
    detail: `Completed on ${issued}`,
    issuedLabel: issued,
    certificateNumber: certificate.certificateNumber,
    verificationId: certificate.verificationId,
    revokedLabel: revokedLabel(certificate.revokedAt),
  };
}

export function internshipCertificateContent(certificate: {
  studentName: string;
  programName: string;
  periodLabel: string | null;
  issuedAt: string;
  certificateNumber: string;
  verificationId: string;
  revokedAt?: string | null;
}): CertificateContent {
  return {
    eyebrow: "Internship programme",
    heading: "Certificate of Internship",
    recipientName: certificate.studentName,
    statement:
      "has successfully completed the {academyName} virtual internship, demonstrating practical, career-ready skills through hands-on tasks and collaborative group projects in",
    achievement: certificate.programName,
    detail: certificate.periodLabel
      ? `Internship period: ${certificate.periodLabel}`
      : "",
    issuedLabel: formatCertificateDate(certificate.issuedAt),
    certificateNumber: certificate.certificateNumber,
    verificationId: certificate.verificationId,
    revokedLabel: revokedLabel(certificate.revokedAt),
  };
}
