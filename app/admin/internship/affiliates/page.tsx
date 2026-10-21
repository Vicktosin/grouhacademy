"use client";

import { Check, Copy, Save, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

// The Affiliate Program for admins: the commission and minimum cash-out,
// cash-out requests to pay (with the bank details they were requested
// with), and every affiliate's numbers and bank details.

type Payout = {
  id: string;
  name: string;
  email: string;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED";
  automatic: boolean;
  bankName: string;
  accountNumber: string;
  accountName: string;
  requestedAt: string;
  processedAt: string | null;
  adminNote: string | null;
};
type Affiliate = {
  id: string;
  name: string;
  email: string;
  code: string;
  joinedAt: string;
  clicks: number;
  signUps: number;
  paid: number;
  autoMonthlyPayout: boolean;
  bankDetails: { bankName: string; accountNumber: string | null; accountName: string | null } | null;
  totalEarned: number;
  pending: number;
  paidOut: number;
  available: number;
};
type Overview = {
  settings: { commissionPercent: number; payoutMinimum: number };
  affiliates: Affiliate[];
  payouts: Payout[];
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const card = "rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]";

export default function AdminAffiliatesPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [tab, setTab] = useState<"payouts" | "affiliates">("payouts");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ commissionPercent: "", payoutMinimum: "" });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/internship/affiliates", { cache: "no-store" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setNotice({ text: body?.error ?? "Unable to load affiliates.", error: true });
      return;
    }
    setData(body);
    setForm({
      commissionPercent: String(body.settings.commissionPercent),
      payoutMinimum: String(body.settings.payoutMinimum),
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once; state is set after the request
    void load();
  }, [load]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setBusy("settings");
    setNotice(null);
    const response = await fetch("/api/admin/internship/affiliates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionPercent: Number(form.commissionPercent),
        payoutMinimum: Number(form.payoutMinimum),
      }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(null);
    setNotice(
      response?.ok
        ? { text: "Saved. The new commission applies to payments from now on.", error: false }
        : { text: body?.error ?? "Unable to save.", error: true },
    );
    if (response?.ok) await load();
  }

  async function decide(payout: Payout, status: "PAID" | "REJECTED") {
    let adminNote = "";
    if (status === "PAID") {
      if (!window.confirm(`Mark ${money(payout.amount)} to ${payout.accountName} (${payout.bankName} ${payout.accountNumber}) as paid? Only do this after sending the transfer.`))
        return;
    } else {
      const reason = window.prompt(`Decline ${payout.name}'s cash-out of ${money(payout.amount)}? The amount goes back to their balance. Reason (shown to them):`);
      if (reason === null) return;
      adminNote = reason;
    }
    setBusy(payout.id);
    setNotice(null);
    const response = await fetch("/api/admin/internship/affiliates/payouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: payout.id, status, adminNote }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      setNotice({ text: body?.error ?? "Unable to update the cash-out.", error: true });
      return;
    }
    setNotice({ text: status === "PAID" ? `Marked as paid. ${payout.name} has been notified.` : `Declined. ${payout.name} has been notified.`, error: false });
    await load();
  }

  const pending = data?.payouts.filter((payout) => payout.status === "PENDING") ?? [];
  const totals = data?.affiliates.reduce(
    (sum, row) => ({
      signUps: sum.signUps + row.signUps,
      paid: sum.paid + row.paid,
      earned: sum.earned + row.totalEarned,
      paidOut: sum.paidOut + row.paidOut,
    }),
    { signUps: 0, paid: 0, earned: 0, paidOut: 0 },
  );

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Affiliates</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            Interns who joined the Affiliate Program invite people with their own link and earn a
            commission on each internship payment those people make. This is separate from
            Referrals (achievement cards interns share).
          </p>
        </header>

        {notice && (
          <p role={notice.error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-xs font-semibold ${notice.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}>
            {notice.text}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          <form onSubmit={saveSettings} className={`${card} space-y-4`}>
            <h2 className="text-sm font-bold text-[#1C1D52]">Program settings</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#1C1D52]">
                Commission (%)
                <input type="number" min={0} max={100} step={1} required value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
              <label className="text-xs font-semibold text-[#1C1D52]">
                Minimum cash-out (₦)
                <input type="number" min={1} step={1} required value={form.payoutMinimum} onChange={(e) => setForm({ ...form, payoutMinimum: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
              </label>
            </div>
            <p className="text-[11px] leading-5 text-slate-500">
              Affiliates cash out their whole balance once it reaches the minimum: whenever they
              ask, or automatically on the 1st of the month if they chose that. Below the minimum,
              nothing can be cashed out, even at month end.
            </p>
            <button disabled={busy === "settings"} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60">
              <Save className="h-4 w-4" /> Save settings
            </button>
          </form>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Affiliates" value={String(data?.affiliates.length ?? "–")} />
            <Metric label="People signed up" value={String(totals?.signUps ?? "–")} />
            <Metric label="Paid for an internship" value={String(totals?.paid ?? "–")} />
            <Metric label="Commission earned" value={totals ? money(totals.earned) : "–"} />
            <Metric label="Paid out" value={totals ? money(totals.paidOut) : "–"} />
            <Metric label="Waiting to be paid" value={money(pending.reduce((sum, payout) => sum + payout.amount, 0))} highlight={pending.length > 0} />
          </section>
        </div>

        <div className="flex gap-2">
          {(["payouts", "affiliates"] as const).map((key) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-lg px-4 py-2.5 text-xs font-semibold ${tab === key ? "bg-[#1C1D52] text-white" : "bg-white text-slate-600 shadow-[0_4px_12px_rgba(28,29,82,0.06)]"}`}>
              {key === "payouts" ? `Cash-outs${pending.length ? ` (${pending.length} to pay)` : ""}` : "All affiliates"}
            </button>
          ))}
        </div>

        {!data ? (
          <p className={`${card} text-sm text-slate-500`}>Loading…</p>
        ) : tab === "payouts" ? (
          <section className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Affiliate</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Pay to</th>
                  <th className="px-3 py-3">Requested</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {data.payouts.map((payout) => (
                  <tr key={payout.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{payout.name}</p>
                      <p className="text-[10px] text-slate-400">{payout.email}</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold">{money(payout.amount)}</td>
                    <td className="px-3 py-3">
                      <BankDetails bankName={payout.bankName} accountNumber={payout.accountNumber} accountName={payout.accountName} />
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {date(payout.requestedAt)}
                      <span className="block text-[10px]">{payout.automatic ? "Month-end (automatic)" : "By the intern"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${{ PENDING: "bg-amber-100 text-amber-800", PAID: "bg-[#e8f7eb] text-[#397d3a]", REJECTED: "bg-red-50 text-red-700" }[payout.status]}`}>
                        {{ PENDING: "To pay", PAID: "Paid", REJECTED: "Declined" }[payout.status]}
                      </span>
                      {payout.processedAt && <span className="mt-1 block text-[10px] text-slate-400">{date(payout.processedAt)}</span>}
                      {payout.adminNote && <span className="mt-1 block max-w-[200px] text-[10px] text-slate-500">{payout.adminNote}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {payout.status === "PENDING" && (
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={busy !== null} onClick={() => void decide(payout, "PAID")} className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-bold text-[#14204f] disabled:opacity-50">
                            <Check className="h-3.5 w-3.5" /> Mark paid
                          </button>
                          <button type="button" disabled={busy !== null} onClick={() => void decide(payout, "REJECTED")} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-700 disabled:opacity-50">
                            <X className="h-3.5 w-3.5" /> Decline
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.payouts.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No cash-out requests yet.</p>}
          </section>
        ) : (
          <section className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[1080px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Affiliate</th>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Visits · Sign-ups · Paid</th>
                  <th className="px-3 py-3">Earned</th>
                  <th className="px-3 py-3">Paid out</th>
                  <th className="px-3 py-3">Balance</th>
                  <th className="px-3 py-3">Bank details</th>
                  <th className="px-3 py-3">Month-end</th>
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {data.affiliates.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{row.name}</p>
                      <p className="text-[10px] text-slate-400">{row.email} · joined {date(row.joinedAt)}</p>
                    </td>
                    <td className="px-3 py-3 font-mono">{row.code}</td>
                    <td className="px-3 py-3">{row.clicks} · {row.signUps} · <strong>{row.paid}</strong></td>
                    <td className="px-3 py-3 font-semibold">{money(row.totalEarned)}</td>
                    <td className="px-3 py-3">{money(row.paidOut)}{row.pending > 0 && <span className="block text-[10px] text-amber-700">{money(row.pending)} to pay</span>}</td>
                    <td className="px-3 py-3">
                      {money(row.available)}
                      {row.available >= data.settings.payoutMinimum && <span className="block text-[10px] text-[#397d3a]">Can cash out</span>}
                    </td>
                    <td className="px-3 py-3">
                      {row.bankDetails ? (
                        <BankDetails bankName={row.bankDetails.bankName} accountNumber={row.bankDetails.accountNumber ?? ""} accountName={row.bankDetails.accountName ?? ""} />
                      ) : (
                        <span className="text-slate-400">Not added</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{row.autoMonthlyPayout ? "On" : "Off"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.affiliates.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No interns have joined the Affiliate Program yet.</p>}
          </section>
        )}
      </div>
    </AdminShell>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] ${highlight ? "bg-amber-50" : "bg-white"}`}>
      <strong className="block text-lg text-[#1C1D52]">{value}</strong>
      <span className="text-[10px] text-slate-500">{label}</span>
    </div>
  );
}

/** Bank details with a one-click copy of the account number. */
function BankDetails({ bankName, accountNumber, accountName }: { bankName: string; accountNumber: string; accountName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="font-semibold">{accountName}</p>
      <p className="flex items-center gap-1 text-slate-600">
        {bankName} · <span className="font-mono">{accountNumber}</span>
        <button
          type="button"
          aria-label="Copy account number"
          onClick={() => {
            void navigator.clipboard.writeText(accountNumber).catch(() => undefined);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded p-0.5 text-slate-400 hover:text-[#1C1D52]"
        >
          {copied ? <Check className="h-3 w-3 text-[#397d3a]" /> : <Copy className="h-3 w-3" />}
        </button>
      </p>
    </div>
  );
}
