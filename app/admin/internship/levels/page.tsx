"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

type Level = {
  id: string;
  name: string;
  rank: number;
  description: string | null;
  inUse: boolean;
  usage: {
    applications: number;
    cohorts: number;
    assessments: number;
    resources: number;
  };
};

type Draft = { name: string; description: string };

export default function InternshipLevelsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLevel, setNewLevel] = useState<Draft>({
    name: "",
    description: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", description: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/levels", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setLevels(((await response.json()) as { levels: Level[] }).levels);
      })
      .catch(() => setMessage({ text: "Unable to load levels.", error: true }))
      .finally(() => setLoading(false));
  }, []);

  /** Sends a change; on success the server returns the updated list. */
  async function send(
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
    success: string,
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/internship/levels", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        levels?: Level[];
        error?: string;
      };
      if (!response.ok || !data.levels) {
        setMessage({ text: data.error ?? "Unable to save.", error: true });
        return false;
      }
      setLevels(data.levels);
      setMessage({ text: success, error: false });
      return true;
    } catch {
      setMessage({ text: "Unable to save.", error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addLevel(event: FormEvent) {
    event.preventDefault();
    if (await send("POST", newLevel, `“${newLevel.name.trim()}” added.`))
      setNewLevel({ name: "", description: "" });
  }

  async function saveEdit(level: Level) {
    if (await send("PATCH", { id: level.id, ...draft }, "Level updated."))
      setEditing(null);
  }

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1000px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
            Levels
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Interns start at the first level and move up one level at a time
            after earning a certificate. Each level has its own cohorts,
            entrance assessments and resources.
          </p>
        </header>

        {message && (
          <p
            className={`rounded-lg px-4 py-3 text-xs font-semibold ${
              message.error
                ? "bg-red-50 text-red-700"
                : "bg-[#e8f7eb] text-[#397d3a]"
            }`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading levels...
            </p>
          ) : (
            <ol className="space-y-3">
              {levels.map((level, index) => (
                <li
                  key={level.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  {editing === level.id ? (
                    <div className="space-y-3">
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDraft({ ...draft, name: event.target.value })
                        }
                        aria-label="Level name"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                      />
                      <input
                        value={draft.description}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            description: event.target.value,
                          })
                        }
                        aria-label="Level description"
                        placeholder="Short description (optional)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void saveEdit(level)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-2 text-[10px] font-bold text-[#14204f] disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1C1D52] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#1C1D52]">
                            {level.name}
                          </p>
                          {level.description && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {level.description}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-400">
                            {level.usage.applications} intern application
                            {level.usage.applications === 1 ? "" : "s"} ·{" "}
                            {level.usage.cohorts} cohort
                            {level.usage.cohorts === 1 ? "" : "s"} ·{" "}
                            {level.usage.assessments} assessment
                            {level.usage.assessments === 1 ? "" : "s"} ·{" "}
                            {level.usage.resources} resource
                            {level.usage.resources === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      {confirmDelete === level.id ? (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="font-semibold text-red-700">
                            Delete this level?
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void send(
                                "DELETE",
                                { id: level.id },
                                `“${level.name}” deleted.`,
                              ).then(() => setConfirmDelete(null))
                            }
                            className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-60"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy || index === 0}
                            onClick={() =>
                              void send(
                                "PATCH",
                                { id: level.id, move: "up" },
                                "Order updated.",
                              )
                            }
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            aria-label={`Move ${level.name} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busy || index === levels.length - 1}
                            onClick={() =>
                              void send(
                                "PATCH",
                                { id: level.id, move: "down" },
                                "Order updated.",
                              )
                            }
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                            aria-label={`Move ${level.name} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(level.id);
                              setDraft({
                                name: level.name,
                                description: level.description ?? "",
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button
                            type="button"
                            disabled={level.inUse}
                            title={
                              level.inUse
                                ? "In use, so it can't be deleted"
                                : undefined
                            }
                            onClick={() => setConfirmDelete(level.id)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-30"
                            aria-label={`Delete ${level.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#5FBB46]" />
            <h2 className="text-sm font-bold text-[#1C1D52]">Add a level</h2>
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            New levels go to the end of the list. Use the arrows to reorder.
          </p>
          <form
            onSubmit={(event) => void addLevel(event)}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={newLevel.name}
              onChange={(event) =>
                setNewLevel({ ...newLevel, name: event.target.value })
              }
              placeholder="Level name, e.g. Lead"
              aria-label="New level name"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46] sm:w-56"
            />
            <input
              value={newLevel.description}
              onChange={(event) =>
                setNewLevel({ ...newLevel, description: event.target.value })
              }
              placeholder="Short description (optional)"
              aria-label="New level description"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
            />
            <button
              type="submit"
              disabled={busy || !newLevel.name.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add level
            </button>
          </form>
        </section>

        <LevelFees levelKey={levels.map((level) => level.id).join(",")} />
      </div>
    </AdminShell>
  );
}

type FeeTable = {
  levels: Array<{ id: string; name: string }>;
  tracks: Array<{
    id: string;
    name: string;
    status: string;
    levels: Array<{
      levelId: string;
      acceptanceFee: number | null;
      hasAssessment: boolean;
    }>;
  }>;
};

/**
 * Acceptance fee for every track at every level. A level is open to
 * applicants on a track once it has a fee and an entrance assessment.
 */
function LevelFees({ levelKey }: { levelKey: string }) {
  const [table, setTable] = useState<FeeTable | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reload when levels are added, removed or reordered above.
  useEffect(() => {
    fetch("/api/admin/internship/levels/fees", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setTable((await response.json()) as FeeTable);
        setDrafts({});
      })
      .catch(() => setError("Unable to load fees."));
  }, [levelKey]);

  async function save(programId: string, levelId: string, value: string) {
    const key = `${programId}:${levelId}`;
    setSavingKey(key);
    setError(null);
    try {
      const response = await fetch("/api/admin/internship/levels/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          levelId,
          acceptanceFee:
            value.trim() === "" ? null : value.replace(/[,s]/g, ""),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as FeeTable & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Unable to save the fee.");
      setTable(data);
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the fee.",
      );
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
      <h2 className="text-sm font-bold text-[#1C1D52]">Acceptance fees</h2>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">
        The fee an intern pays to join each level of a track. A level opens to
        applicants once it has a fee and an entrance assessment for that track.
        Clear a fee to close that level. The first level&apos;s fee is the
        track&apos;s fee on the Tracks page.
      </p>
      {error && (
        <p
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {!table ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Loading fees...
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px] text-[#1C1D52]">
            <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Track</th>
                {table.levels.map((level) => (
                  <th key={level.id} className="px-3 py-3">
                    {level.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.tracks.map((track) => (
                <tr
                  key={track.id}
                  className="border-t border-slate-100 align-top"
                >
                  <td className="px-3 py-3 font-semibold">
                    {track.name}
                    {track.status !== "PUBLISHED" && (
                      <span className="mt-0.5 block text-[9px] font-normal text-slate-400">
                        Not published
                      </span>
                    )}
                  </td>
                  {track.levels.map((cell) => {
                    const key = `${track.id}:${cell.levelId}`;
                    const saved =
                      cell.acceptanceFee === null
                        ? ""
                        : String(cell.acceptanceFee);
                    const value = drafts[key] ?? saved;
                    const open =
                      cell.acceptanceFee !== null && cell.hasAssessment;
                    return (
                      <td key={cell.levelId} className="px-3 py-3">
                        <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 focus-within:border-[#5FBB46]">
                          <span className="text-slate-400">₦</span>
                          <input
                            inputMode="numeric"
                            value={value}
                            placeholder="Not set"
                            disabled={savingKey === key}
                            onChange={(event) =>
                              setDrafts({
                                ...drafts,
                                [key]: event.target.value,
                              })
                            }
                            onBlur={() => {
                              if (value !== saved)
                                void save(track.id, cell.levelId, value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter")
                                (event.target as HTMLInputElement).blur();
                            }}
                            aria-label={`${track.name} fee at this level`}
                            className="w-24 bg-transparent outline-none"
                          />
                        </label>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            open
                              ? "bg-[#e8f7eb] text-[#397d3a]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {open
                            ? "Open"
                            : cell.acceptanceFee === null
                              ? "Needs a fee"
                              : "Needs an assessment"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
