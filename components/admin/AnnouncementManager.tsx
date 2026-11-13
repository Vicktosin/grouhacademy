"use client";

import { LoaderCircle, Megaphone, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Admin announcements for interns: create, edit and delete, targeted at all
// interns, one track, or chosen cohorts, optionally shown as a one-time
// pop-up. Talks to /api/admin/internship/announcements (lib/announcements).

type CohortOption = { id: string; name: string; programName: string; startDate: string };
type TrackOption = { id: string; name: string };
type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  audience: "COURSES" | "INTERNSHIP" | null;
  programId: string | null;
  programName: string | null;
  cohorts: { id: string; name: string }[];
  showAsPopup: boolean;
  popupSeenCount: number;
  author: string;
  createdAt: string;
};
type Target = "all" | "track" | "cohorts";

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]";

async function fetchAnnouncements() {
  const response = await fetch("/api/admin/internship/announcements", { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Unable to load announcements.");
  return data as { announcements?: AnnouncementRow[]; cohorts?: CohortOption[]; tracks?: TrackOption[] };
}

export default function AnnouncementManager() {
  const [rows, setRows] = useState<AnnouncementRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<Target>("all");
  const [programId, setProgramId] = useState("");
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [cohortQuery, setCohortQuery] = useState("");
  const [showAsPopup, setShowAsPopup] = useState(false);

  function apply(data: { announcements?: AnnouncementRow[]; cohorts?: CohortOption[]; tracks?: TrackOption[] }) {
    setRows(data.announcements ?? []);
    setCohorts(data.cohorts ?? []);
    setTracks(data.tracks ?? []);
  }

  async function load() {
    apply(await fetchAnnouncements());
  }

  useEffect(() => {
    let active = true;
    fetchAnnouncements()
      .then((data) => {
        if (active) apply(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load announcements.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleCohorts = useMemo(() => {
    const query = cohortQuery.trim().toLowerCase();
    return cohorts.filter((c) =>
      `${c.name} ${c.programName}`.toLowerCase().includes(query),
    );
  }, [cohorts, cohortQuery]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setTarget("all");
    setProgramId("");
    setCohortIds([]);
    setCohortQuery("");
    setShowAsPopup(false);
  }

  function startEdit(row: AnnouncementRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setMessage(row.message);
    setTarget(row.cohorts.length ? "cohorts" : row.programId ? "track" : "all");
    setProgramId(row.programId ?? "");
    setCohortIds(row.cohorts.map((c) => c.id));
    setShowAsPopup(row.showAsPopup);
    setNotice(null);
    setError(null);
  }

  function toggleCohort(id: string) {
    setCohortIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (target === "track" && !programId) return setError("Choose a track.");
    if (target === "cohorts" && cohortIds.length === 0) return setError("Choose at least one cohort.");
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        title,
        message,
        audience: "INTERNSHIP",
        programId: target === "track" ? programId : null,
        cohortIds: target === "cohorts" ? cohortIds : [],
        showAsPopup,
      };
      const response = await fetch(
        editingId
          ? `/api/admin/internship/announcements/${editingId}`
          : "/api/admin/internship/announcements",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to save the announcement.");
      setNotice(editingId ? "Announcement updated." : "Announcement published.");
      resetForm();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: AnnouncementRow) {
    if (!window.confirm(`Delete "${row.title}"? Interns will no longer see it.`)) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/internship/announcements/${row.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to delete the announcement.");
      if (editingId === row.id) resetForm();
      setNotice("Announcement deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the announcement.");
    }
  }

  function targetLabel(row: AnnouncementRow) {
    if (row.cohorts.length) return row.cohorts.map((c) => c.name).join(", ");
    if (row.programName) return `Track: ${row.programName}`;
    if (row.audience === "COURSES") return "All students";
    if (row.audience === "INTERNSHIP") return "All interns";
    return "Everyone";
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf9f3] text-[#2f7d52]">
          <Megaphone className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#1C1D52]">
            {editingId ? "Edit announcement" : "Announcements"}
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Shown on interns&apos; dashboards and notifications. Target all interns, a track or chosen cohorts.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {notice}
        </p>
      )}

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <form onSubmit={save} className="space-y-4">
          <label className="block text-[10px] font-semibold text-[#1C1D52]">
            Title
            <input required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-[10px] font-semibold text-[#1C1D52]">
            Message
            <textarea required rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} resize-y`} />
          </label>

          <fieldset>
            <legend className="text-[10px] font-semibold text-[#1C1D52]">Who sees it</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  ["all", "All interns"],
                  ["track", "One track"],
                  ["cohorts", "Specific cohorts"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[10px] font-semibold ${target === value ? "bg-[#1C1D52] text-white" : "bg-slate-100 text-[#1C1D52]"}`}
                >
                  <input type="radio" name="target" value={value} checked={target === value} onChange={() => setTarget(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {target === "track" && (
            <label className="block text-[10px] font-semibold text-[#1C1D52]">
              Track
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClass}>
                <option value="">Choose a track…</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          )}

          {target === "cohorts" && (
            <div>
              <label className="block text-[10px] font-semibold text-[#1C1D52]">
                Cohorts ({cohortIds.length} chosen)
                <input value={cohortQuery} onChange={(e) => setCohortQuery(e.target.value)} placeholder="Search cohorts or tracks" className={inputClass} />
              </label>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {visibleCohorts.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#1C1D52] hover:bg-slate-50">
                      <input type="checkbox" checked={cohortIds.includes(c.id)} onChange={() => toggleCohort(c.id)} className="accent-[#5FBB46]" />
                      <span className="min-w-0 flex-1">
                        {c.name} <span className="text-slate-400">· {c.programName}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {visibleCohorts.length === 0 && <li className="px-2 py-1.5 text-xs text-slate-400">No cohorts match.</li>}
              </ul>
            </div>
          )}

          <label className="flex items-start gap-2 text-xs text-[#1C1D52]">
            <input type="checkbox" checked={showAsPopup} onChange={(e) => setShowAsPopup(e.target.checked)} className="mt-0.5 accent-[#5FBB46]" />
            <span>
              <span className="font-semibold">Show as pop-up</span>
              <span className="block text-[10px] text-slate-500">
                Each targeted intern sees it once, in a box with a &ldquo;Got it&rdquo; button, the next time they open the app.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-[10px] font-semibold text-[#14204f] disabled:opacity-60">
              {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              {editingId ? "Save changes" : "Publish announcement"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg bg-slate-100 px-4 py-2.5 text-[10px] font-semibold text-[#1C1D52]">
                Cancel
              </button>
            )}
          </div>
        </form>

        <div>
          <h3 className="text-xs font-bold text-[#1C1D52]">Recent announcements</h3>
          {loading && <p className="mt-3 text-xs text-slate-500">Loading…</p>}
          {!loading && rows.length === 0 && <p className="mt-3 text-xs text-slate-500">No announcements yet.</p>}
          <ul className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id} className={`rounded-xl border p-3 ${editingId === row.id ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-xs font-semibold text-[#1C1D52]">{row.title}</p>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(row)} aria-label={`Edit ${row.title}`} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(row)} aria-label={`Delete ${row.title}`} className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{row.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-[#1C1D52]">{targetLabel(row)}</span>
                  {row.showAsPopup && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                      Pop-up · seen by {row.popupSeenCount}
                    </span>
                  )}
                  <span className="text-slate-400">{new Date(row.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {row.author}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
