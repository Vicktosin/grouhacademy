"use client";

import { useRef, useState } from "react";
import { CertificateFace, type CertificateContent } from "./Certificate";
import { downloadCertificatePdf } from "./download-certificate";

/**
 * Downloads any certificate as the same PDF students get, without it being
 * on screen: the certificate is rendered out of view, captured, then
 * removed. Render `element` somewhere in the page.
 */
export function useCertificatePdf() {
  const [content, setContent] = useState<CertificateContent | null>(null);
  const [downloading, setDownloading] = useState(false);
  const faceRef = useRef<HTMLDivElement>(null);

  async function download(next: CertificateContent, fileName: string) {
    setDownloading(true);
    setContent(next);
    try {
      // Wait for the out-of-view certificate to render before capturing.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      if (!faceRef.current) throw new Error("Certificate is not ready.");
      await downloadCertificatePdf(faceRef.current, fileName);
    } finally {
      setContent(null);
      setDownloading(false);
    }
  }

  const element = content ? (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -20000,
        top: 0,
        pointerEvents: "none",
      }}
    >
      <CertificateFace content={content} ref={faceRef} />
    </div>
  ) : null;

  return { download, downloading, element };
}
