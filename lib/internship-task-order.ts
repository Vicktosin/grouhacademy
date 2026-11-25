export const OFFICE_LIFE_DAY_1_TASK_TITLE = "Resume Office Life – Day 1";
export const RESOURCE_VIDEO_SUMMARY_TASK_TITLE =
  "Watch Resource Videos and Write a Summary";
export const OFFICE_LIFE_DAY_2_TASK_TITLE = "Resume Office Life – Day 2";

type WeekTask = {
  title: string;
  opensWeek: number;
  labScenarioId?: string | null;
  officeLifeDay?: number | null;
};

/** A week's order: the main task, then Practice Lab, then Office Life. */
function weekPart(task: WeekTask) {
  if (task.officeLifeDay != null) return 2;
  return task.labScenarioId ? 1 : 0;
}

/** Week by week, each in its own order (self-paced interns). */
export function compareWeekOrder(first: WeekTask, second: WeekTask) {
  return (
    first.opensWeek - second.opensWeek ||
    weekPart(first) - weekPart(second) ||
    first.title.localeCompare(second.title)
  );
}

type ScheduledTask = {
  title: string;
  opensWeek: number;
  opensAt: Date;
  dueDate: Date;
  labScenarioId?: string | null;
  officeLifeDay?: number | null;
};

function sequenceNumber(task: ScheduledTask): number | null {
  // Workday identity stays stable when an administrator renames its task.
  if (task.opensWeek === 3 && task.officeLifeDay === 2) return 2;
  const numberedTitle = /^Week (\d+) Task (\d+):/.exec(task.title);
  if (numberedTitle && Number(numberedTitle[1]) === task.opensWeek)
    return Number(numberedTitle[2]);

  if (task.opensWeek === 2 && task.title === OFFICE_LIFE_DAY_1_TASK_TITLE)
    return 2;
  if (task.opensWeek === 3 && task.title === RESOURCE_VIDEO_SUMMARY_TASK_TITLE)
    return 1;
  if (task.opensWeek === 3 && task.title === OFFICE_LIFE_DAY_2_TASK_TITLE)
    return 2;

  return null;
}

export function compareInternshipTaskOrder(
  first: ScheduledTask,
  second: ScheduledTask,
) {
  const opensAt = first.opensAt.getTime() - second.opensAt.getTime();
  if (opensAt !== 0) return opensAt;

  const dueDate = first.dueDate.getTime() - second.dueDate.getTime();
  if (dueDate !== 0) return dueDate;

  const firstNumber = sequenceNumber(first);
  const secondNumber = sequenceNumber(second);
  if (
    first.opensWeek === second.opensWeek &&
    firstNumber !== null &&
    secondNumber !== null &&
    firstNumber !== secondNumber
  )
    return firstNumber - secondNumber;

  const part = weekPart(first) - weekPart(second);
  if (first.opensWeek === second.opensWeek && part !== 0) return part;

  return first.title.localeCompare(second.title);
}
