"use client";

import { Megaphone, MousePointerClick, Share2, UserPlus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReferralStats } from "@/lib/referral-stats";

// The admin Referrals page: interns share achievement cards, friends tap
// them, sign up and pay. Numbers come from /api/admin/internship/referrals.

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All time", days: 0 },
];

const VISITS = "#3B5BDB";
const SIGNUPS = "#3E8F2C";

const CHANNEL_LABELS: Record<string, string> = {
  native: "Phone share sheet",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  download: "Downloaded",
  copy: "Copied link",
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const count = (value: number) => new Intl.NumberFormat("en-NG").format(value);
const rate = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function DailyChart({ daily }: { daily: ReferralStats["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 32 };
  const max = Math.max(4, ...daily.map((row) => Math.max(row.visits, row.registrations)));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const slot = plotWidth / daily.length;
  const bar = Math.max(1.5, Math.min(10, (slot - 4) / 2));
  const y = (value: number) => pad.top + plotHeight - (value / top) * plotHeight;
  const labelEvery = Math.ceil(daily.length / 6);
  const active = hover === null ? null : daily[hover];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Card link visits and sign-ups per day">
        {[0, 1, 2, 3, 4].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick * step)} y2={y(tick * step)} stroke="#E2E8F0" strokeWidth={1} />
            <text x={pad.left - 6} y={y(tick * step) + 3} textAnchor="end" fontSize={10} fill="#64748B">{tick * step}</text>
          </g>
        ))}
        {daily.map((row, index) => {
          const x = pad.left + index * slot + slot / 2;
          const marks = [
            { value: row.visits, color: VISITS, at: x - bar - 1 },
            { value: row.registrations, color: SIGNUPS, at: x + 1 },
          ];
          return (
            <g key={row.date}>
              {marks.map((mark) =>
                mark.value > 0 ? (
                  <rect
                    key={mark.color}
                    x={mark.at}
                    y={y(mark.value)}
                    width={bar}
                    height={y(0) - y(mark.value)}
                    rx={Math.min(4, bar / 2)}
                    fill={mark.color}
                    opacity={hover === null || hover === index ? 1 : 0.45}
                  />
                ) : null,
              )}
              {index % labelEvery === 0 && (
                <text x={x} y={height - 8} textAnchor="middle" fontSize={10} fill="#64748B">{shortDate(row.date)}</text>
              )}
              <rect
                x={pad.left + index * slot}
                y={pad.top}
                width={slot}
                height={plotHeight}
                fill="transparent"
                tabIndex={0}
                aria-label={`${shortDate(row.date)}: ${row.visits} visits, ${row.registrations} sign-ups`}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${((pad.left + hover * slot + slot / 2) / width) * 100}% - 60px), calc(100% - 130px))` }}
        >
          <p className="font-semibold text-slate-500">{shortDate(active.date)}</p>
          <p className="mt-1 flex items-center gap-2"><span className="h-0.5 w-3" style={{ background: VISITS }} /><strong className="text-[#1C1D52]">{active.visits}</strong><span className="text-slate-500">visits</span></p>
          <p className="flex items-center gap-2"><span className="h-0.5 w-3" style={{ background: SIGNUPS }} /><strong className="text-[#1C1D52]">{active.registrations}</strong><span className="text-slate-500">sign-ups</span></p>
        </div>
      )}
    </div>
  );
}

export default function ReferralDashboard() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/internship/referrals?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load referrals.");
        if (!cancelled) setStats(data as ReferralStats);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load referrals.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const totals = stats?.totals;
  const funnel = totals
    ? [
        { label: "Achievements unlocked", value: totals.unlocks },
        { label: "Celebrations seen", value: totals.celebrated },
        { label: "Cards shared", value: totals.shares },
        { label: "Card link visits", value: totals.visits },
        { label: "Started signing up", value: totals.started },
        { label: "Signed up", value: totals.registrations },
        { label: "Applied to a track", value: totals.applied },
        { label: "Paid", value: totals.paid },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnel.map((row) => row.value));

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Growth</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Referrals</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            Interns share their achievement cards on WhatsApp, Instagram, LinkedIn and more. Here is who taps them, signs up and pays. Each sign-up is credited to one intern&apos;s card.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Time range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => {
                if (range.days === days) return;
                setLoading(true);
                setError("");
                setDays(range.days);
              }}
              aria-pressed={days === range.days}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === range.days ? "bg-[#1C1D52] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}

      {!stats && loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading referrals…</p>
      ) : stats && totals ? (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: "Cards shared", value: count(totals.shares), note: `${rate(totals.shares, totals.celebrated)} of celebrations`, icon: Share2 },
              { label: "Link visits", value: count(totals.visits), note: `${totals.shares ? (totals.visits / totals.shares).toFixed(1) : "0"} per card`, icon: MousePointerClick },
              { label: "Sign-ups", value: count(totals.registrations), note: `${rate(totals.registrations, totals.visits)} of visits`, icon: UserPlus },
              { label: "Paid", value: count(totals.paid), note: `${rate(totals.paid, totals.registrations)} of sign-ups`, icon: Megaphone },
              { label: "Revenue", value: money(totals.revenue), note: "From referred learners", icon: Wallet },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  {tile.label}
                  <tile.icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
                <p className="mt-2 text-2xl font-bold text-[#1C1D52]">{tile.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{tile.note}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-[#1C1D52]">From achievement to payment</h2>
              <div className="mt-4 space-y-2.5">
                {funnel.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">{row.label}</span>
                      <span className="font-semibold text-[#1C1D52]">{count(row.value)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#5FBB46]" style={{ width: `${Math.max(row.value ? 2 : 0, (row.value / funnelMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[#1C1D52]">Visits and sign-ups per day</h2>
                <div className="flex gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: VISITS }} /> Link visits</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SIGNUPS }} /> Sign-ups</span>
                </div>
              </div>
              <div className="mt-3"><DailyChart daily={stats.daily} /></div>
              {stats.channels.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500">Where cards were shared</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {stats.channels.map((row) => (
                      <span key={row.channel} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {CHANNEL_LABELS[row.channel] ?? row.channel} <strong className="text-[#1C1D52]">{row.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-5 py-4 font-bold text-[#1C1D52]">Top referrers</h2>
            {stats.referrers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr><th className="px-5 py-2.5">Intern</th><th>Track</th><th className="text-right">Cards</th><th className="text-right">Visits</th><th className="text-right">Sign-ups</th><th className="text-right">Paid</th><th className="px-5 text-right">Revenue</th></tr>
                  </thead>
                  <tbody>
                    {stats.referrers.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-5 py-3"><p className="font-semibold text-[#1C1D52]">{row.name}</p><p className="text-slate-500">{row.email}</p></td>
                        <td className="text-slate-600">{row.track ?? "—"}</td>
                        <td className="text-right">{row.shares}</td>
                        <td className="text-right">{row.visits}</td>
                        <td className="text-right font-semibold text-[#1C1D52]">{row.registrations}</td>
                        <td className="text-right">{row.paid}</td>
                        <td className="px-5 text-right">{money(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-slate-500">No cards shared in this period yet. Interns see a share pop-up whenever they unlock an achievement.</p>
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 px-5 py-4 font-bold text-[#1C1D52]">Achievements that bring people in</h2>
              {stats.achievements.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-2.5">Achievement</th><th className="text-right">Cards</th><th className="text-right">Visits</th><th className="px-5 text-right">Sign-ups</th></tr></thead>
                    <tbody>
                      {stats.achievements.map((row) => (
                        <tr key={row.title} className="border-t border-slate-100">
                          <td className="px-5 py-3 font-semibold text-[#1C1D52]">{row.title}</td>
                          <td className="text-right">{row.shares}</td>
                          <td className="text-right">{row.visits}</td>
                          <td className="px-5 text-right font-semibold text-[#1C1D52]">{row.registrations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-5 text-sm text-slate-500">Nothing shared yet.</p>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 px-5 py-4 font-bold text-[#1C1D52]">Latest referred sign-ups</h2>
              {stats.recent.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-2.5">Learner</th><th>Referred by</th><th>Status</th><th className="px-5 text-right">Joined</th></tr></thead>
                    <tbody>
                      {stats.recent.map((row) => (
                        <tr key={`${row.email}-${row.registeredAt}`} className="border-t border-slate-100">
                          <td className="px-5 py-3"><p className="font-semibold text-[#1C1D52]">{row.name}</p><p className="text-slate-500">{row.track ?? row.email}</p></td>
                          <td><p className="text-slate-700">{row.referrer}</p><p className="text-slate-500">{row.achievement}</p></td>
                          <td>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.status === "Paid" ? "bg-green-100 text-green-800" : row.status === "Applied" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>
                              {row.status}{row.amount ? ` · ${money(row.amount)}` : ""}
                            </span>
                          </td>
                          <td className="px-5 text-right text-slate-500">{new Date(row.registeredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-5 text-sm text-slate-500">No referred sign-ups in this period yet.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
