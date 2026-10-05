"use client";

import { Download, LoaderCircle, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import InternshipShell from "@/components/InternshipShell";
import { ScaledCertificate } from "@/components/certificate/Certificate";
import {
  formatCertificateDate,
  internshipCertificateContent,
} from "@/components/certificate/content";
import {
  certificateFileName,
  downloadCertificatePdf,
} from "@/components/certificate/download-certificate";

type CertificateData = {
  eligible: boolean;
  reason?: string;
  progressPercent?: number;
  passMark?: number;
  completedTasks?: number;
  totalTasks?: number;
  studentName?: string;
  programName?: string;
  periodLabel?: string | null;
  certificateNumber?: string;
  verificationId?: string;
  issuedAt?: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
};

export default function InternshipCertificatePage() {
  const [data, setData] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  async function download() {
    if (!faceRef.current || !data || data.revokedAt) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadCertificatePdf(
        faceRef.current,
        certificateFileName(
          data.studentName ?? "Intern",
          `${data.programName ?? "Internship"} Internship`,
        ),
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

  useEffect(() => {
    fetch("/api/internship/certificate")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load certificate.");
        return response.json() as Promise<CertificateData>;
      })
      .then(setData)
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load certificate.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <InternshipShell>
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          Loading certificate...
        </p>
      </InternshipShell>
    );
  }

  if (error) {
    return (
      <InternshipShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm text-red-700">
          {error}
        </div>
      </InternshipShell>
    );
  }

  if (!data?.eligible) {
    return (
      <InternshipShell>
        <div className="rounded-2xl bg-white p-10 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <Lock className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-4 text-lg font-bold text-[#1C1D52]">
            Certificate not yet available
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {data?.reason ??
              "Complete your internship to unlock this certificate."}
          </p>
          {typeof data?.progressPercent === "number" && (
            <div className="mx-auto mt-6 max-w-xs">
              <div className="relative h-2 rounded-full bg-[#E7EEF8]">
                <div
                  className="h-full rounded-full bg-[#5FBB46]"
                  style={{ width: `${data.progressPercent}%` }}
                />
                {typeof data.passMark === "number" && (
                  <span
                    className="absolute -top-1 h-4 w-0.5 bg-[#1C1D52]"
                    style={{ left: `${data.passMark}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#5FBB46]">
                {data.completedTasks ?? 0} of {data.totalTasks ?? 0} tasks
                passed ({data.progressPercent}%)
              </p>
              {typeof data.passMark === "number" && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Pass mark: {data.passMark}%
                </p>
              )}
            </div>
          )}
        </div>
      </InternshipShell>
    );
  }

  return (
    <InternshipShell>
      <div className="space-y-5">
        <section className="flex flex-col gap-4 rounded-2xl bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_28px_rgba(95,187,70,0.18)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Your internship certificate
            </h1>
            <p className="mt-2 text-xs text-[#14204f]/75">
              {data.revokedAt
                ? "This certificate has been revoked."
                : "Congratulations! Download it as a PDF to share or print."}
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={downloading || Boolean(data.revokedAt)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1C1D52] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#14154a] disabled:opacity-60 sm:w-auto"
          >
            {downloading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </section>
        {data.revokedAt && (
          <div
            role="status"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
          >
            <p className="font-bold">
              This certificate was revoked by Grouh Academy on{" "}
              {formatCertificateDate(data.revokedAt)}.
            </p>
            {data.revokedReason && (
              <p className="mt-1">Reason: {data.revokedReason}</p>
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
            className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700"
          >
            {downloadError}
          </p>
        )}
        <ScaledCertificate
          faceRef={faceRef}
          content={internshipCertificateContent({
            studentName: data.studentName ?? "Intern",
            programName: data.programName ?? "",
            periodLabel: data.periodLabel ?? null,
            issuedAt: data.issuedAt ?? new Date().toISOString(),
            certificateNumber: data.certificateNumber ?? "",
            verificationId: data.verificationId ?? "",
            revokedAt: data.revokedAt,
          })}
        />
      </div>
    </InternshipShell>
  );
}
