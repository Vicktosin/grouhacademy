"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { taskPart, trackSlug, TRACK_DESCRIPTIONS, type CurriculumTrack } from "@/lib/curriculum-view";

// Every track's curriculum: pick a track, open a level, see its four weeks.
export default function TracksExplorer({ tracks }: { tracks: CurriculumTrack[] }) {
  const [slug, setSlug] = useState(trackSlug(tracks[0].track));

  // A link can open one track (/tracks?track=cybersecurity).
  useEffect(() => {
    const open = () => {
      const wanted = new URLSearchParams(window.location.search).get("track");
      if (wanted && tracks.some((item) => trackSlug(item.track) === wanted)) setSlug(wanted);
    };
    open();
    window.addEventListener("popstate", open);
    return () => window.removeEventListener("popstate", open);
  }, [tracks]);

  function pick(next: string) {
    setSlug(next);
    window.history.replaceState(null, "", `?track=${next}`);
  }

  const current = tracks.find((item) => trackSlug(item.track) === slug) ?? tracks[0];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <label className="block text-sm font-semibold text-[#141650] sm:hidden">
        Choose a track
        <select
          value={slug}
          onChange={(event) => pick(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base"
        >
          {tracks.map(({ track }) => (
            <option key={track} value={trackSlug(track)}>
              {track}
            </option>
          ))}
        </select>
      </label>
      <div className="hidden flex-wrap gap-2 sm:flex" role="group" aria-label="Choose a track">
        {tracks.map(({ track }) => {
          const selected = trackSlug(track) === slug;
          return (
            <button
              key={track}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(trackSlug(track))}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selected ? "border-[#141650] bg-[#141650] text-white" : "border-slate-300 bg-white text-[#141650] hover:border-[#4db848]"
              }`}
            >
              {track}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black text-[#141650] sm:text-3xl">{current.track}</h2>
          <p className="mt-2 text-slate-600">{TRACK_DESCRIPTIONS[current.track]}</p>
        </div>
        <Link
          href="/register"
          className="rounded-full bg-[#5FBB46] px-6 py-3 text-sm font-semibold text-[#14204f] transition hover:bg-[#4aaa3e]"
        >
          Apply now
        </Link>
      </div>

      <div key={slug} className="mt-6 space-y-3">
        {current.levels.map((level) => (
          <details
            key={level.level}
            open={level.level === 1}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white open:border-[#4db848]/60"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-xs text-slate-500">Level {level.level}</span>
                <span className="text-lg font-bold text-[#141650]">{level.name}</span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2fbf2] text-xl text-[#397d3a] transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="border-t border-slate-100 bg-[#f7f8fc] px-5 py-4 text-sm leading-6 text-[#141650]">
              <strong className="block">What you finish with</strong>
              {level.milestone}
            </p>
            <ol className="divide-y divide-slate-100 border-t border-slate-100">
              {level.weeks.map((week) => (
                <li key={week.week} className={`px-5 py-5 ${week.capstone ? "bg-[#f2fbf2]" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[#397d3a]">Week {week.week}</h3>
                    {week.capstone && (
                      <span className="rounded-full bg-[#141650] px-3 py-0.5 text-xs font-bold text-white">Capstone project</span>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-[#141650]">{week.topic.replace(/^(FINAL )?CAPSTONE( \d)?: ?/, "") || week.topic}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">By the end, you can {week.outcome}.</p>
                  <ul className="mt-3 space-y-3">
                    {week.tasks
                      .filter((task) => taskPart(task) !== "office")
                      .map((task) => (
                        <li key={task.title} className="text-sm leading-6 text-slate-700">
                          <span className="mb-1 flex flex-wrap gap-1.5">
                            <Tag tone={task.where === "In-app" ? "green" : "navy"}>{task.where}</Tag>
                            <Tag tone="grey">{task.kind}</Tag>
                          </span>
                          {taskPart(task) === "lab" ? "Practice Lab on this week's topic" : task.instructions}
                        </li>
                      ))}
                    <li className="text-sm leading-6 text-slate-700">
                      <span className="mb-1 flex flex-wrap gap-1.5">
                        <Tag tone="green">In-app</Tag>
                        <Tag tone="grey">Practical</Tag>
                      </span>
                      Office Life Day {week.officeLifeDay}
                    </li>
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  );
}

const TONES = {
  green: "bg-[#e3f6df] text-[#245c17]",
  navy: "bg-[#e7e8f6] text-[#141650]",
  grey: "bg-slate-100 text-slate-600",
};

function Tag({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}
