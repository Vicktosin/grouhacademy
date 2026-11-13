"use client";

import { CheckCircle2, ExternalLink, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import InternshipShell from "@/components/InternshipShell";
import {
  FALLBACK_BRANDING,
  useCertificateBranding,
} from "@/components/certificate/branding";
import { DRIVE_UPLOAD_INSTRUCTIONS } from "@/lib/testimonial-input";

// The intern's testimonial. Text only: the video goes to the cohort's
// Google Drive folder (button below); this form never uploads a file.

type FormData = {
  trackName: string;
  cohortName: string | null;
  driveFolderUrl: string | null;
  testimonial: {
    videoLink: string | null;
    testimonial: string;
    rating: number;
    consent: boolean;
    updatedAt: string;
  } | null;
};

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46]";

export default function InternTestimonialPage() {
  const academyName = (useCertificateBranding() ?? FALLBACK_BRANDING).academyName;
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [videoLink, setVideoLink] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    fetch("/api/internship/testimonial", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load the testimonial form.");
        return data as FormData;
      })
      .then((data) => {
        setForm(data);
        if (data.testimonial) {
          setVideoLink(data.testimonial.videoLink ?? "");
          setTestimonial(data.testimonial.testimonial);
          setRating(data.testimonial.rating);
          setConsent(data.testimonial.consent);
        }
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load the testimonial form."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === null) return setError("Choose a rating from 1 to 10.");
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/internship/testimonial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoLink: videoLink.trim() || null, testimonial, rating, consent }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save your testimonial.");
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your testimonial.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <InternshipShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">Testimonial</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Tell us about your internship{form ? ` on ${form.trackName}` : ""}. A short video is welcome but optional.
          </p>
        </div>

        {loading && <p className="text-xs text-slate-500">Loading…</p>}

        {form && (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
              <h2 className="text-sm font-bold text-[#1C1D52]">1. Your video (optional)</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{DRIVE_UPLOAD_INSTRUCTIONS}</p>
              {form.driveFolderUrl ? (
                <a
                  href={form.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white"
                >
                  Open the Google Drive folder <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  The video folder isn&apos;t open yet. You can still send your written testimonial.
                </p>
              )}
            </section>

            <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
              <h2 className="text-sm font-bold text-[#1C1D52]">2. Your testimonial</h2>

              <label className="block text-xs font-semibold text-[#1C1D52]">
                Link to your video (optional)
                <input
                  type="url"
                  inputMode="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  maxLength={2000}
                  className={fieldClass}
                />
              </label>

              <label className="block text-xs font-semibold text-[#1C1D52]">
                Your testimonial
                <textarea
                  required
                  rows={6}
                  maxLength={5000}
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  placeholder="What did you learn, build or enjoy? How has it helped you?"
                  className={`${fieldClass} resize-y`}
                />
              </label>

              <fieldset>
                <legend className="text-xs font-semibold text-[#1C1D52]">
                  How would you rate your internship? (1 = poor, 10 = excellent)
                </legend>
                <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                    <label
                      key={value}
                      className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#5FBB46] ${
                        rating === value
                          ? "border-[#5FBB46] bg-[#5FBB46] text-[#14204f]"
                          : "border-slate-200 bg-slate-50 text-[#1C1D52]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => setRating(value)}
                        className="sr-only"
                      />
                      {value}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2 text-xs text-[#1C1D52]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-[#5FBB46]"
                />
                <span>
                  {academyName} may share my video and words (optional)
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}
              {saved && (
                <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Thank you! Your testimonial was saved. You can edit it any time.
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-5 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60"
              >
                {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {form.testimonial ? "Update testimonial" : "Send testimonial"}
              </button>
            </form>
          </>
        )}

        {!loading && !form && error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </div>
    </InternshipShell>
  );
}
