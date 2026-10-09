"use client";

import { ChevronRight, Compass } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import InternshipShell from "@/components/InternshipShell";
import { FAQ, GUIDE, TOUR_ORDER, WELCOME_SLIDES } from "@/lib/intern-guide";
import { setFlag, startTour } from "@/lib/intern-onboarding";

// Help for interns: how the internship works, a replay of the guided tour,
// every page explained and common questions. All text is in lib/intern-guide.

export default function InternHelpPage() {
  useEffect(() => setFlag("welcome"), []);

  return (
    <InternshipShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">Help</h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              How the internship works and what each part of the app is for.
            </p>
          </div>
          <button
            type="button"
            onClick={startTour}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]"
          >
            <Compass className="h-4 w-4" /> Take the tour
          </button>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          {WELCOME_SLIDES.map((slide) => (
            <div key={slide.title} className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
              <h2 className="text-sm font-bold text-[#1C1D52]">{slide.title}</h2>
              <div className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                {slide.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <h2 className="text-sm font-bold text-[#1C1D52]">Each page explained</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {TOUR_ORDER.map((key) => {
              const entry = GUIDE[key];
              return (
                <li key={key}>
                  <details className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs">
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                      <span className="font-bold text-[#1C1D52]">{entry.label}</span>
                      <span className="hidden text-slate-500 sm:inline">· {entry.summary}</span>
                    </summary>
                    <div className="mt-2 pl-6">
                      <p className="text-xs text-slate-600 sm:hidden">{entry.summary}</p>
                      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-600">
                        {entry.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                      <Link href={entry.href} className="mt-2 inline-block text-xs font-semibold text-[#1C1D52] hover:underline">
                        Open {entry.label} →
                      </Link>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <h2 className="text-sm font-bold text-[#1C1D52]">Common questions</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {FAQ.map((item) => (
              <li key={item.q}>
                <details className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#1C1D52]">
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                    {item.q}
                  </summary>
                  <p className="mt-2 pl-6 text-xs leading-5 text-slate-600">{item.a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </InternshipShell>
  );
}
