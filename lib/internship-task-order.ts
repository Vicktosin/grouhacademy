export const OFFICE_LIFE_DAY_1_TASK_TITLE = "Resume Office Life – Day 1";

type ScheduledTask = {
  title: string;
  opensWeek: number;
  opensAt: Date;
  dueDate: Date;
};

function sequenceNumber(task: ScheduledTask): number | null {
  const numberedTitle = /^Week (\d+) Task (\d+):/.exec(task.title);
  if (numberedTitle && Number(numberedTitle[1]) === task.opensWeek)
    return Number(numberedTitle[2]);

  if (task.opensWeek === 2 && task.title === OFFICE_LIFE_DAY_1_TASK_TITLE)
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

  return first.title.localeCompare(second.title);
}
