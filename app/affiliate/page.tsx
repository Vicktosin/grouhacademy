"use client";

import {
  ArrowRight,
  Banknote,
  Check,
  Copy,
  Landmark,
  MousePointerClick,
  Share2,
  UserPlus,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AffiliateShell from "@/components/affiliate/AffiliateShell";
import type { AffiliateDashboard } from "@/lib/affiliates";
import { formatNaira, shortDate, useAffiliate } from "@/lib/use-affiliate";

// The affiliate app's home: join the program, or the dashboard (invite link,
// balance and cash-out, people invited, cash-out history).

export default function AffiliatePage() {
  const { data, error, reload } = useAffiliate();

  if (error)
    return (
      <AffiliateShell showNav={false}>
        <p role="alert" className="rounded-2xl bg-white p-5 text-sm text-red-700">
          {error}
        </p>
      </AffiliateShell>
    );
  if (!data)
    return (
      <AffiliateShell showNav={false}>
        <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading…</p>
      </AffiliateShell>
    );

  if (data.state === "not_eligible")
    return (
      <AffiliateShell showNav={false}>
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_10px_30px_rgba(28,29,82,0.08)]">
          <h1 className="text-2xl font-semibold">The Affiliate Program is for interns</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Hi {data.me.firstName}, you can join once you&apos;re admitted to a
            SabiRole internship (your acceptance fee is paid). Signed in as{" "}
            {data.me.email}.
          </p>
          <Link
            href="/internship/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1C1D52] px-5 py-3 text-sm font-semibold text-white"
          >
            Go to my internship <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </AffiliateShell>
    );

  if (data.state === "not_joined")
    return (
      <AffiliateShell showNav={false}>
        <JoinProgram firstName={data.me.firstName} terms={data.terms} onJoined={reload} />
      </AffiliateShell>
    );

  return (
    <AffiliateShell>
      <Dashboard firstName={data.me.firstName} dashboard={data.dashboard} onChange={reload} />
    </AffiliateShell>
  );
}

function JoinProgram({
  firstName,
  terms,
  onJoined,
}: {
  firstName: string;
  terms: { commissionPercent: number; payoutMinimum: number };
  onJoined: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/affiliate/join", { method: "POST" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setError(body?.error ?? "Unable to join right now. Please try again.");
      return;
    }
    await onJoined();
  }

  const steps = [
    { icon: Share2, title: "Share your link", text: "Send your personal invite link or code to friends, classmates and colleagues." },
    { icon: UserPlus, title: "They join an internship", text: `When someone who signed up through your link pays for an internship, you earn ${terms.commissionPercent}% of what they paid.` },
    { icon: Banknote, title: "Cash out", text: `Cash out your whole balance once it reaches ${formatNaira(terms.payoutMinimum)}, whenever you like or automatically at the end of each month.` },
  ];

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl bg-[#1C1D52] p-7 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5FBB46]">For SabiRole interns</p>
        <h1 className="mt-3 text-3xl font-semibold">Invite people, earn {terms.commissionPercent}% commission</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
          Hi {firstName}! As an intern you can join our Affiliate Program. You
          sign in with the same email and password as your internship.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f7eb] text-[#397d3a]">
              <Icon className="h-4 w-4" />
            </span>
            <h2 className="mt-4 text-sm font-bold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-5 text-xs leading-5 text-slate-600 shadow-[0_7px_20px_rgba(28,29,82,0.06)]">
        <p>
          <strong className="text-[#1C1D52]">Good to know:</strong> people count as yours when
          they create their account after opening your link (within 30 days). You
          can&apos;t earn from your own payments. Cash-outs are paid to the bank
          account you save in Settings, after an admin checks them.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void join()}
        className="w-full rounded-2xl bg-[#5FBB46] px-5 py-4 text-sm font-bold text-[#14204f] disabled:opacity-60"
      >
        {busy ? "Joining…" : "Join the Affiliate Program"}
      </button>
    </section>
  );
}

function Dashboard({
  firstName,
  dashboard,
  onChange,
}: {
  firstName: string;
  dashboard: AffiliateDashboard;
  onChange: () => Promise<void>;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const { balance, payoutMinimum } = dashboard;
  const pending = dashboard.payouts.find((payout) => payout.status === "PENDING");
  const reached = balance.available >= payoutMinimum;
  const progress = Math.min(100, Math.round((balance.available / payoutMinimum) * 100));
  const shareText = `Join a SabiRole internship and get real work experience. Sign up with my link: ${dashboard.link}`;

  async function copy(kind: "code" | "link") {
    await navigator.clipboard.writeText(kind === "code" ? dashboard.code : dashboard.link).catch(() => undefined);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }

  async function cashOut() {
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/affiliate/payouts", { method: "POST" }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setNotice({ text: body?.error ?? "Unable to cash out right now.", error: true });
      return;
    }
    setNotice({
      text: `Cash-out of ${formatNaira(body.payout.amount)} requested. You'll be notified when it's paid.`,
      error: false,
    });
    await onChange();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          You earn {dashboard.commissionPercent}% of every internship payment made by people you invite.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6">
          <h2 className="text-sm font-bold">Your invite link</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <p className="min-w-0 flex-1 truncate rounded-xl bg-[#f3f6fb] px-4 py-3 text-sm" title={dashboard.link}>
              {dashboard.link}
            </p>
            <button
              type="button"
              onClick={() => void copy("link")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-semibold text-white"
            >
              {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-500">Your code</span>
            <button
              type="button"
              onClick={() => void copy("code")}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#5FBB46] px-3 py-1.5 font-mono text-base font-bold tracking-wider"
            >
              {dashboard.code}
              {copied === "code" ? <Check className="h-4 w-4 text-[#397d3a]" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
            >
              <Share2 className="h-4 w-4" /> Share on WhatsApp
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            People who open your link and create an account within 30 days are credited to you.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Available balance</h2>
            <Wallet className="h-4 w-4 text-[#5FBB46]" />
          </div>
          <p className="mt-2 text-3xl font-bold">{formatNaira(balance.available)}</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[#5FBB46]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {reached
              ? `You've reached the ${formatNaira(payoutMinimum)} minimum.`
              : `${formatNaira(payoutMinimum - balance.available)} more to reach the ${formatNaira(payoutMinimum)} minimum cash-out.`}
          </p>

          {pending ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              A cash-out of <strong>{formatNaira(pending.amount)}</strong> is waiting to be paid
              (requested {shortDate(pending.requestedAt)}).
            </p>
          ) : !dashboard.bankDetails ? (
            <Link
              href="/affiliate/settings"
              className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900"
            >
              <Landmark className="h-4 w-4" /> Add your bank details to cash out
              <ArrowRight className="ml-auto h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy || !reached}
              onClick={() => void cashOut()}
              className="mt-4 w-full rounded-xl bg-[#5FBB46] px-4 py-3 text-sm font-bold text-[#14204f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Requesting…" : `Cash out ${formatNaira(balance.available)}`}
            </button>
          )}
          <p className="mt-3 text-[11px] text-slate-500">
            Month-end cash-out is <strong>{dashboard.autoMonthlyPayout ? "on" : "off"}</strong>
            {dashboard.autoMonthlyPayout && ` (only when your balance is at least ${formatNaira(payoutMinimum)})`}.{" "}
            <Link href="/affiliate/settings" className="font-semibold text-[#397d3a] underline">
              Change
            </Link>
          </p>
          {notice && (
            <p role={notice.error ? "alert" : "status"} className={`mt-3 rounded-xl p-3 text-xs ${notice.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}>
              {notice.text}
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={MousePointerClick} label="Link visits" value={dashboard.stats.clicks.toLocaleString("en-NG")} />
        <Stat icon={UserPlus} label="Signed up" value={dashboard.stats.signUps.toLocaleString("en-NG")} />
        <Stat icon={Check} label="Paid for an internship" value={dashboard.stats.paid.toLocaleString("en-NG")} />
        <Stat icon={Banknote} label="Total earned" value={formatNaira(balance.totalEarned)} detail={`${formatNaira(balance.paidOut)} paid out`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6">
          <h2 className="text-sm font-bold">People you invited</h2>
          {dashboard.people.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No one yet. Share your link to get started.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {dashboard.people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold">{person.name}</p>
                    <p className="text-xs text-slate-500">Joined {shortDate(person.joinedAt)}</p>
                  </div>
                  {person.earned > 0 ? (
                    <span className="rounded-full bg-[#e8f7eb] px-3 py-1 text-xs font-semibold text-[#397d3a]">
                      +{formatNaira(person.earned)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      Not paid yet
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.06)] sm:p-6">
          <h2 className="text-sm font-bold">Cash-outs</h2>
          {dashboard.payouts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No cash-outs yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {dashboard.payouts.map((payout) => (
                <li key={payout.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{formatNaira(payout.amount)}</p>
                    <PayoutStatus status={payout.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {payout.automatic ? "Month-end cash-out" : "Requested"} {shortDate(payout.requestedAt)}
                    {payout.processedAt && ` · ${payout.status === "PAID" ? "paid" : "declined"} ${shortDate(payout.processedAt)}`}
                  </p>
                  {payout.adminNote && <p className="mt-1 text-xs text-slate-600">Note: {payout.adminNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.06)]">
      <Icon className="h-4 w-4 text-[#5FBB46]" />
      <p className="mt-3 text-xl font-bold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {detail && <p className="mt-0.5 text-[11px] text-slate-400">{detail}</p>}
    </article>
  );
}

function PayoutStatus({ status }: { status: "PENDING" | "PAID" | "REJECTED" }) {
  const style = {
    PENDING: "bg-amber-100 text-amber-800",
    PAID: "bg-[#e8f7eb] text-[#397d3a]",
    REJECTED: "bg-red-50 text-red-700",
  }[status];
  const label = { PENDING: "Waiting to be paid", PAID: "Paid", REJECTED: "Declined" }[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}
