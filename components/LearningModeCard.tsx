"use client";

import { CalendarClock, Hourglass, LoaderCircle, Rocket, Users } from "lucide-react";
import { useState } from "react";
import { clearCachedJson } from "@/lib/client-cache";
import type { LearningModeState } from "@/lib/learning-mode";

// The dashboard's "how you're learning" card: self-paced (with joining the
// next cohort once per level), waiting for a cohort, or a cohort that
// hasn't started yet. Nothing for interns whose cohort is already running.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function LearningModeCard({ learning }: { learning: LearningModeState | null }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!learning) return null;

  async function switchToCohort() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internship/learning-mode/switch", { method: "POST" }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      return setError(data?.error ?? "Unable to switch. Please try again.");
    }
    clearCachedJson();
    window.location.reload();
  }

  const card = "rounded-2xl p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]";

  if (learning.status === "Waiting")
    return (
      <section className={`${card} border border-amber-200 bg-amber-50`}>
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <Hourglass className="h-5 w-5" aria-hidden="true" /> You&apos;re on the waiting list
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-900/80">
          There&apos;s no {learning.trackName} cohort scheduled for {learning.levelName} yet. We&apos;ll add you as soon as the next one is set, and you&apos;ll see its start date here.
        </p>
      </section>
    );

  if (learning.status === "Cohort" && learning.cohort && new Date(learning.cohort.startDate) > new Date()) {
    const days = daysLeft(learning.cohort.startDate);
    return (
      <section className={`${card} bg-white`}>
        <p className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
          <CalendarClock className="h-5 w-5 text-[#2f7d52]" aria-hidden="true" /> Your cohort starts on {formatDate(learning.cohort.startDate)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {days === 0 ? "That's today!" : `${days} day${days === 1 ? "" : "s"} to go.`} Your first tasks open then. Meanwhile, look around and join the WhatsApp community.
        </p>
      </section>
    );
  }

  if (learning.status !== "Self-paced") return null;

  return (
    <section className={`${card} bg-white`}>
      <p className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
        <Rocket className="h-5 w-5 text-[#2f7d52]" aria-hidden="true" /> You&apos;re learning at your own pace
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Do your tasks in order, on your own time. Your certificate comes when you&apos;ve passed enough of them.
      </p>

      {learning.canSwitchToCohort && learning.nextCohort && (
        <div className="mt-4 rounded-xl bg-[#F0F7FF] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#1C1D52]">
            <Users className="h-4 w-4" aria-hidden="true" /> Prefer learning with a group?
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The next cohort starts {formatDate(learning.nextCohort.startDate)} ({daysLeft(learning.nextCohort.startDate)} days left).
          </p>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 w-full rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-bold text-white sm:w-auto"
            >
              Join the next cohort
            </button>
          ) : (
            <div className="mt-3 rounded-xl bg-white p-3">
              <p className="text-sm leading-6 text-slate-700">
                You can only do this once for this level. The work you&apos;ve finished stays, and you&apos;ll follow the cohort&apos;s timetable from its start date.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void switchToCohort()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />} Yes, join the cohort
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600">
                  Not now
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </section>
  );
}
