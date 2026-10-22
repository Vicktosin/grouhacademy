"use client";

import { Fragment, useSyncExternalStore } from "react";

// The intern dashboard's cohort card: a live countdown to the internship's
// start, then to its end (the end of the cohort's last day, WAT). It ticks
// in the browser only, so it costs no server requests.

const subscribe = (onTick: () => void) => {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
};

// Snapshot is whole seconds so it stays stable between ticks.
const getSeconds = () => Math.floor(Date.now() / 1000);
const getServerSeconds = () => null;

const pad = (value: number) => String(value).padStart(2, "0");

export default function CohortCountdown({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const seconds = useSyncExternalStore(subscribe, getSeconds, getServerSeconds);
  const start = Math.floor(new Date(startsAt).getTime() / 1000);
  const end = Math.floor(new Date(endsAt).getTime() / 1000);

  if (seconds !== null && seconds >= end) {
    return <h2 className="mt-2 text-lg font-bold text-[#1C1D52]">Your internship has concluded.</h2>;
  }

  const upcoming = seconds !== null && seconds < start;
  let units: [string, string][] = [
    ["--", "Days"],
    ["--", "Hrs"],
    ["--", "Min"],
    ["--", "Sec"],
  ];
  if (seconds !== null) {
    const remaining = (upcoming ? start : end) - seconds;
    units = [
      [String(Math.floor(remaining / 86_400)), Math.floor(remaining / 86_400) === 1 ? "Day" : "Days"],
      [pad(Math.floor(remaining / 3600) % 24), "Hrs"],
      [pad(Math.floor(remaining / 60) % 60), "Min"],
      [pad(remaining % 60), "Sec"],
    ];
  }

  return (
    <div className="mt-2">
      <h2 className="text-lg font-bold text-[#1C1D52]">
        {upcoming ? "Your internship starts in" : "Your internship ends in"}
      </h2>
      <div className="mt-2 flex items-center gap-1.5 sm:gap-2" role="timer" aria-live="off">
        {units.map(([value, label], index) => (
          <Fragment key={index}>
            {index > 0 && <span className="text-lg font-black text-[#1C1D52]/30">:</span>}
            <span className="flex min-w-[3.25rem] flex-col items-center rounded-lg bg-white px-2 py-1.5 shadow-sm">
              <span className="text-xl font-black tabular-nums text-[#1C1D52]">{value}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
