"use client";

import { HelpCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { HowItWorksGuide as Guide } from "@/lib/how-it-works";
import { getFlag, setFlag } from "@/lib/intern-onboarding";

// "How it works" for Office Life and the Practice Lab: opens by itself the
// first time an intern comes to the area (remembered in this browser once
// closed), and a "How it works" button opens it again. A demo video, when an
// admin has set one (Admin > Office Life / Practice Lab), plays at the top.

const seenFlag = (key: Guide["key"]) => `howto:${key}`;

/** Whether the guide should open by itself: not closed before in this browser. */
export function isFirstVisit(key: Guide["key"]) {
  return !getFlag(seenFlag(key));
}

/** Closing remembers it; the button opens it again. */
export function guideActions(key: Guide["key"], setOpen: (open: boolean) => void) {
  return {
    close() {
      setFlag(seenFlag(key));
      setOpen(false);
    },
    reopen() {
      setOpen(true);
    },
  };
}

export default function HowItWorksGuide({
  guide,
  visited,
}: {
  guide: Guide;
  /** Also ticks this page on the dashboard's getting-started list. */
  visited?: string;
}) {
  const [open, setOpen] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const { close, reopen } = guideActions(guide.key, setOpen);

  useEffect(() => {
    if (visited) setFlag(`visited:${visited}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit check reads browser storage
    setOpen(isFirstVisit(guide.key));
  }, [guide.key, visited]);

  useEffect(() => {
    let alive = true;
    fetch("/api/internship/guide-videos", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Record<string, string | null> | null) => {
        if (alive) setVideo(body?.[guide.key] ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [guide.key]);

  return (
    <>
      <HowItWorksButton onClick={reopen} />
      {open && <HowItWorksDialog guide={guide} videoSrc={video} onClose={close} />}
    </>
  );
}

export function HowItWorksButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-[0_4px_12px_rgba(28,29,82,0.06)] hover:text-[#1C1D52]"
    >
      <HelpCircle className="h-3.5 w-3.5" /> How it works
    </button>
  );
}

export function HowItWorksDialog({ guide, videoSrc, onClose }: { guide: Guide; videoSrc: string | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0f1033]/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`howto-${guide.key}`}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id={`howto-${guide.key}`} className="text-base font-bold text-[#1C1D52]">
            {guide.title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1C1D52]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          {videoSrc && (
            <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={videoSrc}
                title={`${guide.title}: demo video`}
                className="h-full w-full"
                allow="encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          )}
          <p className="text-sm leading-6 text-slate-600">{guide.intro}</p>
          {guide.sections.map((section) => (
            <section key={section.heading} className="mt-4">
              <h3 className="text-sm font-bold text-[#1C1D52]">{section.heading}</h3>
              <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <div className="border-t border-slate-100 px-4 py-3 sm:px-5">
          <button type="button" onClick={onClose} className="w-full rounded-lg bg-[#1C1D52] px-4 py-2.5 text-sm font-bold text-white sm:w-auto">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
