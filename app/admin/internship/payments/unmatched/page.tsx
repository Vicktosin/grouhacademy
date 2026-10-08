"use client";

import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, SearchCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import type { UnmatchedPayment, UnmatchedStatus } from "@/lib/paystack-reconcile";

// Successful Paystack acceptance-fee payments the site hasn't recorded as
// paid, with a one-tap settle (re-checked with Paystack on the server).

const STATUS: Record<UnmatchedStatus, { label: string; help: string; tone: string }> = {
  SETTLEABLE: {
    label: "Not recorded",
    help: "Paid on Paystack, still pending here. The amount matches, so it can be settled.",
    tone: "bg-amber-50 text-amber-800",
  },
  AMOUNT_DIFFERS: {
    label: "Amount differs",
    help: "The amount isn't what this applicant owes now (they may have changed track or level). Check it, then use Mark as paid on their payment if it's right.",
    tone: "bg-red-50 text-red-700",
  },
  PAID_TWICE: {
    label: "Paid twice?",
    help: "This applicant is already marked paid with another payment. This may be a second payment to refund.",
    tone: "bg-sky-50 text-sky-800",
  },
  NO_APPLICATION: {
    label: "No application found",
    help: "The site has no application for this payment. Find the applicant by the email shown.",
    tone: "bg-slate-100 text-slate-700",
  },
};

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-NG")}`;

export default function UnmatchedPaymentsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ checked: number; unmatched: UnmatchedPayment[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function check() {
    setLoading(true);
    setError(null);
    setSettled(new Set());
    setRowError({});
    const response = await fetch(`/api/admin/internship/payments/unmatched?days=${days}`, {
      cache: "no-store",
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setLoading(false);
    if (!response?.ok) {
      setError(body?.error ?? "Unable to check Paystack.");
      return;
    }
    setResult(body);
  }

  async function settle(reference: string) {
    setSettling(reference);
    setConfirming(null);
    const response = await fetch("/api/admin/internship/payments/unmatched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSettling(null);
    if (!response?.ok) {
      setRowError((current) => ({ ...current, [reference]: body?.error ?? "Unable to settle." }));
      return;
    }
    setSettled((current) => new Set(current).add(reference));
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <Link href="/admin/internship/payments" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]">
          <ArrowLeft className="h-4 w-4" /> Back to payments
        </Link>
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Paystack check</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Unmatched payments</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Acceptance fees Paystack received that the site hasn&apos;t marked as paid. Settling re-checks the payment with Paystack, marks the applicant paid and places them in their cohort, just as if the payment had gone through normally.
          </p>
        </header>

        <section className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <label className="text-[10px] font-semibold text-slate-500">
            Look back
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
            >
              {[7, 30, 60, 90].map((value) => (
                <option key={value} value={value}>
                  Last {value} days
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void check()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCw className="h-4 w-4" /> : <SearchCheck className="h-4 w-4" />}
            {loading ? "Checking Paystack…" : result ? "Check again" : "Check Paystack"}
          </button>
          {result && (
            <p className="text-[11px] text-slate-500">
              Checked {result.checked.toLocaleString("en-NG")} successful Paystack payments.
            </p>
          )}
        </section>

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700" role="alert">{error}</p>}

        {result && result.unmatched.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
            <CheckCircle2 className="h-4 w-4" /> Every acceptance fee Paystack received in this period is recorded on the site.
          </p>
        )}

        {result && result.unmatched.length > 0 && (
          <ul className="space-y-3">
            {result.unmatched.map((payment) => {
              const info = STATUS[payment.status];
              const done = settled.has(payment.reference);
              return (
                <li key={payment.reference} className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1C1D52]">
                        {payment.applicant?.name ?? payment.paystackEmail ?? "Unknown payer"}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {payment.applicant?.email ?? payment.paystackEmail}
                        {payment.paystackEmail && payment.applicant && payment.paystackEmail !== payment.applicant.email
                          ? ` · paid as ${payment.paystackEmail}`
                          : ""}
                      </p>
                      {payment.track && <p className="text-[11px] text-slate-500">{payment.track}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${done ? "bg-[#e8f7eb] text-[#397d3a]" : info.tone}`}>
                      {done ? "Settled" : info.label}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-400">Paid</dt>
                      <dd className="font-semibold text-[#1C1D52]">{naira(payment.amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Owes</dt>
                      <dd className="font-semibold text-[#1C1D52]">{payment.owed === null ? "—" : naira(payment.owed)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Paid on</dt>
                      <dd className="text-[#1C1D52]">
                        {payment.paidAt
                          ? new Date(payment.paidAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })
                          : "—"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-slate-400">Reference</dt>
                      <dd className="truncate font-mono text-[10px] text-[#1C1D52]">{payment.reference}</dd>
                    </div>
                  </dl>
                  {!done && <p className="mt-2 text-[11px] leading-5 text-slate-500">{info.help}</p>}
                  {rowError[payment.reference] && (
                    <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{rowError[payment.reference]}</p>
                  )}
                  {!done && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {payment.status === "SETTLEABLE" &&
                        (confirming === payment.reference ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void settle(payment.reference)}
                              className="rounded-lg bg-[#5FBB46] px-4 py-2 text-xs font-bold text-[#14204f]"
                            >
                              Yes, mark {payment.applicant?.name.split(" ")[0] ?? "them"} as paid
                            </button>
                            <button type="button" onClick={() => setConfirming(null)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(payment.reference)}
                            disabled={settling === payment.reference}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                          >
                            {settling === payment.reference && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Settle payment
                          </button>
                        ))}
                      {payment.paymentId && (
                        <Link
                          href={`/admin/internship/payments/${payment.paymentId}`}
                          className="rounded-lg px-4 py-2 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100"
                        >
                          Open their payment
                        </Link>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
