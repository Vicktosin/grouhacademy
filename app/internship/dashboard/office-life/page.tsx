"use client";

import { Briefcase, CalendarClock, CheckCircle2, Loader2, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import FullscreenFrame from "@/components/FullscreenFrame";
import InternshipShell from "@/components/InternshipShell";
import OfficeLifeDesk from "@/components/office-life/OfficeLifeDesk";
import type { DayData } from "@/components/office-life/shared";
import type { officeLifeOverview } from "@/lib/office-life/server";

// Office Life: scheduled workdays at a company during the internship.

type Overview = Awaited<ReturnType<typeof officeLifeOverview>>;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";

export default function OfficeLifePage() {
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/internship/office-life", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load Office Life.");
        setOverview(data);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Unable to load Office Life."));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const raw = searchParams.get("day");
    const number = raw === null ? null : Number(raw);
    if (number !== null && Number.isInteger(number) && number >= 1 && number <= 4) {
      void open(number);
    }
  }, [searchParams]);

  async function open(number: number) {
    setOpening(number);
    setError(null);
    const response = await fetch(`/api/internship/office-life/${number}`, { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setOpening(null);
    if (!response?.ok) return setError(data?.error ?? "Unable to open this workday.");
    setDay(data as DayData);
  }

  return (
    <InternshipShell>
      {day ? (
        <FullscreenFrame ownControls>
          <OfficeLifeDesk
            key={day.day}
            initial={day}
            onBack={() => {
              setDay(null);
              load();
            }}
          />
        </FullscreenFrame>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Office Life</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1C1D52]">Your workdays</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Complete scheduled workdays at {overview?.enrolled ? overview.company : "a company"}
              {overview?.enrolled ? ` in the ${overview.department} team · ${overview.level} level` : ""}: read and send emails, join meetings, work with the Practice Lab, and submit reports.
            </p>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {!overview ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : !overview.enrolled ? (
            <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">Office Life opens once you&apos;re admitted to a track.</p>
          ) : !overview.hasCohort ? (
            <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">Office Life opens once you&apos;re placed in a cohort.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[#1C1D52] p-5 text-white">
                <Briefcase className="h-8 w-8 text-[#5FBB46]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {overview.company} · {overview.department}
                  </p>
                  <p className="text-xs text-white/70">This month&apos;s client: {overview.client} · {overview.level} level</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/60">Workplace readiness</p>
                  <p className="text-2xl font-bold">{overview.readiness === null ? "–" : `${overview.readiness}/100`}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {overview.days.map((item) => (
                  <section key={item.day} className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Workday {item.day}</p>
                        <h2 className="mt-1 text-base font-bold text-[#1C1D52]">{item.title}</h2>
                      </div>
                      {item.completedAt ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.late ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> {item.score}/100{item.late ? " · late" : ""}
                        </span>
                      ) : !item.open ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          <Lock className="h-3.5 w-3.5" /> Opens {when(item.opensAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 flex-1 text-xs leading-5 text-slate-500">{item.summary}</p>
                    {item.opensAt && item.dueAt && (
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CalendarClock className="h-3.5 w-3.5" /> Opens {when(item.opensAt)} · Due {when(item.dueAt)} WAT
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={(!item.open && !item.completedAt) || opening !== null}
                      onClick={() => void open(item.day)}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {opening === item.day && <Loader2 className="h-4 w-4 animate-spin" />}
                      {item.completedAt ? "Review this workday" : item.closed ? "Window closed" : item.stepsDone > 0 ? `Continue (${item.stepsDone}/${item.stepsTotal})` : item.open ? "Start this workday" : "Not open yet"}
                    </button>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </InternshipShell>
  );
}
