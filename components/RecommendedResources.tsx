"use client";

import { ArrowRight, BookOpen, CheckCircle2, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Recommended = {
  programName: string | null;
  levelName: string | null;
  curated: boolean;
  resources: Array<{
    slug: string;
    title: string;
    description: string | null;
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
  }>;
};

/**
 * "Recommended for you" on the intern dashboard: resources for the intern's
 * track and level, chosen by admins (or the newest at their level). Hidden
 * when there's nothing to show.
 */
export default function RecommendedResources() {
  const [data, setData] = useState<Recommended | null>(null);

  useEffect(() => {
    fetch("/api/internship/resources/recommended", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data?.resources.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <Star className="h-4 w-4 text-[#5FBB46]" />
            {data.curated ? "Recommended for you" : "New for your level"}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {data.programName} · {data.levelName} level
          </p>
        </div>
        <Link
          href="/internship/dashboard/resources"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"
        >
          All resources <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.resources.map((resource) => (
          <li key={resource.slug}>
            <Link
              href={`/internship/dashboard/resources/${resource.slug}`}
              className="flex h-full flex-col rounded-xl border border-slate-200 p-4 transition hover:border-[#5FBB46] hover:bg-[#f8fbff]"
            >
              <span className="flex items-start gap-2">
                {resource.progressPercent === 100 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5FBB46]" />
                ) : (
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                )}
                <span className="text-xs font-bold text-[#1C1D52]">
                  {resource.title}
                </span>
              </span>
              {resource.description && (
                <span className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">
                  {resource.description}
                </span>
              )}
              <span className="mt-auto pt-3">
                <span className="flex justify-between text-[10px] text-slate-500">
                  <span>
                    {resource.completedLessons}/{resource.totalLessons} lessons
                  </span>
                  <span className="font-semibold">
                    {resource.progressPercent === 0
                      ? "Start"
                      : resource.progressPercent === 100
                        ? "Done"
                        : `${resource.progressPercent}%`}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-[#5FBB46]"
                    style={{ width: `${resource.progressPercent}%` }}
                  />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
