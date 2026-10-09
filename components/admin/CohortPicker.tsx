"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Choosing a cohort on admin pages, however many there are: every track
// runs its own cohorts (several a month), so a plain dropdown soon becomes
// a long list of look-alike names ("October 2026" for each track).
//
// The picker shows what's running now by default (ended cohorts are one
// tap away), filters by track, searches, and labels every cohort with its
// track and dates. It remembers the filters and the last cohort per page.

export type PickerCohort = {
  id: string;
  name: string;
  programName: string;
  startDate: string;
  endDate: string;
};

type Status = "RUNNING" | "UPCOMING" | "ENDED";
type StatusFilter = Status | "ALL";

const STATUS_LABEL: Record<Status, string> = { RUNNING: "Running", UPCOMING: "Upcoming", ENDED: "Ended" };
const STATUS_STYLE: Record<Status, string> = {
  RUNNING: "bg-[#e8f7eb] text-[#397d3a]",
  UPCOMING: "bg-sky-50 text-sky-700",
  ENDED: "bg-slate-100 text-slate-500",
};

export function cohortRunStatus(cohort: Pick<PickerCohort, "startDate" | "endDate">, now = Date.now()): Status {
  if (now < Date.parse(cohort.startDate)) return "UPCOMING";
  if (now > Date.parse(cohort.endDate)) return "ENDED";
  return "RUNNING";
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shortFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export function cohortDates(cohort: Pick<PickerCohort, "startDate" | "endDate">) {
  return `${shortFormat.format(new Date(cohort.startDate))} – ${dateFormat.format(new Date(cohort.endDate))}`;
}

/** The cohort this page last showed (null if none or storage is off). */
export function rememberedCohort(storageKey: string): string | null {
  try {
    return localStorage.getItem(`${storageKey}:cohort`);
  } catch {
    return null;
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: nothing remembered.
  }
}

/** A non-cohort choice shown under the list (e.g. "All cohorts"). */
export type PickerExtra = { id: string; label: string };

export default function CohortPicker({
  cohorts,
  value,
  onChange,
  storageKey,
  extras = [],
  label = "Cohort",
  hideLabel = false,
  disabled = false,
}: {
  cohorts: PickerCohort[];
  value: string | null;
  onChange: (id: string) => void;
  /** Remembers this page's filters and choice, e.g. "admin-groups". */
  storageKey: string;
  extras?: PickerExtra[];
  label?: string;
  /** For filter bars where the button speaks for itself. */
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter | null>(null);
  const [track, setTrack] = useState<string>("ALL");
  const root = useRef<HTMLDivElement>(null);

  const withStatus = useMemo(() => cohorts.map((c) => ({ ...c, status: cohortRunStatus(c) })), [cohorts]);
  const counts = useMemo(() => {
    const result: Record<Status, number> = { RUNNING: 0, UPCOMING: 0, ENDED: 0 };
    for (const c of withStatus) result[c.status]++;
    return result;
  }, [withStatus]);
  const tracks = useMemo(() => [...new Set(cohorts.map((c) => c.programName))].sort((a, b) => a.localeCompare(b)), [cohorts]);

  // Remembered filters, once in the browser.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(`${storageKey}:filters`) ?? "null") as {
          status?: StatusFilter;
          track?: string;
        } | null;
        if (saved?.status) setStatus(saved.status);
        if (saved?.track) setTrack(saved.track);
      } catch {
        // Nothing remembered.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  // Close on a click elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Default: running cohorts if there are any, else upcoming, else all.
  const activeStatus: StatusFilter = status ?? (counts.RUNNING ? "RUNNING" : counts.UPCOMING ? "UPCOMING" : "ALL");
  const activeTrack = track === "ALL" || tracks.includes(track) ? track : "ALL";

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return withStatus.filter(
      (c) =>
        (activeStatus === "ALL" || c.status === activeStatus) &&
        (activeTrack === "ALL" || c.programName === activeTrack) &&
        (!term || `${c.name} ${c.programName}`.toLowerCase().includes(term)),
    );
  }, [withStatus, activeStatus, activeTrack, query]);
  const byTrack = useMemo(() => {
    const groups = new Map<string, typeof visible>();
    for (const c of visible) groups.set(c.programName, [...(groups.get(c.programName) ?? []), c]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const setFilters = (next: { status?: StatusFilter; track?: string }) => {
    const merged = { status: next.status ?? activeStatus, track: next.track ?? activeTrack };
    setStatus(merged.status);
    setTrack(merged.track);
    remember(`${storageKey}:filters`, JSON.stringify(merged));
  };
  const choose = (id: string) => {
    remember(`${storageKey}:cohort`, id);
    setOpen(false);
    setQuery("");
    onChange(id);
  };

  const current = withStatus.find((c) => c.id === value);
  const extra = extras.find((e) => e.id === value);

  return (
    <div ref={root} className="relative w-full sm:w-auto">
      <span className={hideLabel ? "sr-only" : "block text-[10px] font-semibold text-current opacity-80"}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-cohort-picker
        className={`${hideLabel ? "" : "mt-1 "}flex w-full min-w-[280px] items-center justify-between gap-3 rounded-xl border border-[#14204f]/15 bg-white px-3 py-2.5 text-left text-xs text-[#1C1D52] disabled:opacity-60 sm:w-auto`}
      >
        <span className="min-w-0">
          {current ? (
            <>
              <span className="block truncate font-semibold">{current.name}</span>
              <span className="block truncate text-[10px] text-slate-500">
                {current.programName} · {STATUS_LABEL[current.status]} · {cohortDates(current)}
              </span>
            </>
          ) : (
            <span className="font-semibold">{extra?.label ?? (cohorts.length ? "Choose a cohort" : "No cohorts yet")}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-2xl border border-slate-200 bg-white p-3 text-[#1C1D52] shadow-[0_18px_40px_rgba(28,29,82,0.18)]">
          <div className="flex flex-wrap gap-1.5">
            {(["RUNNING", "UPCOMING", "ENDED", "ALL"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilters({ status: s })}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${activeStatus === s ? "bg-[#1C1D52] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {s === "ALL" ? `All (${cohorts.length})` : `${STATUS_LABEL[s]} (${counts[s]})`}
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <select
              value={activeTrack}
              onChange={(e) => setFilters({ track: e.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] text-[#1C1D52]"
              aria-label="Track"
            >
              <option value="ALL">All tracks</option>
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="relative">
              <span className="sr-only">Search cohorts</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                autoFocus
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-[11px] text-[#1C1D52] outline-none focus:border-[#5FBB46]"
              />
            </label>
          </div>

          <div className="mt-2 max-h-[min(60vh,360px)] overflow-y-auto">
            {byTrack.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                No cohorts match.{" "}
                {activeStatus !== "ALL" && (
                  <button type="button" onClick={() => setFilters({ status: "ALL" })} className="font-semibold text-[#1C1D52] underline">
                    Show all
                  </button>
                )}
              </p>
            ) : (
              byTrack.map(([trackName, list]) => (
                <div key={trackName} className="mt-1">
                  <p className="sticky top-0 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                    {trackName}
                  </p>
                  {list.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => choose(c.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${c.id === value ? "bg-[#f3f8ff]" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{c.name}</span>
                        <span className="block text-[10px] text-slate-500">{cohortDates(c)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_STYLE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                        {c.id === value && <Check className="h-3.5 w-3.5 text-[#5FBB46]" />}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {extras.length > 0 && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              {extras.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => choose(e.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${e.id === value ? "bg-[#f3f8ff]" : ""}`}
                >
                  {e.label}
                  {e.id === value && <Check className="h-3.5 w-3.5 text-[#5FBB46]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
