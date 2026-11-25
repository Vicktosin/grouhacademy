"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DeletionSummary } from "@/lib/account-deletion";

// Permanently delete a learner: a red button that only opens a pop-up, which
// says who and what will go and needs DELETE typed before it does anything.

const WORD = "DELETE";

export default function DeleteAccountButton({
  userId,
  name,
  onDeleted,
  className,
}: {
  userId: string;
  name: string;
  onDeleted: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50"
        }
      >
        <Trash2 className="h-4 w-4" /> Delete permanently
      </button>
      {open &&
        createPortal(
          <DeleteDialog userId={userId} name={name} onClose={() => setOpen(false)} onDeleted={onDeleted} />,
          document.body,
        )}
    </>
  );
}

function DeleteDialog({
  userId,
  name,
  onClose,
  onDeleted,
}: {
  userId: string;
  name: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [summary, setSummary] = useState<DeletionSummary | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/admin/internship/accounts/${userId}`;

  useEffect(() => {
    let active = true;
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!active) return;
        if (response.ok) setSummary(body.summary);
        else setError(body.error ?? "Couldn't load this account.");
      })
      .catch(() => active && setError("Couldn't load this account. Check your connection."));
    return () => {
      active = false;
    };
  }, [url]);

  async function confirm() {
    if (!summary) return;
    setBusy(true);
    setError(null);
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: summary.email }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setBusy(false);
    if (!response?.ok) {
      setError(body?.error ?? "Something went wrong. Please try again.");
      return;
    }
    onClose();
    onDeleted();
  }

  const items = summary
    ? [
        "Their sign-in, profile and onboarding answers",
        summary.tracks.length ? `Their place on ${summary.tracks.join(", ")}, with progress and assessments` : null,
        summary.submissions ? `${summary.submissions} submitted task${summary.submissions === 1 ? "" : "s"} (group work stays with their teammates)` : null,
        summary.messages ? `${summary.messages} message${summary.messages === 1 ? "" : "s"}` : null,
        summary.testimonials ? "Their testimonial, including on Success Stories" : null,
      ].filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0f1438]/60 sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={`Permanently delete ${name}`}
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-[#1C1D52] shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-lg font-bold">
          {summary?.blockedReason ? `${name} can't be deleted` : `Are you sure you want to delete ${name}?`}
        </h2>
        {summary && <p className="mt-1 break-all text-xs text-slate-500">{summary.email}</p>}

        {!summary && !error && (
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking their records...
          </p>
        )}
        {summary?.blockedReason && <p className="mt-4 text-sm leading-6 text-slate-600">{summary.blockedReason}</p>}

        {summary && !summary.blockedReason && (
          <>
            <p className="mt-4 text-sm font-semibold">This will permanently delete:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-600">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {summary.paidAmount > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                They paid ₦{summary.paidAmount.toLocaleString("en-NG")}. The payment stays in your records without their
                name, so your totals don&apos;t change.
              </p>
            )}
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700">
              This can&apos;t be undone. If they come back, they start again as a new person.
            </p>
            <label className="mt-4 block text-xs font-semibold">
              Type {WORD} to confirm
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-red-500"
              />
            </label>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            autoFocus
            className="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {summary && !summary.blockedReason ? "No, keep" : "Close"}
          </button>
          {summary && !summary.blockedReason && (
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || typed.trim().toUpperCase() !== WORD}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Yes, delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
