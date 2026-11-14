import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

// What certificates show about who issued them, from platform settings
// (admin Certificate rules, or MCP update_platform_settings).

export type CertificateBranding = {
  /** e.g. "SabiRole": the logo's alt text and the internship statement. */
  academyName: string;
  /** e.g. "SabiRole": the seal and "issued by" wording. */
  issuerName: string;
  /** Logo at the top of the certificate; null shows the SabiRole wordmark. */
  logoUrl: string | null;
};

export async function getCertificateBranding(
  db: PrismaClient = getPrisma(),
): Promise<CertificateBranding> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { academyName: true, certificateIssuerName: true, certificateLogoUrl: true },
  });
  return {
    academyName: settings?.academyName ?? "SabiRole",
    issuerName: settings?.certificateIssuerName ?? settings?.academyName ?? "SabiRole",
    logoUrl: settings?.certificateLogoUrl ?? null,
  };
}

/** A new internship certificate number, e.g. "SR-INT-3F9A1C02B7DE". */
export function internshipCertificateNumber(prefix: string | null | undefined) {
  const clean = (prefix ?? "").trim().toUpperCase() || "CERT-INT";
  return `${clean}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

/** The configured internship certificate number prefix. */
export async function internshipCertificatePrefix(db: PrismaClient = getPrisma()) {
  const settings = await db.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { certificateNumberPrefix: true },
  });
  return settings?.certificateNumberPrefix ?? "CERT-INT";
}
