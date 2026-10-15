"use client";

import HowItWorksGuide from "@/components/onboarding/HowItWorksGuide";
import { PRACTICE_LAB_GUIDE } from "@/lib/how-it-works";
import {
  ChevronRight,
  Code2,
  FlaskConical,
  Loader2,
  Megaphone,
  MessagesSquare,
  Server,
  Globe,
  PenLine,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import InternshipShell from "@/components/InternshipShell";

type Exercise = {
  id: string;
  title: string;
  kind: "WEB" | "REACT" | "ADS" | "SOCIAL" | "AUTOMATION" | "BACKEND" | "WORDPRESS" | "CONTENT";
  kindLabel: string;
  track: string;
  level: string;
  checkCount: number;
  status: "DRAFT" | "SUBMITTED" | null;
  checksPassed: number | null;
  checksTotal: number | null;
};

export default function PracticeLabPage() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internship/lab", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load.");
        setExercises(body.exercises as Exercise[]);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      );
  }, []);

  return (
    <InternshipShell>
      <div className="space-y-5">
        <div>
          <HowItWorksGuide guide={PRACTICE_LAB_GUIDE} visited="lab" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">
            Practice Lab
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Hands-on exercises for your track: write real code, run marketing
            simulations or build automations, and check your work as you go.
          </p>
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {!exercises && !error ? (
          <div className="flex justify-center rounded-2xl bg-white p-10 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
          </div>
        ) : exercises && exercises.length === 0 ? (
          <section className="flex flex-col items-center rounded-2xl bg-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <FlaskConical className="h-8 w-8 text-blue-500" />
            <p className="mt-3 text-sm font-semibold text-[#1C1D52]">
              No exercises for your track yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              New exercises will appear here as soon as they&apos;re published.
            </p>
          </section>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {exercises?.map((exercise) => (
              <li key={exercise.id}>
                <Link
                  href={`/internship/dashboard/lab/${exercise.id}`}
                  className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] transition hover:ring-2 hover:ring-[#5FBB46]"
                >
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                    {exercise.kind === "ADS" ? (
                      <Megaphone className="h-3.5 w-3.5" />
                    ) : exercise.kind === "SOCIAL" ? (
                      <MessagesSquare className="h-3.5 w-3.5" />
                    ) : exercise.kind === "AUTOMATION" ? (
                      <Workflow className="h-3.5 w-3.5" />
                    ) : exercise.kind === "BACKEND" ? (
                      <Server className="h-3.5 w-3.5" />
                    ) : exercise.kind === "WORDPRESS" ? (
                      <Globe className="h-3.5 w-3.5" />
                    ) : exercise.kind === "CONTENT" ? (
                      <PenLine className="h-3.5 w-3.5" />
                    ) : (
                      <Code2 className="h-3.5 w-3.5" />
                    )}
                    {exercise.kindLabel} · {exercise.level} level
                  </span>
                  <span className="mt-2 text-sm font-bold text-[#1C1D52]">
                    {exercise.title}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                    <span>
                      {exercise.status === "SUBMITTED"
                        ? `Submitted · ${exercise.checksPassed ?? 0}/${exercise.checksTotal ?? 0} ${UNITS[exercise.kind].done}`
                        : exercise.status === "DRAFT"
                          ? "In progress"
                          : `${exercise.checkCount} ${UNITS[exercise.kind].one}${exercise.checkCount === 1 ? "" : "s"}`}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InternshipShell>
  );
}

/** What each kind of exercise is scored on. */
const CHECKS = { one: "check", done: "checks passed" };
const GOALS = { one: "goal", done: "goals met" };
const UNITS: Record<Exercise["kind"], { one: string; done: string }> = {
  WEB: CHECKS,
  REACT: CHECKS,
  ADS: GOALS,
  SOCIAL: GOALS,
  AUTOMATION: { one: "test record", done: "records correct" },
  BACKEND: { one: "API test", done: "tests passed" },
  WORDPRESS: CHECKS,
  CONTENT: { one: "mark", done: "marks met" },
};
