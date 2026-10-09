"use client";

import { CheckCircle2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MentorBadge } from "@/components/MentorPage";
import SubmissionReviewDialog, { type ReviewableSubmission } from "@/components/SubmissionReviewDialog";

export type MentorSubmissionRow = ReviewableSubmission & {
  statusTone: "green" | "amber" | "red" | "blue";
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
    setNotice(null);
    setReviewing(row);
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
                {isPending(row) ? "Review work" : row.canChangeGrade ? "View or change" : "View"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {reviewing && (
        <SubmissionReviewDialog
          submission={reviewing}
          apiBase="/api/mentor/submissions"
          onClose={() => setReviewing(null)}
          onSaved={(message) => {
            setNotice(message);
            setReviewing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
