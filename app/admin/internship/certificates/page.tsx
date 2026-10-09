"use client";

import {
  Ban,
  Download,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import CohortTrackFilter, { matchesCohortTrack, useCohortTrackFilter } from "@/components/admin/CohortTrackFilter";
import type { PickerCohort } from "@/components/admin/CohortPicker";
import { internshipCertificateContent } from "@/components/certificate/content";
import { certificateFileName } from "@/components/certificate/download-certificate";
import { useCertificatePdf } from "@/components/certificate/useCertificatePdf";
import type { InternshipCertificateView } from "@/lib/internship-certificates";

type Certificate = InternshipCertificateView & { trackName: string; cohortId: string | null };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function AdminInternshipCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cohorts, setCohorts] = useState<PickerCohort[]>([]);
  const [cohortTrack, setCohortTrack] = useCohortTrackFilter("admin-certificates");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pdf = useCertificatePdf();

  useEffect(() => {
    fetch("/api/admin/internship/certificates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(data?.error ?? "Unable to load certificates.");
        setCertificates(data.certificates);
        setCohorts(data.cohorts ?? []);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load certificates.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return certificates.filter(
      (certificate) =>
        matchesCohortTrack(cohortTrack, certificate) &&
        (!term ||
        `${certificate.certificateNumber} ${certificate.studentName} ${certificate.email} ${certificate.programName} ${certificate.cohortName ?? ""}`
          .toLowerCase()
          .includes(term)),
    );
  }, [certificates, cohortTrack, query]);

  function show(next: { error?: string; message?: string }) {
    setError(next.error ?? null);
    setMessage(next.message ?? null);
  }

  async function download(certificate: Certificate) {
    try {
      await pdf.download(
        internshipCertificateContent(certificate),
        certificateFileName(
          certificate.studentName,
          `${certificate.programName} Internship`,
        ),
      );
    } catch (failure) {
      console.error("Certificate download failed:", failure);
      show({ error: "The PDF couldn't be created. Please try again." });
    }
  }

  async function setRevoked(certificate: Certificate, revoked: boolean) {
    let reason: string | null = null;
    if (revoked) {
      // null means the admin cancelled; an empty string means no reason.
      reason = window.prompt(
        `Revoke ${certificate.certificateNumber} for ${certificate.studentName}?\n\nThe intern will see it marked "Revoked" and won't be able to download it. You can reinstate it later.\n\nReason shown to the intern (optional):`,
        "",
      );
      if (reason === null) return;
    } else if (
      !window.confirm(
        `Reinstate ${certificate.certificateNumber}? It becomes valid again for ${certificate.studentName}.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/internship/certificates/${certificate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked, reason }),
      },
    );
    if (!response.ok) {
      show({
        error:
          (await response.json().catch(() => null))?.error ??
          "Unable to update certificate.",
      });
      return;
    }
    setCertificates((current) =>
      current.map((item) =>
        item.id === certificate.id
          ? {
              ...item,
              revokedAt: revoked ? new Date().toISOString() : null,
              revokedReason: revoked ? reason?.trim() || null : null,
            }
          : item,
      ),
    );
    show({
      message: revoked ? "Certificate revoked." : "Certificate reinstated.",
    });
  }

  async function remove(certificate: Certificate) {
    if (
      !window.confirm(
        `Permanently delete ${certificate.certificateNumber} for ${certificate.studentName}?\n\nIt disappears from the intern's account and cannot be recovered. If they still qualify, a new certificate is issued the next time they open their certificate page; revoke it instead to keep it from coming back.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/internship/certificates/${certificate.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      show({
        error:
          (await response.json().catch(() => null))?.error ??
          "Unable to delete certificate.",
      });
      return;
    }
    setCertificates((current) =>
      current.filter((item) => item.id !== certificate.id),
    );
    show({ message: "Certificate deleted." });
  }

  return (
    <AdminShell workspace="internship">
      {pdf.element}
      <div className="mx-auto max-w-[1300px] space-y-5">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
            Internship administration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
            Internship Certificates
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Certificates are issued automatically when a cohort ends to interns
            who reach its pass mark. Download, revoke, or delete them here.
          </p>
        </header>

        {message && (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex w-full max-w-sm items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400">
              <Search className="h-3.5 w-3.5" />
              <span className="sr-only">Search certificates</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-[#1C1D52] outline-none"
                placeholder="Search certificate, intern, track or cohort"
              />
            </label>
            <CohortTrackFilter
              cohorts={cohorts}
              tracks={certificates.map((certificate) => certificate.trackName)}
              value={cohortTrack}
              onChange={setCohortTrack}
              storageKey="admin-certificates"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Loading certificates…
            </p>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              {certificates.length === 0
                ? "No internship certificates have been issued yet."
                : "No certificates match your search."}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {visible.map((certificate) => (
                <article
                  key={certificate.id}
                  className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-[#1C1D52]">
                        {certificate.studentName}
                      </h2>
                      {certificate.revokedAt ? (
                        <span
                          className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700"
                          title={certificate.revokedReason ?? undefined}
                        >
                          Revoked{" "}
                          {dateFormat.format(new Date(certificate.revokedAt))}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                          Valid
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {certificate.email}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {certificate.programName}
                      {certificate.cohortName &&
                        ` · ${certificate.cohortName}`}{" "}
                      · {certificate.certificateNumber} · Issued{" "}
                      {dateFormat.format(new Date(certificate.issuedAt))}
                    </p>
                    {certificate.revokedReason && (
                      <p className="mt-1 text-[11px] text-red-700">
                        Reason: {certificate.revokedReason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void download(certificate)}
                      disabled={pdf.downloading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-50"
                    >
                      {pdf.downloading ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Download PDF
                    </button>
                    {certificate.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => void setRevoked(certificate, false)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-[10px] font-semibold text-emerald-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reinstate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setRevoked(certificate, true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-[10px] font-semibold text-amber-700"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Revoke
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(certificate)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete permanently
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
