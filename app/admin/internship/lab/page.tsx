"use client";

import { Code2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import GuideVideoSetting from "@/components/admin/GuideVideoSetting";

type Scenario = {
  id: string;
  title: string;
  kind: "WEB" | "REACT" | "ADS" | "SOCIAL" | "AUTOMATION" | "BACKEND" | "WORDPRESS" | "CONTENT";
  kindLabel: string;
  track: string;
  level: string;
  published: boolean;
  checkCount: number;
  attempts: number;
  submitted: number;
  linkedTasks: number;
};

export default function AdminPracticeLabPage() {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [reviewEnabled, setReviewEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/internship/lab", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load.");
        setScenarios(body.scenarios as Scenario[]);
        setReviewEnabled(Boolean(body.reviewEnabled));
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      );
  }, []);

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1300px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Practice Lab
            </h1>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
              Hands-on coding exercises for each track and level. Interns see
              published exercises for their track at their level and below. Link
              an exercise to a task (under Tasks) to grade it.
            </p>
          </div>
          <Link
            href="/admin/internship/lab/new"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-semibold text-[#14204f]"
          >
            <Plus className="h-4 w-4" /> New exercise
          </Link>
        </header>

        <GuideVideoSetting guide="practice-lab" area="Practice Lab" />

        {!reviewEnabled && (
          <p className="rounded-lg bg-sky-50 px-4 py-3 text-xs text-sky-800">
            AI code review is off (no AI key: add ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY or GROQ_API_KEY). Automatic checks still
            run; add a key to give interns written code feedback.
          </p>
        )}
        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Exercise</th>
                  <th className="px-3 py-3">Track · Level</th>
                  <th className="px-3 py-3">Checks / goals</th>
                  <th className="px-3 py-3">Interns</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {scenarios?.map((scenario) => (
                  <tr key={scenario.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Code2 className="h-3.5 w-3.5 text-slate-400" />
                        {scenario.title}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {scenario.kindLabel}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {scenario.track} · {scenario.level}
                    </td>
                    <td className="px-3 py-3">
                      {scenario.checkCount}{" "}
                      {scenario.kind === "AUTOMATION"
                        ? "test records"
                        : scenario.kind === "BACKEND"
                          ? "API tests"
                        : scenario.kind === "ADS" || scenario.kind === "SOCIAL"
                          ? "goals"
                          : "checks"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {scenario.attempts} started · {scenario.submitted}{" "}
                      submitted
                      {scenario.linkedTasks > 0 && (
                        <span className="block text-[10px] text-violet-700">
                          Used in {scenario.linkedTasks} task
                          {scenario.linkedTasks === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-semibold ${scenario.published ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-slate-100 text-slate-600"}`}
                      >
                        {scenario.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/internship/lab/${scenario.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scenarios && scenarios.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              No exercises yet. Create the first one.
            </p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
