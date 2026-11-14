"use client";

import { ArrowRight, Award, Download, PartyPopper, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { markLevelCompleteSettled } from "./graduation/graduation-data";

type Progression = {
  programName: string;
  levelName: string;
  certificateId: string | null;
  nextLevel: { id: string; name: string; acceptanceFee: number | null } | null;
  queuedApplicationId: string | null;
};

const dismissKey = (certificateId: string) =>
  `level-complete-dismissed:${certificateId}`;

/**
 * Congratulates an intern once they've earned their level's certificate,
 * offering the certificate and the next level. Shown once per certificate
 * (remembered in this browser), and not after they've started moving up.
 */
export default function LevelCompleteModal() {
  const [progression, setProgression] = useState<Progression | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/internship/progression", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Progression | null) => {
        // The graduation flyer pop-up waits for this one (graduation-data).
        if (!data?.certificateId || data.queuedApplicationId) return markLevelCompleteSettled();
        let dismissed = false;
        try {
          dismissed =
            window.localStorage.getItem(dismissKey(data.certificateId)) === "1";
        } catch {
          // Storage unavailable: show it this time.
        }
        setProgression(data);
        setOpen(!dismissed);
        if (dismissed) markLevelCompleteSettled();
      })
      .catch(() => markLevelCompleteSettled());
  }, []);

  const close = () => {
    setOpen(false);
    markLevelCompleteSettled();
    if (!progression?.certificateId) return;
    try {
      window.localStorage.setItem(dismissKey(progression.certificateId), "1");
    } catch {
      // Not remembered; it will show again next visit.
    }
  };

  if (!open || !progression) return null;
  const next = progression.nextLevel;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/75 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-complete-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white text-center shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="bg-[#1C1D52] px-6 pb-8 pt-7 text-white">
          <span className="inline-flex items-center rounded-full border border-[#9be28a]/40 bg-[#9be28a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
            {progression.levelName} level complete
          </span>
          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7eb] text-[#5FBB46]">
            <PartyPopper className="h-8 w-8" />
          </div>
        </div>
        <div className="px-7 pb-7 pt-6">
          <h2
            id="level-complete-title"
            className="text-2xl font-bold text-[#1C1D52]"
          >
            Hooray, you&apos;re done!
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Congratulations on completing the {progression.programName}{" "}
            {progression.levelName} level internship. Keep it up!
            {next
              ? ` Download your certificate for your job applications, or move up to ${next.name} level.`
              : " You've completed the highest level. Download your certificate for your job applications."}
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/internship/dashboard/certificate"
              onClick={close}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download certificate
            </Link>
            {next && (
              <Link
                href="/internship/dashboard/next-level"
                onClick={close}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:translate-y-[-1px]"
              >
                Move to {next.name} level
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {!next && (
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="h-4 w-4 text-[#5FBB46]" />
              Well done on reaching the top.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
