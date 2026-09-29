"use client";

import { CheckCircle2, RotateCcw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MentorBadge } from "@/components/MentorPage";

export type MentorSubmissionRow = {
  id: string;
  internName: string;
  taskTitle: string;
  moduleTitle: string;
  content: string | null;
  fileUrl: string | null;
  submittedLabel: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  statusLabel: string;
  statusTone: "green" | "amber" | "red" | "blue";
  score: number | null;
  maxScore: number;
  feedback: string | null;
};

const FILTERS = [
  { key: "pending", label: "Awaiting review" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
] as const;

const isPending = (row: MentorSubmissionRow) =>
  row.status === "SUBMITTED" || row.status === "UNDER_REVIEW";

export default function MentorSubmissionsList({
  submissions,
}: {
  submissions: MentorSubmissionRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]["key"]>("pending");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<MentorSubmissionRow | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return submissions.filter(
      (row) =>
        (filter === "all" ||
          (filter === "pending" ? isPending(row) : !isPending(row))) &&
        (!needle ||
          `${row.internName} ${row.taskTitle} ${row.moduleTitle}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [submissions, filter, query]);

  function openReview(row: MentorSubmissionRow) {
    setReviewing(row);
    setScore(row.score === null ? "" : String(row.score));
    setFeedback(row.feedback ?? "");
    setError(null);
  }

  async function submitReview(decision: "ACCEPTED" | "REJECTED") {
    if (!reviewing) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/mentor/submissions/${reviewing.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, score, feedback }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(result?.error || "Unable to save your review.");
      setNotice(result?.message ?? "Review saved.");
      setReviewing(null);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save your review.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter submissions">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-3 py-2 text-[10px] font-bold ${filter === item.key ? "bg-[#1C1D52] text-white" : "bg-[#f3f6fb] text-slate-600"}`}
            >
              {item.label}
              {item.key === "pending" &&
                ` (${submissions.filter(isPending).length})`}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-full bg-[#f3f6fb] px-3 py-2 text-[10px] text-slate-400">
          <Search className="h-3.5 w-3.5" />
          <span className="sr-only">Search submissions</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search submissions"
            className="bg-transparent outline-none"
          />
        </label>
      </div>

      {notice && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {visible.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            {submissions.length === 0
              ? "Your interns haven't submitted any work yet."
              : "No submissions match this view."}
          </p>
        )}
        {visible.map((row) => (
          <article
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1C1D52]">{row.taskTitle}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                {row.internName} · {row.moduleTitle} · Submitted{" "}
                {row.submittedLabel}
                {row.score !== null && ` · Score ${row.score}/${row.maxScore}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <MentorBadge tone={row.statusTone}>{row.statusLabel}</MentorBadge>
              <button
                type="button"
                onClick={() => openReview(row)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isPending(row) ? "Review work" : "View"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1D52]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-dialog-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                  {reviewing.internName}
                </p>
                <h2
                  id="review-dialog-title"
                  className="mt-1 text-lg font-bold text-[#1C1D52]"
                >
                  {reviewing.taskTitle}
                </h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  {reviewing.moduleTitle} · Submitted {reviewing.submittedLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewing(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 whitespace-pre-wrap rounded-xl bg-[#f8fbff] p-4 text-xs leading-5 text-slate-700">
              {reviewing.content || "No written content was submitted."}
            </div>
            {reviewing.fileUrl && (
              <a
                href={reviewing.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[10px] font-bold text-blue-600"
              >
                Open attached file
              </a>
            )}

            {isPending(reviewing) ? (
              <>
                <label className="mt-5 block text-[10px] font-semibold text-slate-500">
                  Score (optional, out of {reviewing.maxScore})
                  <input
                    type="number"
                    min={0}
                    max={reviewing.maxScore}
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    className="mt-1 block w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#1C1D52] outline-none"
                  />
                </label>
                <label className="mt-4 block text-[10px] font-semibold text-slate-500">
                  Feedback (required when requesting changes)
                  <textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    rows={4}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#1C1D52] outline-none"
                  />
                </label>
                {error && (
                  <p className="mt-3 text-xs font-semibold text-red-600" role="alert">
                    {error}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void submitReview("REJECTED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void submitReview("ACCEPTED")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-bold text-[#14204f] disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saving ? "Saving…" : "Accept"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 space-y-2 text-xs text-slate-600">
                <p>
                  <strong className="text-[#1C1D52]">Outcome:</strong>{" "}
                  {reviewing.statusLabel}
                  {reviewing.score !== null &&
                    ` · ${reviewing.score}/${reviewing.maxScore}`}
                </p>
                {reviewing.feedback && (
                  <p className="whitespace-pre-wrap">
                    <strong className="text-[#1C1D52]">Feedback:</strong>{" "}
                    {reviewing.feedback}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
