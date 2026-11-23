import type { Metadata } from "next";
import { BadgeCheck, Search, ShieldAlert, ShieldX } from "lucide-react";
import {
  normalizeCertificateCode,
  verifyCertificate,
  type VerificationResult,
} from "@/lib/certificate-verification";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description:
    "Check whether a SabiRole certificate is genuine and still valid.",
};

function firstParam(value: string | string[] | undefined) {
  return normalizeCertificateCode(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
  );
}

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base font-normal text-[#1C1D52] outline-none focus:border-[#5FBB46]";

export default async function VerifyCertificatePage({
  searchParams,
}: {
  searchParams: Promise<{
    number?: string | string[];
    id?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const number = firstParam(params.number);
  const verificationId = firstParam(params.id);
  const submitted = Boolean(number || verificationId);
  const result = submitted
    ? await verifyCertificate(number, verificationId)
    : null;

  return (
    <main className="bg-[#F0F7FF] px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
          Certificate verification
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold text-[#1C1D52] sm:text-4xl">
          Verify a SabiRole certificate
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-slate-600">
          Enter both the certificate number and the verification ID. You&apos;ll
          find them together at the bottom right of the certificate.
        </p>

        <form
          action="/verify"
          method="get"
          className="mt-8 grid gap-4 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:grid-cols-2 sm:p-5"
        >
          <label className="text-sm font-semibold text-[#1C1D52]">
            Certificate number
            <input
              name="number"
              defaultValue={number}
              required
              maxLength={64}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. 2026-00042"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-[#1C1D52]">
            Verification ID
            <input
              name="id"
              defaultValue={verificationId}
              required
              maxLength={64}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. VR-1A2B3C4D"
              className={inputClass}
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#4aaa3e] sm:col-span-2"
          >
            <Search className="h-4 w-4" />
            Verify certificate
          </button>
        </form>

        {result && <ResultCard result={result} />}
      </div>
    </main>
  );
}

function ResultCard({ result }: { result: VerificationResult }) {
  if (result.status !== "found") {
    return (
      <section
        role="status"
        className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"
      >
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
        <h2 className="mt-3 text-lg font-bold text-amber-900">
          No certificate found
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          No SabiRole certificate matches that certificate number and
          verification ID together. Check both against the certificate and try
          again; they aren&apos;t case-sensitive.
        </p>
      </section>
    );
  }

  const { certificate } = result;
  const revoked = Boolean(certificate.revokedAt);
  const rows: [string, string][] = [
    ["Awarded to", certificate.holderName],
    [
      certificate.kind === "internship" ? "Internship track" : "Course",
      certificate.achievement,
    ],
    ...(certificate.periodLabel
      ? ([["Internship period", certificate.periodLabel]] as [string, string][])
      : []),
    ["Date of issue", certificate.issuedAt],
    ["Certificate number", certificate.certificateNumber],
    ["Verification ID", certificate.verificationId],
  ];

  return (
    <section
      role="status"
      className={`mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)] ${revoked ? "border-red-200" : "border-emerald-200"}`}
    >
      <div
        className={`flex items-center gap-4 p-5 sm:p-6 ${revoked ? "bg-red-50" : "bg-emerald-50"}`}
      >
        {revoked ? (
          <ShieldX className="h-11 w-11 shrink-0 text-red-600" />
        ) : (
          <BadgeCheck className="h-11 w-11 shrink-0 text-emerald-600" />
        )}
        <div>
          <h2
            className={`text-xl font-bold ${revoked ? "text-red-800" : "text-emerald-800"}`}
          >
            {revoked ? "Certificate revoked" : "Valid certificate"}
          </h2>
          <p
            className={`mt-1 text-sm ${revoked ? "text-red-700" : "text-emerald-700"}`}
          >
            {revoked
              ? `This certificate was issued by SabiRole but revoked on ${certificate.revokedAt}. It is no longer valid.`
              : `This ${certificate.kind === "internship" ? "internship " : ""}certificate was issued by SabiRole and is valid.`}
          </p>
        </div>
      </div>
      <dl className="divide-y divide-slate-100 px-5 sm:px-6">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between sm:gap-6"
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </dt>
            <dd className="text-sm font-semibold text-[#1C1D52] sm:text-right">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
