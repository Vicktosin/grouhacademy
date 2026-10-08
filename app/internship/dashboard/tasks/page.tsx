"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarClock,
  ChevronDown,
  Lock,
  Send,
  Users,
  UserRound,
} from "lucide-react";
import InternshipShell from "@/components/InternshipShell";
import { bringIntoView } from "@/lib/bring-into-view";
import type {
  InternshipTaskItem,
  InternshipTaskListResponse,
} from "@/lib/internship-data";

const statusStyles = {
  yellow: "bg-yellow-100 text-yellow-700",
  slate: "bg-slate-100 text-slate-500",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-600",
};

const alertToneStyles = {
  orange: "bg-orange-100 text-orange-900",
  green: "bg-slate-100 text-[#1C1D52]",
  red: "bg-red-100 text-red-900",
  slate: "bg-slate-100 text-slate-600",
};

const alertDotStyles = {
  orange: "bg-orange-500",
  green: "bg-[#22c56e]",
  red: "bg-red-500",
  slate: "bg-slate-400",
};

export default function TasksPage() {
  const [data, setData] = useState<InternshipTaskListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"All" | "INDIVIDUAL" | "GROUP">(
    "All",
  );
  const taskListRef = useRef<HTMLElement>(null);

  // "View Tasks" filters the list below; on phones, scroll down to it.
  const showTasks = (filter: "INDIVIDUAL" | "GROUP") => {
    setTaskFilter(filter);
    bringIntoView(taskListRef.current);
  };

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/internship/tasks", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unable to load your tasks.");
    setData((await response.json()) as InternshipTaskListResponse);
  }, []);

  useEffect(() => {
    fetch("/api/internship/tasks", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load your tasks.");
        return response.json() as Promise<InternshipTaskListResponse>;
      })
      .then(setData)
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load your tasks.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const allTasks = data?.tasks ?? [];
  const visibleTasks =
    taskFilter === "All"
      ? allTasks
      : allTasks.filter((task) => task.kind === taskFilter);
  const weeks = [...new Set(visibleTasks.map((task) => task.weekNumber))].sort(
    (a, b) => a - b,
  );

  return (
    <InternshipShell>
      <div className="space-y-5">
        <section className="rounded-2xl bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_28px_rgba(95,187,70,0.18)] sm:px-8 sm:py-7">
          <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
          <p className="mt-2 text-xs text-[#14204f]/75">
            Submit each task between its opening and due time (WAT). Group tasks
            are submitted once by your group leader.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="h-40 animate-pulse rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]" />
        )}

        {!error && !loading && data && !data.hasProgram && (
          <EmptyState
            title="No active internship application"
            text="Enroll in an internship program to start seeing tasks here."
          />
        )}

        {!error && !loading && data?.hasProgram && !data.hasCohort && (
          <EmptyState
            title="You haven't been placed in a cohort yet"
            text="Your tasks will appear here once the academy team adds you to a cohort."
          />
        )}

        {!error && !loading && data?.hasProgram && data.hasCohort && (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(250px,0.72fr)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard
                  icon={<UserRound className="h-4 w-4" />}
                  iconClass="bg-slate-100 text-[#1C1D52]"
                  badgeClass="bg-[#1C1D52]"
                  count={data.stats.activeIndividual}
                  title="Individual Tasks"
                  text="You submit these yourself"
                  linkClass="text-[#1C1D52]"
                  onView={() => showTasks("INDIVIDUAL")}
                />
                <SummaryCard
                  icon={<Users className="h-4 w-4" />}
                  iconClass="bg-[#e8f7eb] text-[#5FBB46]"
                  badgeClass="bg-[#5FBB46]"
                  count={data.stats.activeGroup}
                  title="Group Tasks"
                  text="Your group leader submits these"
                  linkClass="text-[#5FBB46]"
                  onView={() => showTasks("GROUP")}
                />
                <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                  {(
                    [
                      ["To submit", data.stats.pending, "bg-orange-500"],
                      ["Submitted", data.stats.submitted, "bg-[#22c56e]"],
                      ["Missed", data.stats.overdue, "bg-red-500"],
                    ] as const
                  ).map(([label, value, dot]) => (
                    <div
                      key={label}
                      className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)]"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{label}</span>
                        <span className={`h-2 w-2 rounded-full ${dot}`} />
                      </div>
                      <strong className="mt-3 block text-2xl text-[#1C1D52]">
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
                  <Bell className="h-4 w-4" />
                  Recent Alerts
                </h2>
                <div className="mt-4 space-y-2">
                  {data.alerts.length > 0 ? (
                    data.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex gap-2 rounded-xl p-3 text-[10px] leading-4 ${alertToneStyles[alert.tone]}`}
                      >
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${alertDotStyles[alert.tone]}`}
                        />
                        <span>
                          {alert.text}
                          <span className="mt-0.5 block text-[9px] text-slate-400">
                            {alert.postedLabel}
                          </span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] italic text-slate-400">
                      No alerts yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <section
              ref={taskListRef}
              className="scroll-mt-4 overflow-hidden rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-[#1C1D52]">
                  {taskFilter === "INDIVIDUAL"
                    ? "Individual tasks"
                    : taskFilter === "GROUP"
                      ? "Group tasks"
                      : "All tasks"}
                </h2>
                <label className="self-start">
                  <span className="sr-only">Filter tasks</span>
                  <select
                    value={taskFilter}
                    onChange={(event) =>
                      setTaskFilter(event.target.value as typeof taskFilter)
                    }
                    className="h-9 rounded-lg px-3 text-xs font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#d6dbe5] outline-none"
                  >
                    <option value="All">All tasks</option>
                    <option value="INDIVIDUAL">Individual tasks</option>
                    <option value="GROUP">Group tasks</option>
                  </select>
                </label>
              </div>

              {visibleTasks.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {weeks.map((week) => {
                    const weekTasks = visibleTasks.filter(
                      (task) => task.weekNumber === week,
                    );
                    return (
                      <div
                        key={week}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-[#1C1D52]">
                            Week {week}
                          </h3>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            {weekTasks.length} task
                            {weekTasks.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {weekTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onSubmitted={loadTasks}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-xs text-slate-500">
                  {allTasks.length === 0
                    ? "No tasks have been set for your cohort yet."
                    : "No tasks match this filter."}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {visibleTasks.length} of {allTasks.length} tasks
                </span>
                <a
                  href="/internship/dashboard/grades"
                  className="font-semibold text-blue-600"
                >
                  View My Grades →
                </a>
              </div>
            </section>
          </>
        )}
      </div>
    </InternshipShell>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h2 className="text-lg font-bold text-[#1C1D52]">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function SummaryCard({
  icon,
  iconClass,
  badgeClass,
  count,
  title,
  text,
  linkClass,
  onView,
}: {
  icon: React.ReactNode;
  iconClass: string;
  badgeClass: string;
  count: number;
  title: string;
  text: string;
  linkClass: string;
  onView: () => void;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <div className="flex items-center justify-between">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconClass}`}
        >
          {icon}
        </span>
        <span
          className={`rounded-lg px-3 py-1.5 text-[10px] font-bold text-white ${badgeClass}`}
        >
          {count} open now
        </span>
      </div>
      <h2 className="mt-4 text-base font-bold text-[#1C1D52]">{title}</h2>
      <p className="mt-2 text-xs text-slate-500">{text}</p>
      <button
        type="button"
        onClick={onView}
        className={`mt-4 inline-flex items-center gap-1 text-xs font-bold ${linkClass}`}
      >
        View Tasks <ArrowRight className="h-3 w-3" />
      </button>
    </section>
  );
}

function TaskCard({
  task,
  onSubmitted,
}: {
  task: InternshipTaskItem;
  onSubmitted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const group = task.group;
  const leaderSubmits = task.kind === "GROUP" && group?.isLeader;

  function toggleOpen() {
    if (!open) {
      // Start from the previous submission so a resubmission can be edited.
      setContent(task.submission?.content ?? "");
      setParticipants(
        group
          ? group.participantIds.length
            ? group.participantIds
            : group.members.map((member) => member.userId)
          : [],
      );
      setMessage(null);
    }
    setOpen(!open);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/internship/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          content,
          participantIds: leaderSubmits ? participants : undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to submit your work.");
      setMessage({ ok: true, text: "Submitted. Your mentor will review it." });
      await onSubmitted();
    } catch (submitError) {
      setMessage({
        ok: false,
        text:
          submitError instanceof Error
            ? submitError.message
            : "Unable to submit your work.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const resubmit = Boolean(task.submittedAt);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="w-full p-3 text-left sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#1C1D52]">{task.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.kind === "GROUP" ? "bg-[#e8f7eb] text-[#3d8a2c]" : "bg-[#edf4ff] text-[#3557a5]"}`}
              >
                {task.kind === "GROUP" ? "Group" : "Individual"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[task.tone]}`}
              >
                {task.status}
              </span>
            </div>
          </div>
          <ChevronDown
            className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
        <div className="mt-3 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-3">
          <span>Opens: {task.opensLabel}</span>
          <span>Due: {task.dueDateLabel}</span>
          <span className="font-semibold text-[#1C1D52]">
            {task.timeLeftLabel}
          </span>
        </div>
        {task.score !== null && (
          <p className="mt-2 text-[11px] font-semibold text-[#3d8a2c]">
            Score: {task.scoreLabel}
          </p>
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3 sm:p-4">
          {task.description ? (
            <p className="whitespace-pre-wrap text-xs leading-6 text-slate-600">
              {task.description}
            </p>
          ) : (
            <p className="text-xs italic text-slate-400">
              No instructions were added for this task.
            </p>
          )}

          {task.kind === "GROUP" && group && <GroupStatus task={task} />}

          {task.submission?.feedback && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Feedback</p>
              <p className="mt-1 whitespace-pre-wrap">
                {task.submission.feedback}
              </p>
            </div>
          )}

          {task.labScenarioId && (
            <p className="mt-4 text-xs text-slate-500">
              Done in the Practice Lab. Reach{" "}
              <span className="font-semibold text-[#1C1D52]">
                {task.labPassMark}%
              </span>{" "}
              there to pass this task. Submitting grades it straight away.
            </p>
          )}

          {task.labScenarioId && (
            <a
              href={`/internship/dashboard/lab/${task.labScenarioId}?taskId=${task.id}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white"
            >
              {task.canSubmit
                ? "Open in Practice Lab and submit"
                : "Open in Practice Lab"}
            </a>
          )}

          {task.canSubmit && !task.labScenarioId ? (
            <form onSubmit={submit} className="mt-4 space-y-3">
              {leaderSubmits && group && (
                <fieldset className="rounded-lg border border-slate-200 p-3">
                  <legend className="px-1 text-xs font-semibold text-[#1C1D52]">
                    Who took part?
                  </legend>
                  <p className="text-[11px] text-slate-500">
                    Only members you tick get credit for this task.
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.members.map((member) => {
                      // The leader submitting is always a participant.
                      const self = member.userId === group.leaderId;
                      return (
                        <label
                          key={member.userId}
                          className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-[#1C1D52]"
                        >
                          <input
                            type="checkbox"
                            checked={
                              self || participants.includes(member.userId)
                            }
                            disabled={self}
                            onChange={(event) =>
                              setParticipants((current) =>
                                event.target.checked
                                  ? [...current, member.userId]
                                  : current.filter(
                                      (id) => id !== member.userId,
                                    ),
                              )
                            }
                            className="h-4 w-4 accent-[#5FBB46]"
                          />
                          {member.name}
                          {self && (
                            <span className="text-[10px] text-slate-400">
                              (you, leader)
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              <label className="block text-xs font-semibold text-[#1C1D52]">
                Your submission
                <textarea
                  required
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  rows={6}
                  maxLength={10000}
                  placeholder="Write your answer, or paste a link to your work (Google Drive, Canva, GitHub…)."
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#5FBB46]"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {submitting
                  ? "Submitting…"
                  : resubmit
                    ? "Resubmit"
                    : leaderSubmits
                      ? "Submit for my group"
                      : "Submit task"}
              </button>
            </form>
          ) : (
            task.blockedReason && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                {task.window === "UPCOMING" ? (
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                {task.blockedReason}
              </p>
            )
          )}

          {task.submission?.content && !task.canSubmit && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-[#1C1D52]">Submitted work</p>
              <p className="mt-1 whitespace-pre-wrap break-words">
                {task.submission.content}
              </p>
            </div>
          )}

          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={`mt-3 text-xs font-semibold ${message.ok ? "text-[#397d3a]" : "text-red-600"}`}
            >
              {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** What a group member sees about their group's submission. */
function GroupStatus({ task }: { task: InternshipTaskItem }) {
  const group = task.group!;
  let text: string;
  let tone: string;
  if (group.included === null) {
    text = group.isLeader
      ? "Your group hasn't submitted this task yet. As group leader, you submit it for everyone."
      : `Your group hasn't submitted this task yet. Your group leader${group.leaderName ? `, ${group.leaderName},` : ""} submits it for the group.`;
    tone = "bg-slate-50 text-slate-600";
  } else if (group.included) {
    text = `Submitted by ${group.submittedByName ?? "your group leader"}. You were included as a participant.`;
    tone = "bg-emerald-50 text-emerald-800";
  } else {
    text = `Submitted by ${group.submittedByName ?? "your group leader"}, but you were not included as a participant, so you won't get credit for this task.`;
    tone = "bg-yellow-50 text-yellow-800";
  }
  const names = group.members
    .filter((member) => group.participantIds.includes(member.userId))
    .map((member) => member.name);
  return (
    <div className={`mt-4 rounded-lg p-3 text-xs ${tone}`}>
      <p>{text}</p>
      {names.length > 0 && (
        <p className="mt-1 text-[11px] opacity-80">
          Participants: {names.join(", ")}
        </p>
      )}
    </div>
  );
}
