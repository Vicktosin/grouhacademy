"use client";

import { useEffect, useState } from "react";

// Certificate branding from platform settings (/api/certificate-branding),
// loaded once per page and shared by every certificate on it.

export type CertificateBranding = {
  academyName: string;
  issuerName: string;
  logoUrl: string | null;
};

export const DEFAULT_LOGO = "/logo.png";

/** Used until settings load, or if they can't be loaded. */
export const FALLBACK_BRANDING: CertificateBranding = {
  academyName: "Grouh Academy",
  issuerName: "Grouh Academy",
  logoUrl: null,
};

let cached: CertificateBranding | null = null;
let pending: Promise<CertificateBranding> | null = null;

export function loadCertificateBranding(): Promise<CertificateBranding> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch("/api/certificate-branding")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      cached =
        data && typeof data.academyName === "string" && typeof data.issuerName === "string"
          ? { academyName: data.academyName, issuerName: data.issuerName, logoUrl: data.logoUrl ?? null }
          : FALLBACK_BRANDING;
      return cached;
    })
    .catch(() => {
      pending = null;
      return FALLBACK_BRANDING;
    });
  return pending;
}

export function useCertificateBranding(): CertificateBranding | null {
  const [branding, setBranding] = useState<CertificateBranding | null>(cached);
  useEffect(() => {
    let active = true;
    void loadCertificateBranding().then((value) => {
      if (active) setBranding(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return branding;
}

/** Fills "{academyName}" / "{issuerName}" in certificate wording. */
export function brandText(text: string, branding: CertificateBranding) {
  return text
    .replaceAll("{academyName}", branding.academyName)
    .replaceAll("{issuerName}", branding.issuerName);
}
