"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AffiliateShell from "@/components/affiliate/AffiliateShell";
import type { AffiliateDashboard } from "@/lib/affiliates";
import { formatNaira, useAffiliate } from "@/lib/use-affiliate";

// Affiliate settings: where cash-outs are paid, and whether to cash out
// automatically at the end of each month.

export default function AffiliateSettingsPage() {
  const router = useRouter();
  const { data, error, reload } = useAffiliate();

  // Nothing to set up before joining.
  const notJoined = data !== null && data.state !== "joined";
  useEffect(() => {
    if (notJoined) router.replace("/affiliate");
  }, [notJoined, router]);

  return (
    <AffiliateShell>
      {error ? (
        <p role="alert" className="rounded-2xl bg-white p-5 text-sm text-red-700">{error}</p>
      ) : data?.state !== "joined" ? (
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading…</p>
      ) : (
        <SettingsForms dashboard={data.dashboard} onSaved={reload} />
      )}
    </AffiliateShell>
  );
}

function SettingsForms({
  dashboard,
  onSaved,
}: {
  dashboard: AffiliateDashboard;
  onSaved: () => Promise<void>;
}) {
  const [bank, setBank] = useState({
    bankName: dashboard.bankDetails?.bankName ?? "",
    accountNumber: dashboard.bankDetails?.accountNumber ?? "",
    accountName: dashboard.bankDetails?.accountName ?? "",
  });
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/affiliate/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setNotice({ text: result?.error ?? "Unable to save.", error: true });
      return;
    }
    setNotice({ text: done, error: false });
    await onSaved();
  }

  const pending = dashboard.payouts.some((payout) => payout.status === "PENDING");
  const input =
    "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal outline-none focus:border-[#5FBB46] focus:ring-4 focus:ring-[#5FBB46]/15";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Where your cash-outs are paid and when.</p>
      </header>

      {notice && (
        <p role={notice.error ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${notice.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}>
          {notice.text}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(bank, "Bank details saved.");
        }}
        className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6"
      >
        <div>
          <h2 className="text-sm font-bold">Bank details</h2>
          <p className="mt-1 text-xs text-slate-500">
            Use an account in your own name. Double-check the number: cash-outs are sent to exactly these details.
          </p>
        </div>
        <label className="block text-xs font-semibold">
          Bank
          <input required maxLength={80} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} placeholder="e.g. GTBank" className={input} />
        </label>
        <label className="block text-xs font-semibold">
          Account number
          <input
            required
            inputMode="numeric"
            pattern="\d{10}"
            maxLength={10}
            value={bank.accountNumber}
            onChange={(e) => setBank({ ...bank, accountNumber: e.target.value.replace(/\D/g, "") })}
            placeholder="10 digits"
            className={input}
          />
        </label>
        <label className="block text-xs font-semibold">
          Account name
          <input required maxLength={120} value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} placeholder="As shown by your bank" className={input} />
        </label>
        {pending && (
          <p className="text-xs text-amber-800">
            Your cash-out that&apos;s waiting will still be paid to the details it was requested with.
          </p>
        )}
        <button disabled={busy} className="w-full rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save bank details"}
        </button>
      </form>

      <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">Cash out at the end of each month</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              On the 1st of each month we&apos;ll request your whole balance for you, but only if it
              has reached {formatNaira(dashboard.payoutMinimum)}. If it hasn&apos;t, it stays and keeps
              growing. You can always cash out yourself once you reach the minimum.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dashboard.autoMonthlyPayout}
            aria-label="Cash out at the end of each month"
            disabled={busy}
            onClick={() =>
              void save(
                { autoMonthlyPayout: !dashboard.autoMonthlyPayout },
                dashboard.autoMonthlyPayout ? "Month-end cash-out turned off." : "Month-end cash-out turned on.",
              )
            }
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${dashboard.autoMonthlyPayout ? "bg-[#5FBB46]" : "bg-slate-300"} disabled:opacity-60`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${dashboard.autoMonthlyPayout ? "left-6" : "left-1"}`} />
          </button>
        </div>
        {dashboard.autoMonthlyPayout && !dashboard.bankDetails && (
          <p className="mt-3 text-xs text-amber-800">Add your bank details above, or month-end cash-outs can&apos;t be made.</p>
        )}
      </section>
    </div>
  );
}
