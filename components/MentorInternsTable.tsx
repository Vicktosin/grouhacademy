"use client";

import { MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MentorBadge } from "@/components/MentorPage";

export type MentorInternRow = {
  key: string;
  internId: string;
  name: string;
  email: string;
  programName: string;
  cohortName: string | null;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
  needsAttention: boolean;
};

export default function MentorInternsTable({
  interns,
}: {
  interns: MentorInternRow[];
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? interns.filter((intern) =>
          `${intern.name} ${intern.email} ${intern.programName} ${intern.cohortName ?? ""}`
            .toLowerCase()
            .includes(needle),
        )
      : interns;
  }, [interns, query]);

  return (
    <>
      <div className="flex justify-end">
        <label className="flex items-center gap-2 rounded-full bg-[#f3f6fb] px-3 py-2 text-[10px] text-slate-400">
          <Search className="h-3.5 w-3.5" />
          <span className="sr-only">Search interns</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search interns"
            className="bg-transparent outline-none"
          />
        </label>
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="text-[10px] uppercase tracking-[0.1em] text-slate-400">
            <tr>
              <th className="pb-3">Intern</th>
              <th className="pb-3">Track</th>
              <th className="pb-3">Cohort</th>
              <th className="pb-3">Progress</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {visible.length === 0 && (
              <tr className="border-t border-slate-100">
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  {interns.length === 0
                    ? "No interns are assigned to you yet."
                    : "No interns match your search."}
                </td>
              </tr>
            )}
            {visible.map((intern) => (
              <tr key={intern.key} className="border-t border-slate-100">
                <td className="py-4">
                  <p className="font-bold text-[#1C1D52]">{intern.name}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {intern.email}
                  </p>
                </td>
                <td className="py-4 text-slate-500">{intern.programName}</td>
                <td className="py-4 text-slate-500">
                  {intern.cohortName ?? "Not assigned"}
                </td>
                <td className="py-4">
                  <p className="font-semibold text-[#1C1D52]">
                    {intern.progressPercent}%
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {intern.completedTasks} of {intern.totalTasks} tasks
                  </p>
                </td>
                <td className="py-4">
                  <MentorBadge tone={intern.needsAttention ? "amber" : "green"}>
                    {intern.needsAttention ? "Needs attention" : "On track"}
                  </MentorBadge>
                </td>
                <td className="py-4">
                  <Link
                    href={`/mentor/messages?intern=${intern.internId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-bold text-blue-600"
                  >
                    <MessageCircle className="h-3 w-3" />
                    Message
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
