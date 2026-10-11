"use client";

import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import {
  cohortTimeline,
  formatWat,
  scheduleDayLabel,
  scheduleToDate,
} from "@/lib/task-schedule";

type CohortOption = {
  id: string;
  name: string;
  programId: string;
  programName: string;
  startDate: string;
  endDate: string;
};
type TaskRecord = {
  id: string;
  title: string;
  description: string;
  kind: "INDIVIDUAL" | "GROUP";
  cohortId: string;
  opensWeek: number;
  opensDay: number;
  opensTime: string;
  dueWeek: number;
  dueDay: number;
  dueTime: string;
  labScenarioId: string | null;
  labPassMark: number;
  officeLifeDay: number | null;
  destination: TaskDestination;
  submissionCount: number;
};
type LabOption = {
  id: string;
  title: string;
  programId: string;
  level: string;
  published: boolean;
};
type TaskDestination = "none" | "lab" | "work-life";
type Draft = Omit<TaskRecord, "id" | "submissionCount">;

const emptyDraft: Draft = {
  title: "",
  description: "",
  kind: "INDIVIDUAL",
  cohortId: "",
  opensWeek: 1,
  opensDay: 1,
  opensTime: "09:00",
  dueWeek: 1,
  dueDay: 7,
  dueTime: "23:59",
  labScenarioId: null,
  labPassMark: 70,
  officeLifeDay: null,
  destination: "none" as TaskDestination,
};

const inputClass =
  "mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46]";

export default function InternshipTaskFormPage() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [labScenarios, setLabScenarios] = useState<LabOption[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/tasks", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(payload?.error || "Task setup is unavailable.");
        const nextCohorts: CohortOption[] = payload.cohorts ?? [];
        setCohorts(nextCohorts);
        setLabScenarios(payload.labScenarios ?? []);
        const task = editId
          ? (payload.tasks as TaskRecord[]).find((entry) => entry.id === editId)
          : null;
        if (editId && !task) throw new Error("This task no longer exists.");
        if (task) {
          setDraft({
            title: task.title,
            description: task.description,
            kind: task.kind,
            cohortId: task.cohortId,
            opensWeek: task.opensWeek,
            opensDay: task.opensDay,
            opensTime: task.opensTime,
            dueWeek: task.dueWeek,
            dueDay: task.dueDay,
            dueTime: task.dueTime,
            labScenarioId: task.labScenarioId,
            labPassMark: task.labPassMark,
            officeLifeDay: task.officeLifeDay,
            destination: task.labScenarioId ? "lab" : task.officeLifeDay ? "work-life" : "none",
          });
          setSubmissionCount(task.submissionCount);
        } else {
          setDraft((current) => ({
            ...current,
            cohortId: current.cohortId || nextCohorts[0]?.id || "",
          }));
        }
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Task setup is unavailable.",
        ),
      )
      .finally(() => setLoading(false));
  }, [editId]);

  const cohort = cohorts.find((entry) => entry.id === draft.cohortId) ?? null;
  const cohortStart = cohort ? new Date(cohort.startDate) : null;
  const timeline = cohort
    ? cohortTimeline(new Date(cohort.startDate), new Date(cohort.endDate))
    : null;
  const weekOptions = Array.from(
    {
      length: Math.max(
        timeline?.totalWeeks ?? 4,
        draft.opensWeek,
        draft.dueWeek,
      ),
    },
    (_, index) => index + 1,
  );

  const opensAt = cohortStart
    ? scheduleToDate(cohortStart, {
        week: draft.opensWeek,
        day: draft.opensDay,
        time: draft.opensTime,
      })
    : null;
  const dueAt = cohortStart
    ? scheduleToDate(cohortStart, {
        week: draft.dueWeek,
        day: draft.dueDay,
        time: draft.dueTime,
      })
    : null;
  const windowInvalid = opensAt && dueAt ? dueAt <= opensAt : false;
  const dueAfterCohort =
    dueAt && timeline ? dueAt.getTime() > timeline.endsAt.getTime() : false;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (windowInvalid) {
      setError("The due time must be after the opening time.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/internship/tasks", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, id: editId ?? undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(payload?.error || "Unable to save the task.");
      if (editId) {
        router.push("/admin/internship/tasks");
        return;
      }
      setSuccess(`“${draft.title}” was created. You can add another task.`);
      setDraft((current) => ({ ...emptyDraft, cohortId: current.cohortId }));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save the task.",
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = submissionCount > 0;

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[900px] space-y-5">
        <Link
          href="/admin/internship/tasks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tasks
        </Link>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] bg-white p-5 shadow-[0_10px_30px_rgba(28,29,82,0.08)] sm:p-6"
        >
          <div className="border-b border-slate-200 pb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
              {editId ? "Edit task" : "New task"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#1C1D52]">
              {editId ? "Update internship task" : "Create internship task"}
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Week 1, Day 1 is the cohort&apos;s start date. All times are West
              Africa Time (WAT). Interns can only submit between the opening and
              due times, and tasks may overlap.
            </p>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700"
            >
              {success}
            </p>
          )}

          {loading ? (
            <p className="mt-6 text-xs text-slate-500">Loading…</p>
          ) : cohorts.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Create a cohort first. Tasks belong to a cohort.{" "}
              <Link
                href="/admin/internship/cohorts"
                className="font-semibold text-blue-600"
              >
                Go to cohorts
              </Link>
            </p>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                Task name
                <input
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                  className={inputClass}
                  placeholder="e.g. Build a 7-day content calendar"
                />
              </label>

              <label className="block text-[10px] font-semibold text-slate-500">
                Cohort
                <select
                  required
                  value={draft.cohortId}
                  disabled={locked}
                  onChange={(event) =>
                    setDraft({ ...draft, cohortId: event.target.value })
                  }
                  className={`${inputClass} disabled:opacity-60`}
                >
                  {cohorts.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.programName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-[10px] font-semibold text-slate-500">
                Task type
                <select
                  value={draft.kind}
                  disabled={locked}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      kind: event.target.value as Draft["kind"],
                    })
                  }
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="INDIVIDUAL">
                    Individual (each intern submits)
                  </option>
                  <option value="GROUP">
                    Group (group leader submits for the group)
                  </option>
                </select>
              </label>
              <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                Task destination
                <select
                  value={draft.destination}
                  disabled={locked}
                  onChange={(event) => setDraft({
                    ...draft,
                    destination: event.target.value as TaskDestination,
                    labScenarioId: event.target.value === "lab" ? draft.labScenarioId : null,
                    officeLifeDay: event.target.value === "work-life" ? (draft.officeLifeDay ?? 1) : null,
                  })}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="none">Standard task submission</option>
                  <option value="lab">Practice Lab</option>
                  <option value="work-life" disabled={draft.kind === "GROUP"}>Work-Life Experience</option>
                </select>
                <span className="mt-1 block font-normal text-slate-400">
                  Choose where interns will complete this task. The selection appears prominently on their task card.
                </span>
              </label>
              {draft.destination === "work-life" && (
                <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                  Work-Life week
                  <select
                    value={draft.officeLifeDay ?? 1}
                    disabled={locked}
                    onChange={(event) => setDraft({ ...draft, officeLifeDay: Number(event.target.value) })}
                    className={`${inputClass} disabled:opacity-60`}
                  >
                    {[1, 2, 3, 4].map((week) => <option key={week} value={week}>Week {week}</option>)}
                  </select>
                  <span className="mt-1 block font-normal text-slate-400">The intern opens this Work-Life week from their task card; its activities and schedule come from the track and level plan.</span>
                </label>
              )}
              {draft.destination === "lab" && (
                <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                  Practice Lab exercise (optional)
                <select
                  value={draft.labScenarioId ?? ""}
                  disabled={locked}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      labScenarioId: event.target.value || null,
                      officeLifeDay: null,
                    })
                  }
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="">None, interns submit text as usual</option>
                  {labScenarios
                    .filter((lab) => lab.programId === cohort?.programId)
                    .map((lab) => (
                      <option key={lab.id} value={lab.id}>
                        {lab.title} · {lab.level}
                        {lab.published ? "" : " (draft)"}
                      </option>
                    ))}
                </select>
                <span className="mt-1 block font-normal text-slate-400">
                  Interns do the exercise in the Practice Lab. Submitting it
                  grades this task: passed if they reach the pass mark, failed
                  if not (they can improve and resubmit until it&apos;s due).
                  Mentors can still change the grade.
                </span>
                </label>
              )}
              {draft.labScenarioId && (
                <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                  Pass mark (%)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    required
                    value={Number.isNaN(draft.labPassMark) ? "" : draft.labPassMark}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        labPassMark: event.target.valueAsNumber,
                      })
                    }
                    className={`${inputClass} max-w-[140px]`}
                  />
                  <span className="mt-1 block font-normal text-slate-400">
                    Coding exercises: the share of checks passed. Ad and social
                    simulators: the run&apos;s score out of 100. A new pass mark
                    applies to submissions from now on.
                  </span>
                </label>
              )}
              {locked && (
                <p className="text-[10px] text-amber-700 md:col-span-2">
                  Interns have already submitted this task, so its cohort and
                  type can&apos;t be changed.
                </p>
              )}

              {cohortStart && (
                <>
                  <SchedulePicker
                    legend="Opens"
                    week={draft.opensWeek}
                    day={draft.opensDay}
                    time={draft.opensTime}
                    weekOptions={weekOptions}
                    cohortStart={cohortStart}
                    onChange={(week, day, time) =>
                      setDraft({
                        ...draft,
                        opensWeek: week,
                        opensDay: day,
                        opensTime: time,
                      })
                    }
                  />
                  <SchedulePicker
                    legend="Due"
                    week={draft.dueWeek}
                    day={draft.dueDay}
                    time={draft.dueTime}
                    weekOptions={weekOptions}
                    cohortStart={cohortStart}
                    onChange={(week, day, time) =>
                      setDraft({
                        ...draft,
                        dueWeek: week,
                        dueDay: day,
                        dueTime: time,
                      })
                    }
                  />
                </>
              )}

              {opensAt && dueAt && (
                <div
                  className={`flex items-start gap-3 rounded-xl p-4 text-xs md:col-span-2 ${windowInvalid ? "bg-red-50 text-red-700" : "bg-[#f0faed] text-[#1C1D52]"}`}
                >
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Submission window: {formatWat(opensAt)} →{" "}
                      {formatWat(dueAt)} (WAT)
                    </p>
                    {windowInvalid && (
                      <p className="mt-1">
                        The due time must be after the opening time.
                      </p>
                    )}
                    {!windowInvalid && dueAfterCohort && (
                      <p className="mt-1 text-amber-700">
                        This is due after the cohort ends.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <label className="block text-[10px] font-semibold text-slate-500 md:col-span-2">
                Task brief / instructions
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  rows={7}
                  maxLength={10000}
                  className={`${inputClass} min-h-[150px]`}
                  placeholder="Explain what interns should do, what to submit, and what success looks like."
                />
              </label>

              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  disabled={saving || windowInvalid}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-5 py-3 text-xs font-bold text-[#14204f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : editId ? "Save changes" : "Create task"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </AdminShell>
  );
}

function SchedulePicker({
  legend,
  week,
  day,
  time,
  weekOptions,
  cohortStart,
  onChange,
}: {
  legend: string;
  week: number;
  day: number;
  time: string;
  weekOptions: number[];
  cohortStart: Date;
  onChange: (week: number, day: number, time: string) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-4">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1C1D52]">
        {legend}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-[10px] font-semibold text-slate-500">
          Week
          <select
            value={week}
            onChange={(event) =>
              onChange(Number(event.target.value), day, time)
            }
            className={inputClass}
          >
            {weekOptions.map((option) => (
              <option key={option} value={option}>
                Week {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold text-slate-500">
          Time (WAT)
          <input
            type="time"
            required
            value={time}
            onChange={(event) => onChange(week, day, event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="col-span-2 block text-[10px] font-semibold text-slate-500">
          Day
          <select
            value={day}
            onChange={(event) =>
              onChange(week, Number(event.target.value), time)
            }
            className={inputClass}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((option) => (
              <option key={option} value={option}>
                Day {option} · {scheduleDayLabel(cohortStart, week, option)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
