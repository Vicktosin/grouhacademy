import Link from "next/link";
import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getPublicTracks } from "@/lib/public-tracks";

export const metadata: Metadata = {
  title: "Internship Tracks and Curriculum",
  description:
    "See every SabiRole internship track and its full curriculum, level by level and week by week.",
  alternates: { canonical: "/tracks" },
};

export const revalidate = 600;

export default async function TracksPage() {
  const tracks = await getPublicTracks();
  return (
    <main className="min-h-screen bg-[#f7f8fc] text-[#141650]">
      <section className="bg-[#141650] text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-20">
          <Breadcrumbs current="Tracks" dark />
          <h1 className="mt-8 max-w-2xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Our internship tracks.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            Every track and what you will work on, level by level and week by
            week.
          </p>
          {tracks.length > 0 && (
            <nav aria-label="Tracks" className="mt-8 flex flex-wrap gap-2">
              {tracks.map((track) => (
                <a
                  key={track.slug}
                  href={`#${track.slug}`}
                  className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {track.name}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-14 lg:px-8">
        {tracks.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
            The tracks can&apos;t be shown right now. Please check back shortly.
          </p>
        )}
        {tracks.map((track) => (
          <section
            key={track.slug}
            id={track.slug}
            className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <h2 className="text-2xl font-black sm:text-3xl">{track.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{track.description}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#397d3a]">
                  {track.levels.length} levels · {track.topicCount} topics
                </p>
              </div>
              <Link
                href="/register"
                className="rounded-full bg-[#5FBB46] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4aaa3e]"
              >
                Apply now
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {track.levels.map((level, index) => (
                <details
                  key={level.name}
                  open={index === 0}
                  className="group overflow-hidden rounded-2xl border border-slate-200 open:border-[#4db848]/50"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#397d3a]">
                        Module {index + 1}
                      </span>
                      <span className="text-base font-bold">{level.name}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2fbf2] text-xl text-[#397d3a] transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="grid gap-3 border-t border-slate-100 bg-[#fbfcff] p-4 sm:grid-cols-2 lg:grid-cols-4">
                    {level.weeks.map(({ week, topics }) => (
                      <article key={week} className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[#397d3a]">Week {week}</h3>
                        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-5 text-slate-700 marker:text-[#4db848]">
                          {topics.map((topic) => (
                            <li key={topic}>{topic}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
