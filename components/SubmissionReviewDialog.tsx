"use client";

import { Bot, CheckCircle2, ChevronDown, ChevronRight, History, PencilLine, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SubmissionHistoryEntry } from "@/lib/submission-history";

// Reviewing one task submission, for mentors and admins alike: the work,
// its current grade (and who gave it), grading or changing the grade, and
// its full history (every version submitted and every grade given).

export type ReviewableSubmission = {
  id: string;
  internName: string;
  taskTitle: string;
  moduleTitle: string;
  content: string | null;
  fileUrl: string | null;
  submittedLabel: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";
  statusLabel: string;
  score: number | null;
  maxScore: number;
  feedback: string | null;
  /** Who gave the current grade ("the Practice Lab", a name, or unknown). */
  gradedBy: string | null;
  /** Whether this viewer may change a grade already given. */
  canChangeGrade: boolean;
};

export const isAwaitingReview = (row: { status: ReviewableSubmission["status"] }) =>
  row.status === "SUBMITTED" || row.status === "UNDER_REVIEW";

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const DECISION: Record<string, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Changes requested",
  UNDER_REVIEW: "Waiting for a mentor",
  SUBMITTED: "Submitted",
};
const ROLE: Record<string, string> = { INTERN: "intern", MENTOR: "mentor", ADMIN: "admin", SYSTEM: "automatic" };

export default function SubmissionReviewDialog({
  submission,
  apiBase,
  onClose,
  onSaved,
}: {
  submission: ReviewableSubmission;
  /** e.g. "/api/mentor/submissions": GET history and POST a grade at /{id}. */
  apiBase: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const pending = isAwaitingReview(submission);
  const [editing, setEditing] = useState(pending);
  const [score, setScore] = useState(submission.score === null ? "" : String(submission.score));
  const [feedback, setFeedback] = useState(pending && submission.status === "UNDER_REVIEW" ? "" : (submission.feedback ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<SubmissionHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${apiBase}/${submission.id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then((body: { history: SubmissionHistoryEntry[] }) => alive && setHistory(body.history))
      .catch(() => alive && setHistoryError(true));
    return () => {
      alive = false;
    };
  }, [apiBase, submission.id]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(decision: "ACCEPTED" | "REJECTED") {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/${submission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, score, feedback }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Unable to save the grade.");
      onSaved(result?.message ?? "Grade saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the grade.");
    } finally {
      setSaving(false);
    }
  }

  const versions = history?.filter((event) => event.kind === "SUBMITTED").length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1D52]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">{submission.internName}</p>
            <h2 id="review-dialog-title" className="mt-1 text-lg font-bold text-[#1C1D52]">
              {submission.taskTitle}
            </h2>
            <p className="mt-1 text-[10px] text-slate-500">
              {submission.moduleTitle} · Submitted {submission.submittedLabel}
              {versions > 1 && ` · version ${versions}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-[#f8fbff] p-4 text-xs leading-5 text-slate-700">
          {submission.content || "No written content was submitted."}
        </div>
        {submission.fileUrl && (
          <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[10px] font-bold text-blue-600">
            Open attached file
          </a>
        )}

        {!pending && (
          <div className="mt-5 space-y-2 rounded-xl border border-slate-200 p-4 text-xs text-slate-600">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p>
                <strong className="text-[#1C1D52]">Grade:</strong> {submission.statusLabel}
                {submission.score !== null && ` · ${submission.score}/${submission.maxScore}`}
                {submission.gradedBy && <span className="text-slate-400"> · by {submission.gradedBy}</span>}
              </p>
              {submission.canChangeGrade && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-[#1C1D52]"
                >
                  <PencilLine className="h-3.5 w-3.5" /> Change grade
                </button>
              )}
            </div>
            {submission.feedback && (
              <p className="whitespace-pre-wrap">
                <strong className="text-[#1C1D52]">Feedback:</strong> {submission.feedback}
              </p>
            )}
            {!submission.canChangeGrade && (
              <p className="text-[10px] text-slate-400">Only the person who gave this grade, or an admin, can change it.</p>
            )}
          </div>
        )}

        {editing && (
          <div className="mt-5">
            {!pending && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Changing the grade updates the intern&apos;s progress. The earlier grade stays in the history.
              </p>
            )}
            <label className="block text-[10px] font-semibold text-slate-500">
              Score (optional, out of {submission.maxScore})
              <input
                type="number"
                min={0}
                max={submission.maxScore}
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
              {!pending && (
                <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500">
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("REJECTED")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600 disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Request changes
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("ACCEPTED")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-bold text-[#14204f] disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Accept"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs font-bold text-[#1C1D52]"
            aria-expanded={showHistory}
          >
            {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <History className="h-4 w-4 text-[#5FBB46]" />
            Grading history{history ? ` (${history.length})` : ""}
          </button>
          {showHistory &&
            (historyError ? (
              <p className="mt-3 text-xs text-red-600">Unable to load the history.</p>
            ) : !history ? (
              <p className="mt-3 text-xs text-slate-500">Loading…</p>
            ) : history.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No history recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {[...history].reverse().map((event) => (
                  <HistoryItem key={event.id} event={event} maxScore={submission.maxScore} />
                ))}
              </ol>
            ))}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ event, maxScore }: { event: SubmissionHistoryEntry; maxScore: number }) {
  const [open, setOpen] = useState(false);
  const when = dateTime.format(new Date(event.at));
  const who = event.actorName ? `${event.actorName}${event.actorRole ? ` (${ROLE[event.actorRole]})` : ""}` : null;

  if (event.kind === "SUBMITTED")
    return (
      <li className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <p className="flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-slate-400" />
          <strong className="text-[#1C1D52]">Submitted</strong>
          {who && <span>by {who}</span>}
          <span className="text-slate-400">· {when}</span>
        </p>
        {(event.content || event.fileUrl) && (
          <button type="button" onClick={() => setOpen(!open)} className="mt-1 pl-5 text-[10px] font-bold text-blue-600">
            {open ? "Hide this version" : "Show this version"}
          </button>
        )}
        {open && (
          <div className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 pl-5 text-[11px] leading-5">
            {event.content || "No written content."}
            {event.fileUrl && /^https?:\/\//i.test(event.fileUrl) && (
              <a href={event.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block font-bold text-blue-600">
                Attached file
              </a>
            )}
          </div>
        )}
      </li>
    );

  const automatic = event.kind === "AUTO_GRADED" || event.kind === "SENT_FOR_REVIEW";
  const tone = event.status === "ACCEPTED" ? "bg-[#e8f7eb]" : event.status === "REJECTED" ? "bg-red-50" : "bg-amber-50";
  return (
    <li className={`rounded-lg px-3 py-2 text-[11px] text-slate-600 ${tone}`}>
      <p className="flex flex-wrap items-center gap-x-2">
        {automatic ? <Bot className="h-3.5 w-3.5 text-slate-400" /> : <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />}
        <strong className="text-[#1C1D52]">
          {event.kind === "SENT_FOR_REVIEW" ? "Sent to a mentor to confirm" : (DECISION[event.status ?? ""] ?? "Graded")}
        </strong>
        {event.score !== null && <span>· {event.score}/{maxScore}</span>}
        <span>
          {event.kind === "AUTO_GRADED"
            ? "· by the Practice Lab"
            : event.kind === "SENT_FOR_REVIEW"
              ? "· automatically"
              : who
                ? `· by ${who}`
                : "· grader not recorded"}
        </span>
        <span className="text-slate-400">· {when}</span>
      </p>
      {event.feedback && <p className="mt-1 whitespace-pre-wrap pl-5">{event.feedback}</p>}
    </li>
  );
}
