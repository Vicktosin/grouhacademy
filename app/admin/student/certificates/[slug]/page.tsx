"use client";

import { ArrowLeft, Award, Download, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { ScaledCertificate } from "@/components/certificate/Certificate";
import { courseCertificateContent } from "@/components/certificate/content";
import {
  certificateFileName,
  downloadCertificatePdf,
} from "@/components/certificate/download-certificate";

type Certificate = {
  id: string;
  certificateNumber: string;
  issuedAt: string;
  student: string;
  email: string;
  course: string;
  instructor: string;
  verificationId: string;
  revokedAt: string | null;
  revokedReason: string | null;
};
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

export default function CertificateDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/admin/student/certificates/${slug}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            (await response.json().catch(() => null))?.error ??
              "Unable to load certificate.",
          );
        return response.json();
      })
      .then(setCertificate)
      .catch((reason) => setError(reason.message));
  }, [slug]);
  const faceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const content = certificate
    ? courseCertificateContent({
        studentName: certificate.student,
        courseTitle: certificate.course,
        issuedAt: certificate.issuedAt,
        certificateNumber: certificate.certificateNumber,
        verificationId: certificate.verificationId,
        revokedAt: certificate.revokedAt,
      })
    : null;
  async function download() {
    if (!certificate || !faceRef.current) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(
        faceRef.current,
        certificateFileName(certificate.student, certificate.course),
      );
    } catch (failure) {
      console.error("Certificate download failed:", failure);
      setError("The PDF couldn't be created. Please try again.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <AdminShell workspace="student">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <Link
          href="/admin/student/certificates"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to certificates
        </Link>
        {error && (
          <p className="rounded-xl bg-red-50 p-4 text-xs text-red-700">
            {error}
          </p>
        )}
        {!certificate && !error && (
          <p className="py-12 text-center text-xs text-slate-500">
            Loading certificate…
          </p>
        )}
        {certificate && (
          <section className="rounded-2xl bg-white p-6 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ecf9e7] text-[#5FBB46]">
                  <Award className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                    Certificate
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">
                    {certificate.certificateNumber}
                  </h1>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void download()}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2 text-[10px] font-semibold text-[#1C1D52] disabled:opacity-60"
              >
                {downloading ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                {content && (
                  <ScaledCertificate content={content} faceRef={faceRef} />
                )}
              </div>
              <aside className="rounded-2xl bg-[#f8fbff] p-4">
                <h3 className="text-sm font-bold text-[#1C1D52]">
                  Certificate details
                </h3>
                <dl className="mt-4 space-y-3 text-[10px] text-slate-500">
                  <Detail label="Learner" value={certificate.student} />
                  <Detail label="Email" value={certificate.email} />
                  <Detail label="Course" value={certificate.course} />
                  <Detail label="Instructor" value={certificate.instructor} />
                  <Detail
                    label="Issue date"
                    value={dateFormat.format(new Date(certificate.issuedAt))}
                  />
                  <Detail
                    label="Certificate number"
                    value={certificate.certificateNumber}
                  />
                  <Detail
                    label="Status"
                    value={
                      certificate.revokedAt
                        ? `Revoked ${dateFormat.format(new Date(certificate.revokedAt))}`
                        : "Valid"
                    }
                  />
                  {certificate.revokedReason && (
                    <Detail
                      label="Revoke reason"
                      value={certificate.revokedReason}
                    />
                  )}
                </dl>
              </aside>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-white p-3">
      <dt>{label}</dt>
      <dd className="text-right font-semibold text-[#1C1D52]">{value}</dd>
    </div>
  );
}
