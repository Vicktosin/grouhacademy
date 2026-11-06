"use client";

import { useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { useAdminPlatformSettings } from "@/components/useAdminPlatformSettings";

export default function CohortSystemSettingsPage() {
  const { settings, error, saving, message, save } = useAdminPlatformSettings();
  const [pendingOff, setPendingOff] = useState(false);

  if (error)
    return (
      <AdminShell workspace="internship">
        <p className="p-6 text-sm text-red-600">{error}</p>
      </AdminShell>
    );

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-2xl space-y-5 p-6">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
            Internship · Settings
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52]">
            Cohort system
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Controls whether newly accepted, paid interns are placed in cohorts
            or start in self-paced mode. Special Class is never affected.
          </p>
        </header>

        {!settings && (
          <p className="text-xs text-slate-400">Loading settings…</p>
        )}

        {settings && (
          <div className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#1C1D52]">
                  Cohort system enabled
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  When <strong>ON</strong>, new interns are placed in a cohort
                  as usual.
                  <br />
                  When <strong>OFF</strong>, they start self-paced the day they
                  pay — tasks come from the Task Library, GROUP tasks are
                  skipped, and any intern currently waiting for a cohort is
                  moved to self-paced immediately.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={pendingOff ? false : settings.cohortSystemEnabled}
                onClick={() => {
                  if (settings.cohortSystemEnabled && !pendingOff) {
                    // Show warning before switching off
                    setPendingOff(true);
                  } else {
                    setPendingOff(false);
                  }
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  !pendingOff && settings.cohortSystemEnabled
                    ? "bg-[#5FBB46]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    !pendingOff && settings.cohortSystemEnabled
                      ? "right-1"
                      : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Warning shown before confirming switch-off */}
            {pendingOff && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="text-xs text-amber-800">
                    <p className="font-semibold">
                      Turning the cohort system off affects all new interns
                      immediately.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>
                        Every newly paid intern (except Special Class) starts
                        self-paced that day.
                      </li>
                      <li>
                        Any paid intern currently waiting for a cohort is moved
                        to self-paced right now.
                      </li>
                      <li>
                        Self-paced tasks come from the Task Library. Make sure
                        it is populated before switching.
                      </li>
                      <li>GROUP tasks are skipped for self-paced interns.</li>
                    </ul>
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          void save({ cohortSystemEnabled: false }).then(() =>
                            setPendingOff(false),
                          )
                        }
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white"
                      >
                        Confirm — switch off
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingOff(false)}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-[11px] font-semibold text-amber-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save when switching back ON */}
            {!pendingOff && !settings.cohortSystemEnabled && (
              <div className="mt-5 flex items-center gap-3">
                <p className="text-xs text-slate-500">
                  Cohort system is currently <strong>OFF</strong>. Turn it on
                  to place future interns in cohorts again.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save({ cohortSystemEnabled: true })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-3 py-1.5 text-[11px] font-semibold text-[#14204f] disabled:opacity-60"
                >
                  <Save className="h-3 w-3" />
                  {saving ? "Saving…" : "Switch ON"}
                </button>
              </div>
            )}

            {message && (
              <p
                className={`mt-4 text-xs font-medium ${
                  message.toLowerCase().includes("unable") ||
                  message.toLowerCase().includes("error")
                    ? "text-red-600"
                    : "text-teal-600"
                }`}
              >
                {message}
              </p>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
