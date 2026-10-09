"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import CohortPicker, { rememberedCohort, type PickerCohort } from "@/components/admin/CohortPicker";

// Filtering an admin list (interns, payments…) by track and cohort, however
// many there are: a track dropdown, and the cohort picker narrowed to that
// track ("All cohorts" or one cohort). Each page remembers its choice.

export const ALL = "all";
export type CohortTrackValue = { track: string; cohort: string };

/** Whether a row belongs to the chosen track and cohort. */
export function matchesCohortTrack(
  value: CohortTrackValue,
  row: { cohortId: string | null | undefined; trackName: string | null | undefined },
) {
  return (value.track === ALL || row.trackName === value.track) && (value.cohort === ALL || row.cohortId === value.cohort);
}

/** The filter's state, starting from what this page last showed. */
export function useCohortTrackFilter(storageKey: string) {
  const [value, setValue] = useState<CohortTrackValue>({ track: ALL, cohort: ALL });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let track = ALL;
      try {
        track = localStorage.getItem(`${storageKey}:track`) ?? ALL;
      } catch {
        // Nothing remembered.
      }
      setValue({ track, cohort: rememberedCohort(storageKey) ?? ALL });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);
  const change = useCallback(
    (next: CohortTrackValue) => {
      setValue(next);
      try {
        localStorage.setItem(`${storageKey}:track`, next.track);
        localStorage.setItem(`${storageKey}:cohort`, next.cohort);
      } catch {
        // Private browsing: nothing remembered.
      }
    },
    [storageKey],
  );
  return [value, change] as const;
}

export default function CohortTrackFilter({
  cohorts,
  tracks: extraTracks = [],
  value,
  onChange,
  storageKey,
}: {
  cohorts: PickerCohort[];
  /** Tracks to offer besides those with cohorts (e.g. rows' own tracks). */
  tracks?: string[];
  value: CohortTrackValue;
  onChange: (value: CohortTrackValue) => void;
  storageKey: string;
}) {
  const tracks = useMemo(
    () => [...new Set([...cohorts.map((c) => c.programName), ...extraTracks.filter(Boolean)])].sort((a, b) => a.localeCompare(b)),
    [cohorts, extraTracks],
  );
  const inTrack = useMemo(
    () => (value.track === ALL ? cohorts : cohorts.filter((c) => c.programName === value.track)),
    [cohorts, value.track],
  );
  // A remembered choice that no longer exists falls back to everything.
  const track = value.track === ALL || tracks.includes(value.track) ? value.track : ALL;
  const cohort = value.cohort === ALL || inTrack.some((c) => c.id === value.cohort) ? value.cohort : ALL;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex w-fit items-center">
        <span className="sr-only">Filter by track</span>
        <select
          value={track}
          onChange={(event) => {
            const nextTrack = event.target.value;
            // A cohort from another track can't stay chosen.
            const keep = cohorts.some((c) => c.id === cohort && (nextTrack === ALL || c.programName === nextTrack));
            onChange({ track: nextTrack, cohort: keep ? cohort : ALL });
          }}
          className="h-9 appearance-none rounded-lg bg-white px-3 pr-8 text-[10px] font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#d8dee8] outline-none"
        >
          <option value={ALL}>Track: All</option>
          {tracks.map((name) => (
            <option key={name} value={name}>
              Track: {name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" />
      </label>
      <div>
        <CohortPicker
          hideLabel
          compact
          cohorts={inTrack}
          value={cohort}
          storageKey={storageKey}
          extras={[{ id: ALL, label: track === ALL ? "All cohorts" : `All ${track} cohorts` }]}
          onChange={(id) => onChange({ track, cohort: id })}
        />
      </div>
    </div>
  );
}
