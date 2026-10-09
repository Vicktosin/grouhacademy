"use client";

import { PencilLine, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import CohortPicker, { rememberedCohort } from "@/components/admin/CohortPicker";
import { formatWat, type TaskWindowState } from "@/lib/task-schedule";

type TaskRecord = {
  id: string;
  title: string;
  description: string;
  kind: "INDIVIDUAL" | "GROUP";
  cohortId: string;
  cohortName: string;
  programName: string;
  opensWeek: number;
  opensDay: number;
  opensTime: string;
  dueWeek: number;
  dueDay: number;
  dueTime: string;
  opensAt: string;
  dueDate: string;
  window: TaskWindowState;
  submissionCount: number;
  acceptedCount: number;
};
type CohortOption = { id: string; name: string; programName: string; startDate: string; endDate: string };

const windowStyles: Record<TaskWindowState, string> = {
  UPCOMING: "bg-sky-100 text-sky-700",
  OPEN: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-600",
};
const windowLabels: Record<TaskWindowState, string> = {
  UPCOMING: "Not open yet",
  OPEN: "Open",
  CLOSED: "Closed",
};

export default function InternshipTasksPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [cohortFilter, setCohortFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<"all" | "INDIVIDUAL" | "GROUP">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/tasks", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(payload?.error || "Task data is unavailable.");
        setCohorts(payload.cohorts ?? []);
        // The cohort chosen last time, if it's still there.
        const saved = rememberedCohort("admin-tasks");
        if (saved && (saved === "all" || (payload.cohorts ?? []).some((c: CohortOption) => c.id === saved)))
          setCohortFilter(saved);
        setTasks(payload.tasks ?? []);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Task data is unavailable.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const visibleTasks = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tasks.filter(
      (task) =>
        (cohortFilter === "all" || task.cohortId === cohortFilter) &&
        (kindFilter === "all" || task.kind === kindFilter) &&
        (!term ||
          `${task.title} ${task.cohortName} ${task.programName}`
            .toLowerCase()
            .includes(term)),
    );
  }, [cohortFilter, kindFilter, query, tasks]);

  async function handleDelete(task: TaskRecord) {
    const warning = task.submissionCount
      ? ` ${task.submissionCount} submission${task.submissionCount === 1 ? "" : "s"} will also be deleted.`
      : "";
    if (
      !window.confirm(
        `Delete “${task.title}”?${warning} This cannot be undone.`,
      )
    )
      return;
    setError(null);
    try {
      const response = await fetch("/api/admin/internship/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Unable to delete this task.");
      }
      setTasks((current) => current.filter((entry) => entry.id !== task.id));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to delete this task.",
      );
    }
  }

  const counts = {
    total: tasks.length,
    open: tasks.filter((task) => task.window === "OPEN").length,
    group: tasks.filter((task) => task.kind === "GROUP").length,
  };

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
              Internship tasks
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Tasks by cohort
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Each task belongs to one cohort and has a submission window set by
              week, day and time from the cohort&apos;s start date.
            </p>
          </div>
          <Link
            href="/admin/internship/tasks/new"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f]"
          >
            <Plus className="h-4 w-4" />
            Add task
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Total tasks", counts.total],
            ["Open now", counts.open],
            ["Group tasks", counts.group],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]"
            >
              <p className="text-[10px] font-semibold text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold text-[#1C1D52]">{value}</p>
            </div>
          ))}
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
          >
            {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search tasks</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search task or cohort"
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#5FBB46]"
              />
            </label>
            <div>
              <CohortPicker
                hideLabel
                cohorts={cohorts}
                value={cohortFilter}
                onChange={setCohortFilter}
                storageKey="admin-tasks"
                extras={[{ id: "all", label: "All cohorts" }]}
              />
            </div>
            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(event.target.value as typeof kindFilter)
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-[#1C1D52] outline-none"
            >
              <option value="all">All task types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="GROUP">Group</option>
            </select>
          </div>

          {loading ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Loading internship tasks…
            </p>
          ) : visibleTasks.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              {tasks.length === 0
                ? "No tasks yet. Add the first task for a cohort."
                : "No tasks match these filters."}
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {visibleTasks.map((task) => (
                <article
                  key={task.id}
                  className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-[#1C1D52]">
                        {task.title}
                      </h2>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${task.kind === "GROUP" ? "bg-emerald-100 text-emerald-700" : "bg-[#edf4ff] text-[#3557a5]"}`}
                      >
                        {task.kind === "GROUP" ? "Group" : "Individual"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${windowStyles[task.window]}`}
                      >
                        {windowLabels[task.window]}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {task.cohortName} · {task.programName}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Opens W{task.opensWeek} D{task.opensDay} {task.opensTime}{" "}
                      ({formatWat(new Date(task.opensAt))}) → Due W
                      {task.dueWeek} D{task.dueDay} {task.dueTime} (
                      {formatWat(new Date(task.dueDate))}) WAT
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {task.submissionCount} submission
                      {task.submissionCount === 1 ? "" : "s"} ·{" "}
                      {task.acceptedCount} passed
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/admin/internship/tasks/new?edit=${task.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-[#1C1D52]"
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(task)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-[10px] font-semibold text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
