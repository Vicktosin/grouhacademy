"use client";

import { GraduationCap } from "lucide-react";
import { openGraduation, useGraduation } from "./graduation-data";

/**
 * "My graduation flyer": the permanent way back to the graduation pop-up,
 * shown only to graduates (and an admin previewing).
 */
export default function GraduationFlyerButton({ className = "" }: { className?: string }) {
  const { data } = useGraduation();
  if (!data?.graduated) return null;
  return (
    <section
      className={`flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-[#0B7D54] to-[#12306B] p-5 text-white shadow-[0_8px_24px_rgba(28,29,82,0.18)] sm:flex-row sm:items-center ${className}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <GraduationCap className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Congratulations, graduate! 🎓</p>
        <p className="mt-0.5 text-xs text-white/80">
          {data.flyerUrl
            ? "Your graduation flyer is ready to download and share."
            : "Create your graduation flyer with your photo and share it with your friends."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openGraduation("flyer")}
        className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#12306B]"
      >
        My graduation flyer
      </button>
    </section>
  );
}
