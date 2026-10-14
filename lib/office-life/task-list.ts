import { durationLabel, getInternTasks, type InternTaskContext } from "@/lib/intern-tasks";
import type { InternshipTaskItem } from "@/lib/internship-data";
import { officeLifeOverview } from "@/lib/office-life/server";
import { officeLifeTaskInfo, submitOfficeLifeTasks } from "@/lib/office-life/tasks";

/**
 * Office Life tasks on the intern's task list: submitted for them if they've
 * finished the workday, and shown with the workday's status and times
 * (which decide the task) instead of a submission box.
 */
export async function getInternTasksWithOfficeLife(userId: string, context: InternTaskContext, preview: boolean) {
  let tasks = await getInternTasks(userId, context);
  if (!tasks.some((task) => task.officeLifeDay !== null)) return tasks;
  // A workday finished before the task was linked to it still counts.
  if (tasks.some((task) => task.officeLifeDay !== null && !task.submittedAt) && (await submitOfficeLifeTasks({ userId })) > 0)
    tasks = await getInternTasks(userId, context);
  const overview = await officeLifeOverview(userId, preview);
  const days = new Map(overview.enrolled ? overview.days.map((day) => [day.day, day]) : []);
  const now = new Date();
  return tasks.map((task): InternshipTaskItem => {
    if (task.officeLifeDay === null) return task;
    const officeLife = officeLifeTaskInfo(task.officeLifeDay, days.get(task.officeLifeDay), Boolean(task.submittedAt), now);
    const window = officeLife.window ?? task.window;
    const unsubmitted = !task.submittedAt;
    const workday = days.get(task.officeLifeDay);
    return {
      ...task,
      officeLife,
      // Nothing to type: the workday is the submission.
      canSubmit: false,
      blockedReason: null,
      window,
      opensLabel: officeLife.opensLabel ?? task.opensLabel,
      dueDateLabel: officeLife.dueLabel ?? task.dueDateLabel,
      timeLeftLabel:
        officeLife.state === "COMPLETED"
          ? "Workday done"
          : window === "UPCOMING" && workday?.opensAt
            ? `Opens in ${durationLabel(new Date(workday.opensAt).getTime() - now.getTime())}`
            : window === "OPEN" && workday?.dueAt
              ? `${durationLabel(new Date(workday.dueAt).getTime() - now.getTime())} left`
              : task.timeLeftLabel,
      ...(unsubmitted
        ? window === "UPCOMING"
          ? { status: "Not open yet" as const, tone: "slate" as const }
          : window === "OPEN"
            ? { status: "Not submitted" as const, tone: "slate" as const }
            : { status: "Missed" as const, tone: "red" as const }
        : {}),
    };
  });
}
