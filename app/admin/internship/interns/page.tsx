"use client";

import {
  Activity,
  ChevronDown,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";
import Pagination from "@/components/Pagination";
import CohortTrackFilter, { matchesCohortTrack, useCohortTrackFilter } from "@/components/admin/CohortTrackFilter";
import ManageInternDialog, {
  type InternOptions,
  type ManagedIntern,
} from "@/components/ManageInternDialog";

type InternRow = {
  id: string;
  name: string;
  email: string;
  profile: string;
  track: string;
  progress: number;
  lastActive: string;
  enrollmentDate: string;
  tier: string;
  cohort: string;
  learning: "Self-paced" | "Cohort" | "Waiting" | "Choosing";
  status: string;
  examScore: number | null;
} & ManagedIntern;

const pageSize = 8;

export default function InternshipInternsPage() {
  const [interns, setInterns] = useState<InternRow[]>([]);
  const [query, setQuery] = useState("");
  const [cohortTrack, setCohortTrack] = useCohortTrackFilter("admin-interns");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [learningFilter, setLearningFilter] = useState("All");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<InternOptions | null>(null);
  const [managing, setManaging] = useState<InternRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/admin/internship/interns", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(
              `Intern data request failed (${response.status}).`,
            );
          const payload = (await response.json()) as {
            interns?: InternRow[];
            options?: InternOptions;
          };
          setInterns(payload.interns ?? []);
          setOptions(payload.options ?? null);
          setLoaded(true);
        })
        .catch((reason) => {
          setError(
            reason instanceof Error
              ? reason.message
              : "Intern data is unavailable.",
          );
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);


  const filteredInterns = useMemo(() => {
    const searchQuery = query.trim().toLowerCase();
    return interns.filter((intern) => {
      const isRemoved = intern.status === "REMOVED";
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Removed" ? isRemoved : !isRemoved);
      const searchValue =
        `${intern.name} ${intern.email} ${intern.track} ${intern.cohort} ${intern.status}`.toLowerCase();
      return (
        matchesCohortTrack(cohortTrack, { cohortId: intern.cohortId, trackName: intern.track }) &&
        matchesStatus &&
        (learningFilter === "All" || intern.learning === learningFilter) &&
        (!searchQuery || searchValue.includes(searchQuery))
      );
    });
  }, [cohortTrack, interns, query, statusFilter, learningFilter]);

  // Cohorts with their track names, for the filter.
  const cohortOptions = useMemo(() => {
    const trackNames = new Map((options?.tracks ?? []).map((t) => [t.id, t.name]));
    return (options?.cohorts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      programName: trackNames.get(c.programId) ?? "Other",
      startDate: c.startDate,
      endDate: c.endDate,
    }));
  }, [options]);

  const totalPages = Math.max(1, Math.ceil(filteredInterns.length / pageSize));
  const visibleInterns = filteredInterns.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const summary = useMemo(() => {
    // Removed interns don't count towards the totals.
    const counted = interns.filter((intern) => intern.status !== "REMOVED");
    const avgProgress = counted.length
      ? Math.round(
          counted.reduce((sum, intern) => sum + intern.progress, 0) / counted.length,
        )
      : 0;
    const passedExamCount = counted.filter(
      (intern) => (intern.examScore ?? 0) >= 70,
    ).length;
    return {
      total: counted.length,
      avgProgress,
      passRate: counted.length
        ? Math.round((passedExamCount / counted.length) * 100)
        : 0,
    };
  }, [interns]);

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
              Internship operations
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
              Interns
            </h1>
            <p className="mt-2 text-xs text-slate-500">
              Accepted interns who completed onboarding, passed the exam, and
              paid the acceptance fee.
            </p>
          </div>
          <div className="rounded-xl bg-[#e8faf7] px-3 py-2 text-right text-[#14204f]">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#1C1D52]/70">
              Accepted interns
            </p>
            <p className="mt-1 text-lg font-bold">{summary.total}</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Sparkles}
            label="Average progress"
            value={`${summary.avgProgress}%`}
            accent="green"
          />
          <StatCard
            icon={TrendingUp}
            label="Exam pass rate"
            value={`${summary.passRate}%`}
            accent="blue"
          />
          <StatCard
            icon={ShieldCheck}
            label="Onboarded & paid"
            value={String(summary.total)}
            accent="purple"
          />
        </div>

        {error && (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && !interns.length && (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            {loaded ? "No interns yet." : "Loading intern roster…"}
          </p>
        )}

        {notice && (
          <p
            className="flex items-start justify-between gap-3 rounded-xl bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]"
            role="status"
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-[#397d3a]/70"
              aria-label="Dismiss"
            >
              ×
            </button>
          </p>
        )}

        {interns.length > 0 && (
          <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
            <div className="flex flex-col gap-3 pb-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex w-full max-w-[330px] items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-slate-400">
                <Search className="h-3.5 w-3.5" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  placeholder="Search by name, email, or track"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <CohortTrackFilter
                  cohorts={cohortOptions}
                  tracks={interns.map((intern) => intern.track)}
                  value={cohortTrack}
                  onChange={(next) => {
                    setCohortTrack(next);
                    setPage(1);
                  }}
                  storageKey="admin-interns"
                />
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(next) => {
                    setStatusFilter(next);
                    setPage(1);
                  }}
                  options={["Active", "Removed", "All"]}
                />
                <FilterSelect
                  label="Learning"
                  value={learningFilter}
                  onChange={(next) => {
                    setLearningFilter(next);
                    setPage(1);
                  }}
                  options={["All", "Self-paced", "Cohort", "Waiting", "Choosing"]}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="bg-[#f5f8fb] text-slate-600">
                    <th className="px-3 py-3 font-semibold">Intern</th>
                    <th className="px-3 py-3 font-semibold">Profile</th>
                    <th className="px-3 py-3 font-semibold">Email</th>
                    <th className="px-3 py-3 font-semibold">Track</th>
                    <th className="px-3 py-3 font-semibold">Tier</th>
                    <th className="px-3 py-3 font-semibold">Cohort</th>
                    <th className="px-3 py-3 font-semibold">Progress</th>
                    <th className="px-3 py-3 font-semibold">Exam score</th>
                    <th className="px-3 py-3 font-semibold">Last active</th>
                    <th className="px-3 py-3 font-semibold">Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInterns.map((intern) => (
                    <tr
                      key={intern.applicationId}
                      className={`border-b border-slate-100 text-[#1C1D52] align-top ${intern.status === "REMOVED" ? "bg-slate-50 opacity-70" : ""}`}
                    >
                      <td className="px-3 py-3.5">
                        <div>
                          <p className="font-bold">{intern.name}</p>
                          {intern.status === "REMOVED" && (
                            <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-600">
                              Removed
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setManaging(intern)}
                            disabled={!options}
                            className="mt-2 flex items-center gap-1 rounded-lg bg-[#1C1D52] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                          >
                            <Settings2 className="h-3 w-3" /> Manage
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.profile}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.email}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.track}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="rounded-full bg-[#eef4ff] px-2 py-1 font-semibold text-[#1C1D52]">
                          {intern.tier}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.learning === "Cohort" ? intern.cohort : (
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${intern.learning === "Self-paced" ? "bg-emerald-100 text-emerald-700" : intern.learning === "Waiting" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                            {intern.learning === "Waiting" ? "Waiting for cohort" : intern.learning}
                          </span>
                        )}
                        {intern.group && (
                          <span className="mt-1 block text-[9px] text-slate-400">
                            Group {intern.group.number}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#5FBB46]"
                              style={{
                                width: `${Math.min(100, Math.max(0, intern.progress))}%`,
                              }}
                            />
                          </div>
                          <span className="font-semibold">
                            {intern.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`rounded-full px-2 py-1 font-semibold ${intern.examScore !== null && intern.examScore >= 70 ? "bg-[#e8faf7] text-teal-600" : "bg-[#fff0d8] text-amber-600"}`}
                        >
                          {intern.examScore !== null
                            ? `${intern.examScore}%`
                            : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.lastActive}
                      </td>
                      <td className="px-3 py-3.5 text-slate-600">
                        {intern.enrollmentDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 pt-4 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredInterns.length ? (page - 1) * pageSize + 1 : 0}
                -{Math.min(page * pageSize, filteredInterns.length)} of{" "}
                {filteredInterns.length} interns
              </span>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </section>
        )}
      </div>
      {managing && options && (
        <ManageInternDialog
          key={managing.applicationId}
          intern={managing}
          options={options}
          onClose={() => setManaging(null)}
          onSaved={(message) => {
            setManaging(null);
            setNotice(`${managing.name}: ${message}`);
            void load();
          }}
        />
      )}
    </AdminShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  accent: "green" | "blue" | "purple";
}) {
  const accentMap = {
    green: "bg-[#e8faf7] text-[#1a8d73]",
    blue: "bg-[#edf3ff] text-[#2c59c7]",
    purple: "bg-[#f2ecff] text-[#5d49c6]",
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentMap[accent]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-xl font-bold text-[#1C1D52]">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="relative flex w-fit items-center">
      <span className="sr-only">Filter by {label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 appearance-none rounded-lg px-3 pr-8 text-[10px] font-semibold text-[#1C1D52] shadow-[inset_0_0_0_1px_#d8dee8] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label}: {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" />
    </label>
  );
}
