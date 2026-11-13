"use client";

import { Megaphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Popup = { id: string; title: string; message: string };

/**
 * Pop-up announcements (admin "Show as pop-up"): each one targeted at the
 * intern is shown once, the next time they open the app, until they press
 * "Got it". Several are shown one after another, oldest first.
 */
export default function AnnouncementPopup({ enabled }: { enabled: boolean }) {
  const [queue, setQueue] = useState<Popup[]>([]);
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch("/api/internship/announcements/popups", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.popups)) setQueue(data.popups);
      })
      .catch(() => {
        // A pop-up is a nice-to-have; never block the workspace on it.
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (current) buttonRef.current?.focus();
  }, [current]);

  async function gotIt() {
    if (!current) return;
    setSaving(true);
    try {
      await fetch(`/api/internship/announcements/${current.id}/dismiss`, {
        method: "POST",
      });
    } catch {
      // If saving fails it shows again next time, which is the safe side.
    } finally {
      setSaving(false);
      setQueue((items) => items.slice(1));
    }
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#11132f]/70 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-popup-title"
        aria-describedby="announcement-popup-message"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#edf9f3] text-[#2f7d52]">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
          Announcement
        </p>
        <h2
          id="announcement-popup-title"
          className="mt-1 text-lg font-bold text-[#1C1D52]"
        >
          {current.title}
        </h2>
        <p
          id="announcement-popup-message"
          className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-line text-sm leading-6 text-slate-600"
        >
          {current.message}
        </p>
        <button
          ref={buttonRef}
          type="button"
          onClick={gotIt}
          disabled={saving}
          className="mt-6 w-full rounded-xl bg-[#5FBB46] px-4 py-3 text-sm font-bold text-[#14204f] disabled:opacity-70"
        >
          Got it
        </button>
        {queue.length > 1 && (
          <p className="mt-3 text-center text-[10px] text-slate-400">
            {queue.length - 1} more announcement{queue.length === 2 ? "" : "s"}
          </p>
        )}
      </div>
    </div>
  );
}
