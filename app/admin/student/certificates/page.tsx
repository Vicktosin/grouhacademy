"use client";

import {
  Award,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Ban,
  MoreHorizontal,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { courseCertificateContent } from "@/components/certificate/content";
import { certificateFileName } from "@/components/certificate/download-certificate";
import { useCertificatePdf } from "@/components/certificate/useCertificatePdf";

type Certificate = {
  id: string;
  certificateNumber: string;
  student: string;
  course: string;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  verificationId: string;
};
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 8;
  const pdf = useCertificatePdf();
  async function downloadCertificate(certificate: Certificate) {
    try {
      await pdf.download(
        courseCertificateContent({
          studentName: certificate.student,
          courseTitle: certificate.course,
          issuedAt: certificate.issuedAt,
          certificateNumber: certificate.certificateNumber,
          verificationId: certificate.verificationId,
          revokedAt: certificate.revokedAt,
        }),
        certificateFileName(certificate.student, certificate.course),
      );
    } catch (failure) {
      console.error("Certificate download failed:", failure);
      setError("The PDF couldn't be created. Please try again.");
    }
  }
  useEffect(() => {
    fetch("/api/admin/student/certificates", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            (await response.json().catch(() => null))?.error ??
              "Unable to load certificates.",
          );
        return response.json();
      })
      .then((data) => setCertificates(data.certificates))
      .catch((reason) => setError(reason.message));
  }, []);
  const visible = useMemo(
    () =>
      certificates.filter((certificate) =>
        `${certificate.certificateNumber} ${certificate.student} ${certificate.course}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [certificates, query],
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const rows = visible.slice((page - 1) * pageSize, page * pageSize);
  async function setRevoked(certificate: Certificate, revoked: boolean) {
    setMenuId(null);
    let reason: string | null = null;
    if (revoked) {
      // null means the admin cancelled; an empty string means no reason.
      reason = window.prompt(
        `Revoke ${certificate.certificateNumber} for ${certificate.student}?\n\nThe student will see it marked "Revoked" and won't be able to download it. You can reinstate it later.\n\nReason shown to the student (optional):`,
        "",
      );
      if (reason === null) return;
    } else if (
      !window.confirm(
        `Reinstate ${certificate.certificateNumber}? It becomes valid again for ${certificate.student}.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/student/certificates/${certificate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revoked, reason }),
      },
    );
    if (!response.ok) {
      setError(
        (await response.json().catch(() => null))?.error ??
          "Unable to update certificate.",
      );
      return;
    }
    setError(null);
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
  }
  async function deleteCertificate(certificate: Certificate) {
    setMenuId(null);
    if (
      !window.confirm(
        `Permanently delete ${certificate.certificateNumber} for ${certificate.student}?\n\nIt disappears from the student's account and cannot be recovered. If they complete the course again, a new certificate will be issued; revoke it instead to keep it from coming back.`,
      )
    )
      return;
    const response = await fetch(
      `/api/admin/student/certificates/${certificate.id}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setError(
        (await response.json().catch(() => null))?.error ??
          "Unable to delete certificate.",
      );
      return;
    }
    setError(null);
    setCertificates((current) =>
      current.filter((item) => item.id !== certificate.id),
    );
  }
  return (
    <AdminShell workspace="student">
      {pdf.element}
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Certificates Registry
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Issue and manage certificates created from completed course
              enrollments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/student/certificates/templates"
              className="rounded-lg bg-white px-4 py-2.5 text-[10px] font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#d8dee8]"
            >
              Certificate Templates
            </Link>
            <Link
              href="/admin/student/certificates/new"
              className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-[10px] font-semibold text-[#14204f]"
            >
              <Award className="h-3.5 w-3.5" />
              Issue Certificate
            </Link>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            icon={<Award className="h-4 w-4" />}
            value={certificates.length}
            label="Total issued"
          />
          <Stat
            icon={<CalendarDays className="h-4 w-4" />}
            value={
              certificates.filter(
                ({ issuedAt }) =>
                  new Date(issuedAt).getMonth() === new Date().getMonth() &&
                  new Date(issuedAt).getFullYear() === new Date().getFullYear(),
              ).length
            }
            label="Issued this month"
          />
          <Stat
            icon={<Award className="h-4 w-4" />}
            value={new Set(certificates.map(({ course }) => course)).size}
            label="Courses certified"
          />
        </div>
        {error && (
          <p
            className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <label className="flex max-w-sm items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400">
            <Search className="h-3.5 w-3.5" />
            <span className="sr-only">Search certificates</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent outline-none"
              placeholder="Search certificate, learner, or course"
            />
          </label>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#f5f8fb] text-slate-600">
                <tr>
                  <th className="p-3">Certificate</th>
                  <th className="p-3">Learner</th>
                  <th className="p-3">Course</th>
                  <th className="p-3">Issued</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((certificate) => (
                  <tr
                    key={certificate.id}
                    className="border-b border-slate-100 text-[#1C1D52]"
                  >
                    <td className="p-3 font-semibold">
                      {certificate.certificateNumber}
                    </td>
                    <td className="p-3">{certificate.student}</td>
                    <td className="p-3">{certificate.course}</td>
                    <td className="p-3 text-slate-500">
                      {dateFormat.format(new Date(certificate.issuedAt))}
                    </td>
                    <td className="p-3">
                      {certificate.revokedAt ? (
                        <span
                          className="rounded-full bg-red-100 px-2 py-1 text-[9px] font-bold text-red-700"
                          title={certificate.revokedReason ?? undefined}
                        >
                          Revoked{" "}
                          {dateFormat.format(new Date(certificate.revokedAt))}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">
                          Valid
                        </span>
                      )}
                    </td>
                    <td className="relative p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void downloadCertificate(certificate)}
                          disabled={pdf.downloading}
                          className="rounded bg-[#f3f6fb] px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
                        >
                          <Download className="mr-1 inline h-3 w-3" />
                          Download
                        </button>
                        <Link
                          href={`/admin/student/certificates/${certificate.id}`}
                          className="rounded p-1.5 hover:bg-slate-100"
                          aria-label={`View ${certificate.certificateNumber}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setMenuId(
                              menuId === certificate.id ? null : certificate.id,
                            )
                          }
                          className="rounded p-1.5 hover:bg-slate-100"
                          aria-label={`Actions for ${certificate.certificateNumber}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {menuId === certificate.id && (
                          <div className="absolute right-3 top-10 z-10 w-44 rounded-lg bg-white p-1 shadow-lg ring-1 ring-slate-100">
                            {certificate.revokedAt ? (
                              <button
                                type="button"
                                onClick={() => setRevoked(certificate, false)}
                                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[10px] text-emerald-700 hover:bg-emerald-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reinstate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setRevoked(certificate, true)}
                                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[10px] text-amber-700 hover:bg-amber-50"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteCertificate(certificate)}
                              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[10px] text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete permanently
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!error && !rows.length && (
              <p className="py-10 text-center text-xs text-slate-500">
                No certificates found.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 text-[11px] text-slate-500">
            <span>
              {visible.length
                ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, visible.length)} of ${visible.length}`
                : "No matching certificates"}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded p-2 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => Math.min(pageCount, current + 1))
                }
                disabled={page === pageCount}
                className="rounded p-2 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#dceeff] text-blue-500">
        {icon}
      </span>
      <strong className="mt-4 block text-xl text-[#1C1D52]">{value}</strong>
      <span className="mt-1 block text-[10px] text-slate-500">{label}</span>
    </div>
  );
}
