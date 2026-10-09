"use client";

import { CheckCircle2, Search, User, UsersRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell from "@/components/AdminShell";
import Pagination from "@/components/Pagination";
import CohortPicker, { rememberedCohort, type PickerCohort } from "@/components/admin/CohortPicker";
import SubmissionReviewDialog, { isAwaitingReview, type ReviewableSubmission } from "@/components/SubmissionReviewDialog";

// Every task submission, for admins: group and individual work, waiting or
// graded, by cohort and task. Admins can grade any of it, change any grade,
// and see each submission's full grading history.

type Row = ReviewableSubmission & {
  kind: "GROUP" | "INDIVIDUAL";
  submittedBy: string;
  participants: string[];
  cohortName: string | null;
  trackName: string | null;
  statusTone: "green" | "amber" | "red" | "blue";
};

type Payload = {
  cohorts: PickerCohort[];
  tasks: Array<{ id: string; title: string; kind: "GROUP" | "INDIVIDUAL" }>;
  counts: { pending: number; reviewed: number; all: number };
  total: number;
  page: number;
  pageSize: number;
  submissions: Row[];
};

type Status = "pending" | "reviewed" | "all";
const PICKER_KEY = "admin-submissions";
const ALL = "all";
const TONE: Record<Row["statusTone"], string> = {
  green: "bg-[#e8f7eb] text-[#397d3a]",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-700",
};

export default function AdminSubmissionsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cohort, setCohort] = useState<string>(ALL);
  const [task, setTask] = useState<string>(ALL);
  const [kind, setKind] = useState<"GROUP" | "INDIVIDUAL">("INDIVIDUAL");
  const [status, setStatus] = useState<Status>("pending");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [ready, setReady] = useState(false);
  const request = useRef(0);

  // Start from a link (?cohortId=&taskId=&kind=) or the last cohort shown.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setCohort(params.get("cohortId") ?? rememberedCohort(PICKER_KEY) ?? ALL);
      if (params.get("taskId")) setTask(params.get("taskId")!);
      if (params.get("kind") === "GROUP") setKind("GROUP");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Searching waits until typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++request.current;
    const params = new URLSearchParams({ kind, status, page: String(page) });
    if (cohort !== ALL) params.set("cohortId", cohort);
    if (task !== ALL) params.set("taskId", task);
    if (search) params.set("q", search);
    try {
      const response = await fetch(`/api/admin/internship/submissions?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to load submissions.");
      // Only the latest request counts (filters can change quickly).
      if (id === request.current) {
        setData(body as Payload);
        setError(null);
      }
    } catch (reason) {
      if (id === request.current) setError(reason instanceof Error ? reason.message : "Unable to load submissions.");
    }
  }, [cohort, task, kind, status, page, search]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [ready, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
    setNotice(null);
  };

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship tasks</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Submissions</h1>
            <p className="mt-2 max-w-2xl text-xs text-slate-500">
              Every group and individual submission. Grade work that&apos;s waiting, change any grade, and open a
              submission to see its full grading history.
            </p>
          </div>
          <div className="text-[#14204f]">
            <CohortPicker
              cohorts={data?.cohorts ?? []}
              value={cohort}
              storageKey={PICKER_KEY}
              extras={[{ id: ALL, label: "All cohorts" }]}
              disabled={!data}
              onChange={(id) => changeFilter(() => {
                setCohort(id);
                setTask(ALL);
              })}
            />
          </div>
        </header>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">{notice}</p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-[#f3f6fb] p-1" role="tablist" aria-label="Group or individual">
                {(["INDIVIDUAL", "GROUP"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={kind === value}
                    onClick={() => changeFilter(() => setKind(value))}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold ${kind === value ? "bg-white text-[#1C1D52] shadow-sm" : "text-slate-500"}`}
                  >
                    {value === "GROUP" ? <UsersRound className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    {value === "GROUP" ? "Group work" : "Individual work"}
                  </button>
                ))}
              </div>
              {cohort !== ALL && (
                <select
                  value={task}
                  onChange={(event) => changeFilter(() => setTask(event.target.value))}
                  className="h-9 max-w-[280px] rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-[#1C1D52] outline-none"
                  aria-label="Task"
                >
                  <option value={ALL}>All tasks</option>
                  {(data?.tasks ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} ({item.kind === "GROUP" ? "group" : "individual"})
                    </option>
                  ))}
                </select>
              )}
              <label className="relative min-w-[220px] flex-1">
                <span className="sr-only">Search submissions</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={kind === "GROUP" ? "Search group number, member or task" : "Search intern or task"}
                  className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#5FBB46]"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status">
              {(
                [
                  ["pending", "Waiting for review", data?.counts.pending],
                  ["reviewed", "Graded", data?.counts.reviewed],
                  ["all", "All", data?.counts.all],
                ] as Array<[Status, string, number | undefined]>
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={status === value}
                  onClick={() => changeFilter(() => setStatus(value))}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${status === value ? "bg-[#1C1D52] text-white" : "bg-[#f3f6fb] text-slate-600"}`}
                >
                  {label}
                  {count !== undefined && ` (${count})`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {!data ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">Loading submissions…</p>
            ) : data.submissions.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                {status === "pending" ? "Nothing is waiting for review here." : "No submissions match these filters."}
              </p>
            ) : (
              data.submissions.map((row) => (
                <article
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1C1D52]">{row.taskTitle}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      <strong className="text-slate-700">{row.internName}</strong>
                      {row.kind === "GROUP" && ` · submitted by ${row.submittedBy}`}
                      {row.cohortName && ` · ${row.trackName ? `${row.trackName}: ` : ""}${row.cohortName}`} · {row.submittedLabel}
                      {row.score !== null && ` · ${row.score}/${row.maxScore}`}
                      {row.gradedBy && !isAwaitingReview(row) && ` · graded by ${row.gradedBy}`}
                    </p>
                    {row.kind === "GROUP" && row.participants.length > 0 && (
                      <p className="mt-1 truncate text-[10px] text-slate-400">Credited: {row.participants.join(", ")}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TONE[row.statusTone]}`}>{row.statusLabel}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setReviewing(row);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isAwaitingReview(row) ? "Grade" : "View or change"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          {data && data.total > data.pageSize && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] text-slate-500">
                Showing {(data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.total)} of {data.total}
              </p>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          )}
        </section>
      </div>

      {reviewing && (
        <SubmissionReviewDialog
          submission={{
            ...reviewing,
            internName:
              reviewing.kind === "GROUP"
                ? `${reviewing.internName} · submitted by ${reviewing.submittedBy} · credited: ${reviewing.participants.join(", ")}`
                : reviewing.internName,
          }}
          apiBase="/api/admin/internship/submissions"
          onClose={() => setReviewing(null)}
          onSaved={(message) => {
            setReviewing(null);
            setNotice(message);
            void load();
          }}
        />
      )}
    </AdminShell>
  );
}
