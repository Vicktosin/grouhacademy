"use client";

import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE, TOUR_ORDER } from "@/lib/intern-guide";
import { setFlag, START_TOUR } from "@/lib/intern-onboarding";

// The guided tour of the intern menu: one card per section saying what it's
// for, with Next/Back. On wide screens the matching menu item is highlighted;
// on phones the card says to open the menu. Started from the welcome or the
// Help page.

const HIGHLIGHT = ["ring-2", "ring-[#5FBB46]", "ring-offset-2", "ring-offset-[#1C1D52]"];

export default function InternTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    const start = () => setStep(0);
    window.addEventListener(START_TOUR, start);
    return () => window.removeEventListener(START_TOUR, start);
  }, []);

  const entry = step === null ? null : GUIDE[TOUR_ORDER[step]];

  // Highlight the visible menu item for this step.
  useEffect(() => {
    if (!entry) return;
    const items = [...document.querySelectorAll<HTMLElement>(`[data-tour="${entry.href}"]`)].filter(
      (element) => element.offsetParent !== null,
    );
    items.forEach((element) => {
      element.classList.add(...HIGHLIGHT);
      element.scrollIntoView({ block: "nearest" });
    });
    return () => items.forEach((element) => element.classList.remove(...HIGHLIGHT));
  }, [entry]);

  if (step === null || !entry) return null;
  const finish = () => {
    setFlag("tour");
    setStep(null);
  };
  const last = step === TOUR_ORDER.length - 1;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:bottom-6 md:left-auto md:right-6 md:mx-0" role="dialog" aria-label="Guided tour">
      <button type="button" onClick={finish} aria-label="End the tour" className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
        <X className="h-4 w-4" />
      </button>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5FBB46]">
        Tour · {step + 1} of {TOUR_ORDER.length}
      </p>
      <h2 className="mt-1 text-base font-bold text-[#1C1D52]">{entry.label}</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-600">{entry.summary}</p>
      <p className="mt-1.5 text-[11px] text-slate-400 md:hidden">Find it in the menu (☰ at the top).</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={entry.href} onClick={finish} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1D52] underline-offset-2 hover:underline">
          Go there now <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <span className="ml-auto flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? finish() : setStep(step + 1))}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1C1D52] px-4 py-2 text-xs font-bold text-white"
          >
            {last ? "Finish" : "Next"} {!last && <ChevronRight className="h-4 w-4" />}
          </button>
        </span>
      </div>
    </div>
  );
}
