"use client";

import { Award, Download, Eye, LoaderCircle, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { ScaledCertificate } from "@/components/certificate/Certificate";
import {
  courseCertificateContent,
  formatCertificateDate,
} from "@/components/certificate/content";
import {
  certificateFileName,
  downloadCertificatePdf,
} from "@/components/certificate/download-certificate";
import {
  FALLBACK_BRANDING,
  useCertificateBranding,
} from "@/components/certificate/branding";

type Certificate = {
  id: string;
  certificateNumber: string;
  verificationId: string;
  courseTitle: string;
  courseSlug: string;
  studentName: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

const formatDate = formatCertificateDate;
const certificateContent = courseCertificateContent;

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [online, setOnline] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const issuerName = (useCertificateBranding() ?? FALLBACK_BRANDING).issuerName;

  useEffect(() => {
    fetch("/api/student/certificates")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load your certificates.");
        return response.json() as Promise<Certificate[]>;
      })
      .then((data) => {
        setCertificates(data);
        setSelected(data[0] ?? null);
      })
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your certificates.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function downloadCertificate(certificate: Certificate) {
    if (certificate.revokedAt) return;
    setDownloading(true);
    setDownloadError(null);
    setSelected(certificate);
    try {
      // Let the selected certificate render before capturing it.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      if (!faceRef.current) throw new Error("Certificate is not ready.");
      await downloadCertificatePdf(
        faceRef.current,
        certificateFileName(certificate.studentName, certificate.courseTitle),
      );
    } catch (downloadFailure) {
      console.error("Certificate download failed:", downloadFailure);
      setDownloadError(
        "The PDF couldn't be created. Please try again, or try another browser.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_28px_rgba(95,187,70,0.18)] sm:px-8 sm:py-7">
        <h1 className="text-3xl font-bold tracking-tight">
          Certificate System
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-5 text-[#14204f]/75">
          Your official credentials are ready to view online and download as PDF
          certificates.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && loading && (
        <div className="h-[400px] animate-pulse rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]" />
      )}

      {!error && !loading && certificates.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Award className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-[#1C1D52]">
            No certificates yet
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Complete a course to earn your first certificate - it&apos;ll show
            up here automatically.
          </p>
        </div>
      )}

      {!error && !loading && selected && (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#1C1D52]">
                Currently Selected Certificate
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOnline(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#1C1D52] px-3 py-2 text-[10px] font-bold text-[#1C1D52]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Online
                </button>
                <button
                  type="button"
                  onClick={() => downloadCertificate(selected)}
                  disabled={downloading || Boolean(selected.revokedAt)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
                >
                  {downloading ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {downloading ? "Preparing PDF…" : "Download PDF"}
                </button>
              </div>
            </div>
            {selected.revokedAt && (
              <div
                role="status"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
              >
                <p className="font-bold">
                  This certificate was revoked by {issuerName} on{" "}
                  {formatDate(selected.revokedAt)}.
                </p>
                {selected.revokedReason && (
                  <p className="mt-1">Reason: {selected.revokedReason}</p>
                )}
                <p className="mt-1">
                  It is no longer valid and can&apos;t be downloaded. Contact
                  support if you think this is a mistake.
                </p>
              </div>
            )}
            {downloadError && (
              <p
                role="alert"
                className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {downloadError}
              </p>
            )}
            <ScaledCertificate
              content={certificateContent(selected)}
              faceRef={faceRef}
            />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
            <h2 className="text-sm font-bold text-[#1C1D52]">
              Your Earned Credentials
            </h2>
            <div className="mt-4 space-y-2">
              {certificates.map((certificate) => (
                <div
                  key={certificate.id}
                  className="flex flex-col gap-3 rounded-xl bg-[#fbfcff] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="text-xs font-bold text-[#1C1D52]">
                      {certificate.courseTitle}
                      {certificate.revokedAt && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700">
                          Revoked
                        </span>
                      )}
                    </h3>
                    <p className="mt-1 text-[9px] text-slate-500">
                      Completed on {formatDate(certificate.issuedAt)} · ID:{" "}
                      {certificate.certificateNumber}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(certificate);
                        setOnline(true);
                      }}
                      className="rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#1C1D52]"
                    >
                      View Online
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadCertificate(certificate)}
                      disabled={downloading || Boolean(certificate.revokedAt)}
                      className="rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-60"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {online && selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#1C1D52]/70 p-4 sm:p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOnline(false)}
                className="rounded-full bg-white p-2 text-[#1C1D52]"
                aria-label="Close certificate preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScaledCertificate content={certificateContent(selected)} />
          </div>
        </div>
      )}
    </div>
  );
}
