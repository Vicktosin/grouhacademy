"use client";

import { CalendarClock, CheckCircle2, LoaderCircle, Rocket, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCachedJson } from "@/lib/client-cache";
import type { LearningModeState } from "@/lib/learning-mode";

// After paying the acceptance fee: start now at your own pace, or join the
// next cohort. Shown once per level (InternshipShell sends interns here
// until they choose). Deliberately simple: most interns are on phones.

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
}

export default function ChooseLearningModePage() {
  const router = useRouter();
  const [state, setState] = useState<LearningModeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"SELF_PACED" | "COHORT" | null>(null);

  useEffect(() => {
    fetch("/api/internship/learning-mode", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/internship");
          return null;
        }
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load your options.");
        return data as LearningModeState;
      })
      .then((data) => {
        if (!data) return;
        // Already chosen (or not paid yet): nothing to choose here.
        if (!data.needsChoice) router.replace("/internship/dashboard");
        else setState(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load your options."));
  }, [router]);

  async function choose(mode: "SELF_PACED" | "COHORT") {
    setSaving(mode);
    setError(null);
    try {
      const response = await fetch("/api/internship/learning-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save your choice.");
      // The shell's cached status said "needs a choice".
      clearCachedJson();
      router.replace(mode === "SELF_PACED" ? "/internship/dashboard/tasks" : "/internship/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save your choice.");
      setSaving(null);
    }
  }

  const options = state?.options;
  const cohort = options?.cohort;

  return (
    <main className="min-h-dvh bg-[#F0F7FF] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f7d52]">You&apos;re in! 🎉</p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-[#1C1D52]">How would you like to learn?</h1>
        {state && (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {state.trackName} · {state.levelName}. Pick the way that suits you. You get the same tasks and certificate either way.
          </p>
        )}

        {!state && !error && (
          <p className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading your options…
          </p>
        )}

        {options?.note && (
          <p className="mt-5 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">{options.note}</p>
        )}

        <div className="mt-5 space-y-3">
          {options?.selfPaced.available && (
            <button
              type="button"
              onClick={() => void choose("SELF_PACED")}
              disabled={saving !== null}
              className="block w-full rounded-2xl border-2 border-[#5FBB46] bg-white p-5 text-left shadow-[0_8px_24px_rgba(28,29,82,0.08)] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf9f3] text-[#2f7d52]">
                  <Rocket className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-lg font-bold text-[#1C1D52]">Start now at your own pace</span>
              </span>
              <span className="mt-3 block text-sm leading-6 text-slate-600">
                Your tasks open today. Work through them in order on your own time and finish when you&apos;re ready.
              </span>
              <span className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-3 text-sm font-bold text-[#14204f]">
                {saving === "SELF_PACED" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Start now
              </span>
            </button>
          )}

          {cohort?.available && (
            <button
              type="button"
              onClick={() => void choose("COHORT")}
              disabled={saving !== null}
              className="block w-full rounded-2xl border-2 border-[#1C1D52]/15 bg-white p-5 text-left shadow-[0_8px_24px_rgba(28,29,82,0.08)] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#1C1D52]">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="text-lg font-bold text-[#1C1D52]">
                  {cohort.waitlist ? "Wait for the next cohort" : "Join the next cohort"}
                </span>
              </span>
              <span className="mt-3 block text-sm leading-6 text-slate-600">
                {cohort.waitlist
                  ? "Learn with a group on a set timetable. We'll add you as soon as the next cohort is scheduled."
                  : "Learn with a group, on a set timetable, with team tasks and deadlines."}
              </span>
              {!cohort.waitlist && cohort.startDate && (
                <span className="mt-3 flex items-center gap-2 rounded-xl bg-[#F0F7FF] px-3 py-2 text-sm font-semibold text-[#1C1D52]">
                  <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Starts {formatDate(cohort.startDate)}
                  {cohort.daysLeft !== null && (
                    <span className="ml-auto whitespace-nowrap text-xs font-bold text-[#2f7d52]">
                      {cohort.daysLeft === 0 ? "Today" : `${cohort.daysLeft} day${cohort.daysLeft === 1 ? "" : "s"} left`}
                    </span>
                  )}
                </span>
              )}
              <span className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-bold text-white">
                {saving === "COHORT" && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {cohort.waitlist ? "Join the waiting list" : "Join the cohort"}
              </span>
            </button>
          )}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        {state && options?.selfPaced.available && cohort?.available && (
          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d52]" aria-hidden="true" />
            Started at your own pace and want a group later? You can join the next cohort once from your dashboard, and keep the work you&apos;ve done.
          </p>
        )}
      </div>
    </main>
  );
}
