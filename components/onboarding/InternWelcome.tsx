"use client";

import { ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { useEffect, useState } from "react";
import { WELCOME_SLIDES } from "@/lib/intern-guide";
import { getFlag, setFlag, SHOW_WELCOME, startTour } from "@/lib/intern-onboarding";

// The first thing a new intern sees on their dashboard: what the internship
// is (it isn't a class), how it works and how they finish, then an offer of
// a quick tour of the menu. Shown once; the Help page can show it again.

export default function InternWelcome({ autoOpen }: { autoOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit check reads browser storage
    if (autoOpen && !getFlag("welcome")) setOpen(true);
    const show = () => {
      setSlide(0);
      setOpen(true);
    };
    window.addEventListener(SHOW_WELCOME, show);
    return () => window.removeEventListener(SHOW_WELCOME, show);
  }, [autoOpen]);

  if (!open) return null;
  const close = (tour: boolean) => {
    setFlag("welcome");
    setOpen(false);
    if (tour) startTour();
  };
  const current = WELCOME_SLIDES[slide];
  const last = slide === WELCOME_SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0d1030]/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5FBB46]">
          {slide + 1} of {WELCOME_SLIDES.length}
        </p>
        <h2 className="mt-1 text-xl font-bold text-[#1C1D52]">{current.title}</h2>
        <div className="mt-3 space-y-2.5 text-sm leading-6 text-slate-600">
          {current.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-5 flex justify-center gap-1.5">
          {WELCOME_SLIDES.map((_, index) => (
            <span key={index} className={`h-1.5 rounded-full ${index === slide ? "w-6 bg-[#5FBB46]" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {slide > 0 ? (
            <button type="button" onClick={() => setSlide(slide - 1)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => close(false)} className="rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                I&apos;ll explore myself
              </button>
              <button type="button" onClick={() => close(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]">
                <Compass className="h-4 w-4" /> Show me around
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setSlide(slide + 1)} className="inline-flex items-center gap-1 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
