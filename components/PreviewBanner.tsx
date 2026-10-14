"use client";

import { Eye, LoaderCircle, LogOut, RotateCcw, Shuffle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearCachedJson, loadShell, peekShell } from "@/lib/client-cache";
import type { ShellData } from "@/app/api/internship/shell/route";

// Shown across the internship's pages while an admin experiences them as
// their preview intern (lib/preview-intern): where they're placed, and
// switching, resetting or leaving.

/** Whether this is an admin previewing the internship (see lib/preview-intern). */
export function useIsPreview() {
  const [preview, setPreview] = useState(() => Boolean(peekShell()?.preview));
  useEffect(() => {
    let cancelled = false;
    void loadShell().then((shell) => {
      if (!cancelled) setPreview(Boolean(shell?.preview));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return preview;
}

export default function PreviewBanner() {
  const [preview, setPreview] = useState<ShellData["preview"]>(() => peekShell()?.preview ?? null);
  const [busy, setBusy] = useState<"reset" | "exit" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadShell().then((shell) => {
      if (!cancelled) setPreview(shell?.preview ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!preview) return null;

  async function act(kind: "reset" | "exit") {
    if (kind === "reset" && !window.confirm("Clear everything the preview intern has done (submissions, Practice Lab work, progress)?")) return;
    setBusy(kind);
    await fetch("/api/admin/internship/preview", {
      method: kind === "exit" ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: kind === "reset" ? JSON.stringify({ action: "reset" }) : undefined,
    }).catch(() => null);
    // Everything cached so far was the preview intern's.
    clearCachedJson();
    window.location.href = kind === "exit" ? "/admin/internship/preview" : window.location.pathname;
  }

  const where = [preview.track, preview.level, preview.cohort ?? "no cohort"].join(" · ");
  const button =
    "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/25 disabled:opacity-50";

  return (
    <div className="z-40 flex shrink-0 flex-wrap items-center gap-2 bg-[#B45309] px-3 py-2 text-white sm:px-6 lg:px-8" role="status">
      <Eye className="h-4 w-4 shrink-0" />
      {/* Phones: just the label, so the bar stays one short row. */}
      <p className="flex-1 text-[11px] font-bold sm:hidden">Preview</p>
      <p className="hidden min-w-0 flex-1 text-[11px] leading-4 sm:block sm:text-xs">
        <strong>Preview:</strong> you&apos;re seeing the internship as an intern in <strong>{where}</strong>. What you do
        here is hidden from everyone else.
      </p>
      <Link href="/admin/internship/preview" className={button}>
        <Shuffle className="h-3.5 w-3.5" /> Switch
      </Link>
      <button type="button" disabled={busy !== null} onClick={() => void act("reset")} className={button}>
        {busy === "reset" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reset
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void act("exit")} className={button}>
        {busy === "exit" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Exit<span className="hidden sm:inline"> preview</span>
      </button>
    </div>
  );
}
