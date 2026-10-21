"use client";

import {
  AlertTriangle,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  PhoneCall,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

// The Support Admin dashboard: people and progress only, never money
// (app/api/support/dashboard).

type SupportDashboard = {
  overview: {
    registered: number;
    registeredThisWeek: number;
    admitted: number;
    examTakers: number;
    examPassRate: number;
    averageProgress: number;
    atRisk: number;
    activeTracks: number;
  };
  tracks: Array<{
    id: string;
    name: string;
    registered: number;
    admitted: number;
    averageProgress: number;
  }>;
  cohorts: Array<{
    id: string;
    name: string;
    track: string;
    level: string;
    startDate: string;
    endDate: string;
    running: boolean;
    interns: number;
    groups: number;
  }>;
  groups: { total: number; paused: number };
  followUps: {
    total: number;
    notContacted: number;
    contactedByAdmins: number;
    contactedBySupport: number;
    dueToday: number;
    interested: number;
  };
  resources: {
    published: number;
    waitingForReview: number;
    myDrafts: number;
    myWaitingForReview: number;
    myPublished: number;
  };
};

const number = (value: number) => value.toLocaleString("en-US");
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function SupportAdminDashboard() {
  const [data, setData] = useState<SupportDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/support/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(body?.error ?? "Dashboard data is unavailable.");
        setData(body as SupportDashboard);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Dashboard data is unavailable.",
        ),
      );
  }, []);

  const overview = data && [
    { icon: UserPlus, value: number(data.overview.registered), label: "Registered enrollees", detail: `${number(data.overview.registeredThisWeek)} in the last 7 days` },
    { icon: Users, value: number(data.overview.admitted), label: "Admitted interns", detail: "Paid and in the internship" },
    { icon: ClipboardCheck, value: `${data.overview.examPassRate}%`, label: "Entrance exam pass rate", detail: `${number(data.overview.examTakers)} exams taken` },
    { icon: TrendingUp, value: `${data.overview.averageProgress}%`, label: "Average intern progress", detail: `${number(data.overview.atRisk)} below 40%` },
  ];

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <section className="rounded-[28px] bg-[#5FBB46] px-6 py-6 text-[#14204f] shadow-[0_12px_30px_rgba(95,187,70,0.2)] sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#14204f]/70">
                Support Admin workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
                Internship at a glance
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/support/follow-ups"
                className="rounded-lg bg-white px-4 py-2.5 text-[10px] font-semibold text-[#14204f]"
              >
                Follow up applicants
              </Link>
              <Link
                href="/support/resources/new"
                className="rounded-lg bg-[#1C1D52] px-4 py-2.5 text-[10px] font-semibold text-white"
              >
                Add a resource
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">
            {error}
          </p>
        )}
        {!error && !data && (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            Loading dashboard…
          </p>
        )}

        {data && overview && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {overview.map(({ icon: Icon, value, label, detail }) => (
                <div key={label} className="rounded-xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#dceeff] text-blue-500">
                    <Icon className="h-4 w-4" />
                  </span>
                  <strong className="mt-4 block text-xl text-[#1C1D52]">{value}</strong>
                  <span className="mt-1 block text-[10px] font-semibold text-[#1C1D52]">{label}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{detail}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                icon={PhoneCall}
                title="Follow-ups"
                description="Applicants who sat the exam or started paying but haven't paid yet."
                href="/support/follow-ups"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat value={data.followUps.total} label="To follow up" />
                  <Stat value={data.followUps.notContacted} label="Not contacted yet" tone={data.followUps.notContacted ? "warning" : undefined} />
                  <Stat value={data.followUps.dueToday} label="Due today" tone={data.followUps.dueToday ? "warning" : undefined} />
                  <Stat value={data.followUps.contactedBySupport} label="Contacted by Support Admins" />
                  <Stat value={data.followUps.contactedByAdmins} label="Contacted by the admin team" />
                  <Stat value={data.followUps.interested} label="Interested" tone="success" />
                </div>
              </Panel>

              <Panel
                icon={BookOpen}
                title="Resources"
                description="Your resources go live once an administrator publishes them."
                href="/support/resources"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat value={data.resources.myDrafts} label="Your drafts" />
                  <Stat value={data.resources.myWaitingForReview} label="Yours waiting for review" tone={data.resources.myWaitingForReview ? "warning" : undefined} />
                  <Stat value={data.resources.myPublished} label="Yours published" tone="success" />
                  <Stat value={data.resources.published} label="Published in total" />
                  <Stat value={data.resources.waitingForReview} label="Waiting for review in total" />
                </div>
              </Panel>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <Panel
                icon={GraduationCap}
                title="Tracks"
                description={`${data.overview.activeTracks} published track${data.overview.activeTracks === 1 ? "" : "s"}: enrollees, admitted interns and average progress.`}
              >
                {data.tracks.length === 0 ? (
                  <p className="text-xs text-slate-500">No published tracks yet.</p>
                ) : (
                  <div className="space-y-4">
                    {data.tracks.map((track) => (
                      <div key={track.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-[#1C1D52]">
                          <span>{track.name}</span>
                          <span className="font-normal text-slate-500">
                            {number(track.registered)} enrollees · {number(track.admitted)} admitted · {track.averageProgress}% progress
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#5FBB46]"
                            style={{ width: `${Math.min(100, track.averageProgress)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                icon={UsersRound}
                title="Groups"
                description="Group discussions you can message, open and pause."
                href="/support/groups"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Stat value={data.groups.total} label="Groups" />
                  <Stat value={data.groups.paused} label="Discussions paused" tone={data.groups.paused ? "warning" : undefined} />
                </div>
                {data.overview.atRisk > 0 && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {number(data.overview.atRisk)} intern{data.overview.atRisk === 1 ? " is" : "s are"} below 40% progress. A group message can help them catch up.
                  </p>
                )}
              </Panel>
            </div>

            <Panel
              icon={CalendarRange}
              title="Cohorts"
              description="Running and upcoming cohorts."
            >
              {data.cohorts.length === 0 ? (
                <p className="text-xs text-slate-500">No running or upcoming cohorts.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left">
                    <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Cohort</th>
                        <th className="px-3 py-2.5">Track · Level</th>
                        <th className="px-3 py-2.5">Dates</th>
                        <th className="px-3 py-2.5">Interns</th>
                        <th className="px-3 py-2.5">Groups</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] text-[#1C1D52]">
                      {data.cohorts.map((cohort) => (
                        <tr key={cohort.id} className="border-t border-slate-100">
                          <td className="px-3 py-2.5 font-semibold">
                            {cohort.name}
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-semibold ${cohort.running ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-[#eef3ff] text-[#1C1D52]"}`}>
                              {cohort.running ? "Running" : "Upcoming"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{cohort.track} · {cohort.level}</td>
                          <td className="px-3 py-2.5 text-slate-600">{date(cohort.startDate)} – {date(cohort.endDate)}</td>
                          <td className="px-3 py-2.5">{number(cohort.interns)}</td>
                          <td className="px-3 py-2.5">{number(cohort.groups)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  href,
  children,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e8f7eb] text-[#397d3a]">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">{title}</h2>
            <p className="mt-1 text-[10px] text-slate-500">{description}</p>
          </div>
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-[10px] font-bold text-[#5FBB46]">
            Open
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "warning" | "success";
}) {
  const color =
    tone === "warning"
      ? "bg-amber-50 text-amber-900"
      : tone === "success"
        ? "bg-[#e8f7eb] text-[#397d3a]"
        : "bg-[#f8fbff] text-[#1C1D52]";
  return (
    <div className={`rounded-xl px-3 py-3 ${color}`}>
      <strong className="block text-lg">{number(value)}</strong>
      <span className="text-[10px]">{label}</span>
    </div>
  );
}
