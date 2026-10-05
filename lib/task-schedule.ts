// Task windows are written relative to a cohort: week 1, day 1 is the
// cohort's start date, and times are West Africa Time (UTC+1, no daylight
// saving). Pure functions, so the admin form can preview real dates too.

export const SCHEDULE_TIMEZONE = "Africa/Lagos";
const WAT_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type SchedulePoint = { week: number; day: number; time: string };

/** Midnight WAT at the start of the calendar day containing `date`. */
function watDayStart(date: Date) {
  const watMs = date.getTime() + WAT_OFFSET_MS;
  return Math.floor(watMs / DAY_MS) * DAY_MS - WAT_OFFSET_MS;
}

export function isValidSchedulePoint({ week, day, time }: SchedulePoint) {
  return (
    Number.isInteger(week) &&
    week >= 1 &&
    week <= 52 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 7 &&
    TIME_PATTERN.test(time)
  );
}

/** The real moment a week/day/time point falls on for a cohort. */
export function scheduleToDate(cohortStart: Date, point: SchedulePoint) {
  const [, hours, minutes] = TIME_PATTERN.exec(point.time) ?? ["", "0", "0"];
  const dayOffset = (point.week - 1) * 7 + (point.day - 1);
  return new Date(
    watDayStart(cohortStart) +
      dayOffset * DAY_MS +
      (Number(hours) * 60 + Number(minutes)) * 60 * 1000,
  );
}

/** The calendar date of a cohort's week/day, for labelling day pickers. */
export function scheduleDayLabel(cohortStart: Date, week: number, day: number) {
  return scheduleToDate(cohortStart, {
    week,
    day,
    time: "12:00",
  }).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: SCHEDULE_TIMEZONE,
  });
}

/** "Fri, Oct 10, 11:59 PM" in WAT. */
export function formatWat(date: Date) {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SCHEDULE_TIMEZONE,
  });
}

export type TaskWindowState = "UPCOMING" | "OPEN" | "CLOSED";

export function taskWindowState(
  opensAt: Date,
  dueDate: Date,
  now = new Date(),
): TaskWindowState {
  if (now < opensAt) return "UPCOMING";
  if (now >= dueDate) return "CLOSED";
  return "OPEN";
}

/**
 * Where a cohort is on its calendar. The cohort runs from the start of its
 * start date to the end of its end date (WAT), and progress moves once a day.
 */
export function cohortTimeline(start: Date, end: Date, now = new Date()) {
  const first = watDayStart(start);
  const endsAt = watDayStart(end) + DAY_MS;
  const totalDays = Math.max(1, Math.round((endsAt - first) / DAY_MS));
  const nowMs = now.getTime();
  const dayNumber =
    nowMs < first
      ? 0
      : Math.min(totalDays, Math.floor((nowMs - first) / DAY_MS) + 1);
  return {
    dayNumber,
    totalDays,
    totalWeeks: Math.ceil(totalDays / 7),
    weekNumber: dayNumber === 0 ? 0 : Math.ceil(dayNumber / 7),
    percent: Math.round((dayNumber / totalDays) * 100),
    started: nowMs >= first,
    ended: nowMs >= endsAt,
    endsAt: new Date(endsAt),
  };
}
