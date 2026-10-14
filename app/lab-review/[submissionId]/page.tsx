"use client";

import { ArrowLeft, ExternalLink, Loader2, Monitor, Smartphone } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LabCheck, LabFiles } from "@/lib/lab-shared";
import type { WpConfig } from "@/lib/wp-sim/model";

// A Practice Lab task submission as the intern built it, for mentors and
// admins (and the intern): screenshots and a live preview of their web or
// React site, or their WordPress site restored to browse.

const LabWorkspace = dynamic(() => import("@/components/LabWorkspace"), { ssr: false });
const WordPressSnapshotViewer = dynamic(() => import("@/components/WordPressSnapshotViewer"), { ssr: false });

type Review = {
  intern: string;
  task: string;
  exercise: string;
  kind: string;
  status: string;
  score: number | null;
  maxScore: number;
  submittedAt: string | null;
  screenshots: Array<{ label: "Desktop" | "Phone"; width: number; height: number; url: string }>;
  files: LabFiles | null;
  checks: LabCheck[];
  snapshot: { url: string; bytes: number; config: WpConfig } | null;
};

const STATUS: Record<string, string> = {
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
};

const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function LabReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [shot, setShot] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lab-review/${submissionId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This submission couldn't be loaded.");
        if (!cancelled) setReview(data as Review);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "This submission couldn't be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const current = review?.screenshots[shot];

  return (
    <main className="min-h-dvh bg-[#edf3ff] px-4 py-6 text-[#1C1D52] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!review && !error && (
          <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading their work…</p>
        )}

        {review && (
          <>
            <header className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Practice Lab submission</p>
              <h1 className="mt-1 text-2xl font-semibold">{review.intern}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {review.task} · {review.exercise}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-bold ${STATUS[review.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {review.status.replace("_", " ").toLowerCase()}
                </span>
                {review.score !== null && <span className="font-semibold">Score {review.score}/{review.maxScore}</span>}
                {review.submittedAt && <span className="text-slate-500">Submitted {new Date(review.submittedAt).toLocaleString()}</span>}
              </div>
            </header>

            {review.screenshots.length > 0 && current && (
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">Screenshots</h2>
                  <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                    {review.screenshots.map((item, index) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setShot(index)}
                        aria-pressed={shot === index}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${shot === index ? "bg-white shadow-sm" : "text-slate-500"}`}
                      >
                        {item.label === "Phone" ? <Smartphone className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />} {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 max-h-[75vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed storage link */}
                  <img
                    src={current.url}
                    alt={`${review.intern}'s site at ${current.label.toLowerCase()} width`}
                    width={current.width}
                    height={current.height}
                    className={`mx-auto h-auto rounded-lg shadow ${current.label === "Phone" ? "w-full max-w-[390px]" : "w-full"}`}
                  />
                </div>
                <a href={current.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2c59c7]">
                  Open full size <ExternalLink className="h-3 w-3" />
                </a>
              </section>
            )}

            {review.files && (
              <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
                <div>
                  <h2 className="font-bold">Live preview and code</h2>
                  <p className="mt-1 text-xs text-slate-500">Their code exactly as submitted. Click around the preview, or run the exercise&apos;s checks yourself.</p>
                </div>
                <LabWorkspace kind={review.kind === "REACT" ? "REACT" : "WEB"} files={review.files} checks={review.checks} readOnly />
              </section>
            )}

            {review.snapshot && (
              <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
                <div>
                  <h2 className="font-bold">Their WordPress site</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Restored from their submission ({size(review.snapshot.bytes)}), signed in as admin. Browse it or open the dashboard; nothing you change here is saved.
                  </p>
                </div>
                <WordPressSnapshotViewer config={review.snapshot.config} url={review.snapshot.url} />
              </section>
            )}

            {!review.screenshots.length && !review.files && !review.snapshot && (
              <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
                There&apos;s no screenshot or site snapshot for this submission. It was sent before this was added, or the upload didn&apos;t go through.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
