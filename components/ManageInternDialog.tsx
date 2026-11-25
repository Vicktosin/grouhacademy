"use client";

import { Loader2, RotateCcw, Save, UserX, X } from "lucide-react";
import { useState } from "react";
import DeleteAccountButton from "@/components/admin/DeleteAccountButton";

// Admin panel for one intern: move them to another track, level, cohort or
// group, or remove/restore them. Opens as a bottom sheet on phones.

export type InternOptions = {
  tracks: Array<{ id: string; name: string; status: string }>;
  levels: Array<{ id: string; name: string }>;
  cohorts: Array<{
    id: string;
    name: string;
    programId: string;
    levelId: string;
    startDate: string;
    endDate: string;
  }>;
  groups: Array<{
    id: string;
    number: number;
    cohortId: string | null;
    capacity: number;
    members: number;
  }>;
};

export type ManagedIntern = {
  /** The person (an intern has one application per track and level). */
  id: string;
  applicationId: string;
  name: string;
  email: string;
  status: string;
  programId: string;
  levelId: string;
  cohortId: string | null;
  group: { id: string; number: number } | null;
};

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46] disabled:bg-slate-50 disabled:text-slate-400";

function cohortLabel(cohort: InternOptions["cohorts"][number]) {
  const now = Date.now();
  const start = new Date(cohort.startDate).getTime();
  const end = new Date(cohort.endDate).getTime();
  const state = now < start ? "upcoming" : now > end ? "ended" : "running";
  const date = new Date(cohort.startDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  return `${cohort.name} (${state}, starts ${date})`;
}

export default function ManageInternDialog({
  intern,
  options,
  onClose,
  onSaved,
}: {
  intern: ManagedIntern;
  options: InternOptions;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const removed = intern.status === "REMOVED";
  const [programId, setProgramId] = useState(intern.programId);
  const [levelId, setLevelId] = useState(intern.levelId);
  const [cohortId, setCohortId] = useState(intern.cohortId ?? "");
  const [groupId, setGroupId] = useState(intern.group?.id ?? "");
  const [busy, setBusy] = useState<"move" | "remove" | "restore" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cohorts = options.cohorts.filter(
    (cohort) => cohort.programId === programId && cohort.levelId === levelId,
  );
  const groups = options.groups.filter((group) => group.cohortId === cohortId);
  const changed =
    programId !== intern.programId ||
    levelId !== intern.levelId ||
    cohortId !== (intern.cohortId ?? "") ||
    groupId !== (intern.group?.id ?? "");

  // A new track or level means a new cohort and group.
  const pickTrack = (nextProgram: string, nextLevel: string) => {
    setProgramId(nextProgram);
    setLevelId(nextLevel);
    const match = options.cohorts.find(
      (cohort) =>
        cohort.programId === nextProgram &&
        cohort.levelId === nextLevel &&
        new Date(cohort.endDate).getTime() > Date.now(),
    );
    setCohortId(
      nextProgram === intern.programId && nextLevel === intern.levelId
        ? (intern.cohortId ?? "")
        : (match?.id ?? ""),
    );
    setGroupId("");
  };

  async function send(action: "move" | "remove" | "restore") {
    setBusy(action);
    setError(null);
    const response = await fetch(
      `/api/admin/internship/interns/${intern.applicationId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "move"
            ? {
                action,
                programId,
                levelId,
                cohortId: cohortId || null,
                groupId: groupId || null,
              }
            : { action },
        ),
      },
    ).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setBusy(null);
    if (!response?.ok) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }
    onSaved(body?.message ?? "Saved.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1438]/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Manage ${intern.name}`}
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
              Manage intern
            </p>
            <h2 className="mt-1 truncate text-lg font-bold text-[#1C1D52]">
              {intern.name}
            </h2>
            <p className="truncate text-xs text-slate-500">{intern.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {removed ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
            This intern has been removed and can&apos;t open their dashboard.
            Restore them to move them or give access back.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Track">
                <select
                  value={programId}
                  onChange={(event) => pickTrack(event.target.value, levelId)}
                  className={selectClass}
                >
                  {options.tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.name}
                      {track.status === "DISABLED" ? " (disabled)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Level">
                <select
                  value={levelId}
                  onChange={(event) => pickTrack(programId, event.target.value)}
                  className={selectClass}
                >
                  {options.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Cohort">
              <select
                value={cohortId}
                onChange={(event) => {
                  setCohortId(event.target.value);
                  setGroupId("");
                }}
                className={selectClass}
              >
                <option value="">No cohort for now</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohortLabel(cohort)}
                  </option>
                ))}
              </select>
              {!cohorts.length && (
                <span className="mt-1 block text-[11px] text-amber-700">
                  This track and level has no cohort yet. Create one on the
                  Cohorts page, or save with no cohort.
                </span>
              )}
            </Field>

            <Field label="Group">
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                disabled={!cohortId}
                className={selectClass}
              >
                <option value="">
                  {cohortId
                    ? "Place automatically (first group with room)"
                    : "Choose a cohort first"}
                </option>
                {groups.map((group) => {
                  const current = group.id === intern.group?.id;
                  const full = group.members >= group.capacity && !current;
                  return (
                    <option key={group.id} value={group.id} disabled={full}>
                      Group {group.number} ({group.members}/{group.capacity}
                      {full ? ", full" : ""}
                      {current ? ", current" : ""})
                    </option>
                  );
                })}
              </select>
            </Field>

            {(programId !== intern.programId || levelId !== intern.levelId) && (
              <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-[11px] leading-5 text-sky-800">
                Moving tracks takes the intern out of their current group and
                away from their mentor on the old track. Their payment,
                assessment and past work are kept. Fees are not changed.
              </p>
            )}

            <button
              type="button"
              onClick={() => void send("move")}
              disabled={!changed || Boolean(busy)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-3 text-sm font-bold text-[#14204f] disabled:opacity-50"
            >
              {busy === "move" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </button>
          </div>
        )}

        {error && (
          <p
            className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4">
          {removed ? (
            <button
              type="button"
              onClick={() => void send("restore")}
              disabled={Boolean(busy)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === "restore" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Restore intern
            </button>
          ) : confirmRemove ? (
            <div className="space-y-2 rounded-lg bg-red-50 p-3">
              <p className="text-xs leading-5 text-red-800">
                Remove {intern.name}? They lose access to their dashboard and
                leave their group and mentor. Their payment and work are kept,
                and you can restore them later.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void send("remove")}
                  disabled={Boolean(busy)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busy === "remove" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Yes, remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={Boolean(busy)}
                  className="flex-1 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <UserX className="h-4 w-4" /> Remove from internship
            </button>
          )}
          <DeleteAccountButton
            userId={intern.id}
            name={intern.name}
            onDeleted={() => onSaved("permanently deleted.")}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
