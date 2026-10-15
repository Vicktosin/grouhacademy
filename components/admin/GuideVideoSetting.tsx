"use client";

import { PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";

// The demo video at the top of an area's "How it works" guide for interns
// (components/onboarding/HowItWorksGuide). Empty: no video is shown.

export default function GuideVideoSetting({ guide, area }: { guide: "office-life" | "practice-lab"; area: string }) {
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/guide-videos", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((body: Record<string, string | null>) => setUrl(body[guide] ?? ""))
      .catch(() => setMessage({ ok: false, text: "Unable to load the video link." }))
      .finally(() => setLoaded(true));
  }, [guide]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/internship/guide-videos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guide, url }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setSaving(false);
    if (!response?.ok) return setMessage({ ok: false, text: body?.error ?? "Unable to save." });
    setUrl(body.url ?? "");
    setMessage({ ok: true, text: body.url ? "Saved. Interns see it at the top of the guide." : "Removed. The guide shows no video." });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
        <PlayCircle className="h-4 w-4 text-[#5FBB46]" /> {area} demo video
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Shown at the top of the &quot;How it works&quot; guide interns see in {area}. Paste a YouTube link or a Google Drive file link
        (shared as &quot;Anyone with the link&quot;). Leave it empty for no video.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          disabled={!loaded}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=… or https://drive.google.com/file/d/…"
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#5FBB46]"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!loaded || saving}
          className="h-10 rounded-lg bg-[#1C1D52] px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p className={`mt-2 text-xs font-semibold ${message.ok ? "text-[#397d3a]" : "text-red-600"}`}>{message.text}</p>}
    </section>
  );
}
