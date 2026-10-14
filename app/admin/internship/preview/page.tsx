"use client";

import { Eye, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { clearCachedJson } from "@/lib/client-cache";

// "Experience as intern" (lib/preview-intern): open the internship as an
// intern in any track, level and cohort would see and use it.

type Option = { id: string; name: string };
type Cohort = Option & { programId: string; levelId: string; startDate: string; endDate: string };
type Placement = { programId: string; levelId: string; cohortId: string | null };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46]";

export default function AdminInternPreviewPage() {
  const [programs, setPrograms] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"open" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/preview", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Unable to load the options.");
        setPrograms(data.programs);
        setLevels(data.levels);
        setCohorts(data.cohorts);
        setPlacement(data.placement);
        setProgramId(data.placement?.programId ?? data.programs[0]?.id ?? "");
        setLevelId(data.placement?.levelId ?? data.levels[0]?.id ?? "");
        setCohortId(data.placement?.cohortId ?? "");
      })
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load the options."),
      )
      .finally(() => setLoading(false));
  }, []);

  const matchingCohorts = useMemo(
    () => cohorts.filter((cohort) => cohort.programId === programId && cohort.levelId === levelId),
    [cohorts, programId, levelId],
  );
  // A cohort from another track or level can't be kept.
  const chosenCohort = matchingCohorts.some((cohort) => cohort.id === cohortId) ? cohortId : "";

  async function open() {
    setBusy("open");
    setError(null);
    try {
      const response = await fetch("/api/admin/internship/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, levelId, cohortId: chosenCohort || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to open the intern view.");
      // The shell's cached data was the admin's: start the intern side fresh
      // with a full page load (no client state carried over).
      clearCachedJson();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/internship/dashboard";
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Unable to open the intern view.");
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Clear everything the preview intern has done (submissions, Practice Lab work, progress)?")) return;
    setBusy("reset");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/internship/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!response.ok) throw new Error("Unable to reset the preview intern.");
      setMessage("The preview intern starts fresh.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset the preview intern.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[760px] space-y-5">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
            Internship administration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Experience as intern</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            See and use the internship exactly as an intern in a track, level and cohort does: their
            tasks, Practice Lab, resources and progress. You act as your own hidden preview intern, so
            no intern account is needed.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#1C1D52]">
                  Track
                  <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={`${selectClass} mt-1.5`}>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[#1C1D52]">
                  Level
                  <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className={`${selectClass} mt-1.5`}>
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-[#1C1D52]">
                Cohort
                <select value={chosenCohort} onChange={(e) => setCohortId(e.target.value)} className={`${selectClass} mt-1.5`}>
                  <option value="">No cohort (not yet placed in one)</option>
                  {matchingCohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name} · {dateFormat.format(new Date(cohort.startDate))} – {dateFormat.format(new Date(cohort.endDate))}
                    </option>
                  ))}
                </select>
                {!matchingCohorts.length && (
                  <span className="mt-1 block font-normal text-slate-500">This track and level have no cohorts yet.</span>
                )}
              </label>

              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
              {message && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{message}</p>}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy !== null || !programId || !levelId}
                  onClick={() => void open()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1C1D52] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === "open" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Open intern view
                </button>
                {placement && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void reset()}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[#1C1D52] disabled:opacity-50"
                  >
                    {busy === "reset" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Reset preview intern
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* Long for a phone screen: shown from tablet width up. */}
        <section className="hidden rounded-2xl bg-white p-5 text-xs leading-5 text-slate-600 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:block">
          <p className="font-semibold text-[#1C1D52]">How it works</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Everything works as for a real intern, submitting tasks and Practice Lab work included.</li>
            <li>
              The preview intern is hidden: it&apos;s left out of intern lists, cohort numbers, groups,
              the submissions queue, payments, certificates, reports and emails.
            </li>
            <li>It isn&apos;t in a group or assigned a mentor, so group work and mentor chat show as they do for an intern without one.</li>
            <li>Practice Lab work is reviewed by AI as for interns, so each run uses a little AI credit. Interviews can&apos;t be started in preview (they use paid video minutes).</li>
            <li>A banner on every intern page lets you switch, reset or exit.</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
