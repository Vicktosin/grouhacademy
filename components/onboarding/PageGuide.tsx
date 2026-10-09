"use client";

import { HelpCircle, Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";
import { GUIDE, type GuideSection } from "@/lib/intern-guide";
import { getFlag, setFlag } from "@/lib/intern-onboarding";

// "How this page works": open the first time an intern visits a page, then
// folded into a small button they can open again. Visiting also ticks the
// page on the dashboard's getting-started list.

export default function PageGuide({ section }: { section: GuideSection }) {
  const entry = GUIDE[section];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFlag(`visited:${section}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit check reads browser storage
    setOpen(!getFlag(`guide:${section}`));
  }, [section]);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-[0_4px_12px_rgba(28,29,82,0.06)] hover:text-[#1C1D52]"
      >
        <HelpCircle className="h-3.5 w-3.5" /> How this page works
      </button>
    );

  return (
    <section className="rounded-2xl border border-[#cfe9c6] bg-[#f4faf2] p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
        <Lightbulb className="h-4 w-4 text-[#5FBB46]" /> How this page works
      </h2>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
        {entry.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          setFlag(`guide:${section}`);
          setOpen(false);
        }}
        className="mt-3 rounded-lg bg-[#1C1D52] px-3.5 py-2 text-xs font-bold text-white"
      >
        Got it
      </button>
    </section>
  );
}
