import { ArrowRight } from "lucide-react";
import type { InternshipTaskItem } from "@/lib/internship-data";

/**
 * Office Life tasks: no submission box. Finishing the linked workday submits
 * the task and passes it (lib/office-life/tasks).
 */
export default function OfficeLifeTaskStatus({ task }: { task: InternshipTaskItem }) {
  const info = task.officeLife!;
  const done = info.state === "COMPLETED";
  const closed = !done && info.window === "CLOSED";
  const upcoming = !done && info.window === "UPCOMING";
  const tone = done
    ? "bg-emerald-100 text-emerald-700"
    : info.state === "IN_PROGRESS"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-slate-100 text-slate-500";
  return (
    <div className="mt-4 rounded-lg border border-[#dfeaf8] bg-[#f6f9ff] p-3 text-xs text-[#1C1D52]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          Office Life workday {info.day}
          {info.title ? `: ${info.title}` : ""}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
          {info.statusLabel}
        </span>
      </div>
      {info.opensLabel && info.dueLabel ? (
        <div className="mt-2 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-2">
          <span>Workday opens: {info.opensLabel} (WAT)</span>
          <span>Workday due: {info.dueLabel} (WAT)</span>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">
          This workday&apos;s times appear once you&apos;re placed in a cohort.
        </p>
      )}
      <p className="mt-2 text-[11px] leading-5 text-slate-600">
        {done && task.status === "Passed"
          ? `You finished this workday${info.completedLabel ? ` on ${info.completedLabel} (WAT)` : ""}. Your task was submitted and accepted automatically.`
          : done
            ? `You finished this workday${info.completedLabel ? ` on ${info.completedLabel} (WAT)` : ""}, so your task was submitted automatically.`
            : closed
              ? `This workday closed on ${info.dueLabel} (WAT) before you finished it, so this task can no longer be completed.`
              : upcoming
                ? `This workday hasn't opened yet. You can start it from ${info.opensLabel} (WAT).`
                : "Finish every step of this workday in Office Life. Your task is then submitted and accepted for you: there's nothing to type here."}
      </p>
      <a
        href={`/internship/dashboard/office-life?day=${info.day}`}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white"
      >
        {done ? "View the workday in Office Life" : "Open the workday in Office Life"}
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
