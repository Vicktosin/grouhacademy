"use client";

import PageGuide from "@/components/onboarding/PageGuide";
import { ArrowRight, Download, LoaderCircle, Lock } from "lucide-react";
import Link from "next/link";
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

type EarnedCertificate = {
  id: string;
  studentName: string;
  programName: string;
  periodLabel: string | null;
  certificateNumber: string;
  verificationId: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

type CertificateData = {
  eligible: boolean;
  id?: string;
  /** Every certificate earned, across levels and tracks, newest first. */
  certificates?: EarnedCertificate[];
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextLevelName, setNextLevelName] = useState<string | null>(null);

  const earned = data?.certificates ?? [];
  // The certificate on show: one picked from the list, else the current
  // level's (when issued), else the most recent one earned.
  const shown: EarnedCertificate | null =
    earned.find((item) => item.id === selectedId) ??
    earned.find((item) => item.id === data?.id) ??
    (data?.eligible ? null : (earned[0] ?? null));

  async function download() {
    if (!faceRef.current || !shown || shown.revokedAt) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadCertificatePdf(
        faceRef.current,
        certificateFileName(
          shown.studentName,
          `${shown.programName} Internship`,
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
      .then(() => fetch("/api/internship/progression", { cache: "no-store" }))
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          progression: {
            certificateId: string | null;
            nextLevel: { name: string; acceptanceFee: number | null } | null;
            queuedApplicationId: string | null;
          } | null,
        ) => {
          // Offer the next level once this level's certificate is earned.
          if (
            progression?.certificateId &&
            progression.nextLevel?.acceptanceFee != null &&
            !progression.queuedApplicationId
          )
            setNextLevelName(progression.nextLevel.name);
        },
      )
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

  if (!shown) {
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
        <PageGuide section="certificate" />
        {!data?.eligible && data?.reason && (
          <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              <strong className="text-[#1C1D52]">
                Your current level&apos;s certificate:
              </strong>{" "}
              {data.reason}
            </span>
          </p>
        )}
        <section className="flex flex-col gap-4 rounded-2xl bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_28px_rgba(95,187,70,0.18)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Your internship certificate
            </h1>
            <p className="mt-2 text-xs text-[#14204f]/75">
              {shown.revokedAt
                ? "This certificate has been revoked."
                : "Congratulations! Download it as a PDF to share or print."}
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={downloading || Boolean(shown.revokedAt)}
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
        {nextLevelName && (
          <Link
            href="/internship/dashboard/next-level"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[#5FBB46] bg-white px-5 py-4 text-sm font-semibold text-[#1C1D52] shadow-[0_8px_24px_rgba(28,29,82,0.06)] hover:bg-[#f4faf2]"
          >
            <span>
              Ready for more? Move up to {nextLevelName} level — no entrance
              exam needed.
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#5FBB46]" />
          </Link>
        )}
        {shown.revokedAt && (
          <div
            role="status"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
          >
            <p className="font-bold">
              This certificate was revoked by Grouh Academy on{" "}
              {formatCertificateDate(shown.revokedAt)}.
            </p>
            {shown.revokedReason && (
              <p className="mt-1">Reason: {shown.revokedReason}</p>
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
            studentName: shown.studentName,
            programName: shown.programName,
            periodLabel: shown.periodLabel,
            issuedAt: shown.issuedAt,
            certificateNumber: shown.certificateNumber,
            verificationId: shown.verificationId,
            revokedAt: shown.revokedAt,
          })}
        />
        {earned.length > 1 && (
          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <h2 className="text-sm font-bold text-[#1C1D52]">
              Your certificates
            </h2>
            <ul className="mt-3 space-y-2">
              {earned.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-xs ${
                      item.id === shown.id
                        ? "border-[#5FBB46] bg-[#f4faf2] font-semibold text-[#1C1D52]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>{item.programName}</span>
                    <span className="text-[10px] text-slate-400">
                      {item.revokedAt
                        ? "Revoked"
                        : formatCertificateDate(item.issuedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </InternshipShell>
  );
}
