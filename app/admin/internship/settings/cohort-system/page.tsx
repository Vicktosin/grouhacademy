"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Library, LoaderCircle } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { useAdminPlatformSettings } from "@/components/useAdminPlatformSettings";

// Self-paced or cohort: who decides (interns choose, cohort only, or
// self-paced only), and the Task Library that self-paced interns' tasks come
// from (filled by copying a cohort's tasks). Special Class always uses cohorts.

type Policy = "CHOOSE" | "COHORT_ONLY" | "SELF_PACED_ONLY";

const POLICIES: { value: Policy; title: string; text: string }[] = [
  {
    value: "CHOOSE",
    title: "Let interns choose",
    text: "After paying, each intern picks: start now at their own pace, or join the next cohort (with its start date). Self-paced interns can join a cohort once per level later.",
  },
  {
    value: "COHORT_ONLY",
    title: "Cohort only",
    text: "New interns are placed in the next cohort for their track and level, or on its waiting list.",
  },
  {
    value: "SELF_PACED_ONLY",
    title: "Self-paced only",
    text: "New interns start self-paced the day they pay. Interns waiting for a cohort or still choosing start self-paced now. Interns already in a cohort don't change.",
  },
];

export default function CohortSystemSettingsPage() {
  const { settings, error, saving, message, save } = useAdminPlatformSettings();
  const [confirming, setConfirming] = useState(false);
  const current = (settings as { learningModePolicy?: Policy } | null)?.learningModePolicy ?? "CHOOSE";

  if (error)
    return (
      <AdminShell workspace="internship">
        <p className="p-6 text-sm text-red-600">{error}</p>
      </AdminShell>
    );

  function pick(value: Policy) {
    if (value === current) return;
    if (value === "SELF_PACED_ONLY") return setConfirming(true);
    setConfirming(false);
    void save({ learningModePolicy: value });
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship · Settings</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52]">Self-paced or cohort</h1>
          <p className="mt-2 text-xs text-slate-500">
            How newly paid interns learn each level. Special Class always uses cohorts.
          </p>
        </header>

        {!settings && <p className="text-xs text-slate-400">Loading settings…</p>}

        {settings && (
          <section className="space-y-2 rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5" aria-label="Who decides">
            {POLICIES.map((policy) => (
              <label
                key={policy.value}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${current === policy.value ? "border-[#5FBB46] bg-[#f3fbf0]" : "border-slate-100"}`}
              >
                <input
                  type="radio"
                  name="policy"
                  checked={current === policy.value}
                  onChange={() => pick(policy.value)}
                  disabled={saving}
                  className="mt-1 accent-[#5FBB46]"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#1C1D52]">
                    {policy.title}
                    {policy.value === "CHOOSE" && <span className="ml-2 rounded-full bg-[#eef1ff] px-2 py-0.5 text-[10px] font-bold text-[#1C1D52]">Default</span>}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{policy.text}</span>
                </span>
              </label>
            ))}

            {confirming && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="alertdialog" aria-label="Confirm self-paced only">
                <p className="flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Every paid intern without a cohort (waiting or still choosing) starts self-paced now. Make sure the Task Library below has tasks for their tracks.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void save({ learningModePolicy: "SELF_PACED_ONLY" }).then(() => setConfirming(false))}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Switch to self-paced only
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
          </section>
        )}

        <TaskLibrary />
      </div>
    </AdminShell>
  );
}

type LibraryInfo = {
  cohorts: { id: string; name: string; tasks: number; startDate: string }[];
  library: { program: string; level: string; templates: number; individual: number }[];
};

/** Copy a cohort's tasks into the Task Library (self-paced interns' tasks). */
function TaskLibrary() {
  const [info, setInfo] = useState<LibraryInfo | null>(null);
  const [cohortId, setCohortId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/internship/task-library/copy-from-cohort", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setInfo(data);
    else setFailure(data?.error ?? "Unable to load the Task Library.");
  }

  useEffect(() => {
    fetch("/api/admin/internship/task-library/copy-from-cohort", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (response.ok) setInfo(data);
        else setFailure(data?.error ?? "Unable to load the Task Library.");
      })
      .catch(() => setFailure("Unable to load the Task Library."));
  }, []);

  async function copy() {
    if (!cohortId) return;
    setBusy(true);
    setMessage(null);
    setFailure(null);
    const response = await fetch("/api/admin/internship/task-library/copy-from-cohort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId }),
    });
    const data = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setFailure(data?.error ?? "Unable to copy the tasks.");
    setMessage(`Copied ${data.created} task${data.created === 1 ? "" : "s"} into the library (${data.skipped} already there).`);
    void load();
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1C1D52]">
        <Library className="h-4 w-4 text-[#5FBB46]" aria-hidden="true" /> Task Library
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Self-paced interns get their tasks from here, in the same order and spacing as the cohort they were copied from
        (dates become week, day and time from the cohort&apos;s start). Group tasks are kept for cohorts and skipped for self-paced interns.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1 text-[11px] font-semibold text-[#1C1D52]">
          <span className="sr-only">Cohort to copy</span>
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
          >
            <option value="">Choose a cohort to copy…</option>
            {info?.cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.tasks} tasks)</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!cohortId || busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1C1D52] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} Copy into library
        </button>
      </div>
      {message && <p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
      {failure && <p role="alert" className="mt-2 text-xs text-red-600">{failure}</p>}

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-[#1C1D52]">In the library</p>
        {!info && !failure && <p className="mt-1 text-xs text-slate-400">Loading…</p>}
        {info && info.library.length === 0 && (
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Empty: self-paced interns would get no tasks. Copy a cohort above (e.g. each October 22 Level 1 cohort).
          </p>
        )}
        {info && info.library.length > 0 && (
          <ul className="mt-1 divide-y divide-slate-100 text-xs">
            {info.library.map((row) => (
              <li key={`${row.program}:${row.level}`} className="flex justify-between gap-2 py-1.5">
                <span className="text-slate-700">{row.program} · {row.level}</span>
                <span className="text-slate-500">{row.individual} for self-paced · {row.templates} total</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
