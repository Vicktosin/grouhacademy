"use client";

import { ClipboardList, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MentorBadge } from "@/components/MentorPage";

export type MentorTaskRow = {
  id: string;
  title: string;
  description: string | null;
  type: "Individual" | "Group";
  programName: string;
  moduleTitle: string;
  dueLabel: string | null;
  status: "Active" | "Closed";
  assignedInterns: number;
  submitted: number;
  awaitingReview: number;
  accepted: number;
};

type TaskType = "All" | "Individual" | "Group";

export default function MentorTasksList({ tasks }: { tasks: MentorTaskRow[] }) {
  const [taskType, setTaskType] = useState<TaskType>("All");
  const [selectedTask, setSelectedTask] = useState<MentorTaskRow | null>(null);
  const visibleTasks = useMemo(
    () =>
      taskType === "All"
        ? tasks
        : tasks.filter((task) => task.type === taskType),
    [taskType, tasks],
  );

  return (
    <>
      <div
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter tasks"
      >
        {(["All", "Individual", "Group"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={taskType === type}
            onClick={() => setTaskType(type)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-bold ${taskType === type ? "bg-[#1C1D52] text-white" : "bg-[#f3f6fb] text-slate-600"}`}
          >
            {type === "Group" ? (
              <Users className="h-3.5 w-3.5" />
            ) : type === "Individual" ? (
              <UserRound className="h-3.5 w-3.5" />
            ) : (
              <ClipboardList className="h-3.5 w-3.5" />
            )}
            {type} tasks
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {visibleTasks.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            {tasks.length === 0
              ? "There are no tasks in your interns' tracks yet. Administrators create tasks from the internship workspace."
              : "No tasks of this type."}
          </p>
        )}
        {visibleTasks.map((task) => (
          <article
            key={task.id}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-[#1C1D52]">
                  {task.title}
                </h2>
                <MentorBadge tone={task.type === "Group" ? "green" : "blue"}>
                  {task.type}
                </MentorBadge>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {task.programName} · {task.moduleTitle} ·{" "}
                {task.submitted}/{task.assignedInterns} submitted
                {task.dueLabel ? ` · Due ${task.dueLabel}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {task.awaitingReview > 0 && (
                <MentorBadge tone="amber">
                  {task.awaitingReview} to review
                </MentorBadge>
              )}
              <MentorBadge tone={task.status === "Active" ? "green" : "blue"}>
                {task.status}
              </MentorBadge>
              <button
                type="button"
                onClick={() => setSelectedTask(task)}
                className="text-[10px] font-bold text-blue-600"
              >
                Manage
              </button>
            </div>
          </article>
        ))}
      </div>
      {selectedTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1D52]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                  {selectedTask.type} task
                </p>
                <h2
                  id="task-dialog-title"
                  className="mt-1 text-lg font-bold text-[#1C1D52]"
                >
                  {selectedTask.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="text-xs font-bold text-slate-500"
              >
                Close
              </button>
            </div>
            {selectedTask.description && (
              <p className="mt-4 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                {selectedTask.description}
              </p>
            )}
            <div className="mt-5 space-y-3 text-xs text-slate-600">
              <p>
                <strong className="text-[#1C1D52]">Track:</strong>{" "}
                {selectedTask.programName} · {selectedTask.moduleTitle}
              </p>
              <p>
                <strong className="text-[#1C1D52]">Your interns:</strong>{" "}
                {selectedTask.assignedInterns} · {selectedTask.submitted}{" "}
                submitted · {selectedTask.accepted} accepted
              </p>
              <p>
                <strong className="text-[#1C1D52]">Due:</strong>{" "}
                {selectedTask.dueLabel ?? "No due date"}
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Link
                href={`/mentor/submissions?task=${selectedTask.id}`}
                className="rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white"
              >
                View submissions
              </Link>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-[#1C1D52]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
