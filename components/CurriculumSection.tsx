import Link from "next/link";
import type { PublicTrack } from "@/lib/public-tracks";

// Every internship track as a card; its full curriculum is on /tracks.
export default function CurriculumSection({ tracks }: { tracks: PublicTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <section id="curriculum" className="bg-[#f8f9fe] py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#397d3a]">Our tracks</p>
          <h2
            className="mt-3 text-3xl font-black leading-tight text-[#141650] sm:text-4xl lg:text-5xl"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Choose your track.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Open a track to see what you&apos;ll learn, week by week.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track) => (
            <Link
              key={track.slug}
              href={`/tracks#${track.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-[#4db848] hover:shadow-lg"
            >
              <h3 className="text-lg font-bold text-[#141650]">{track.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{track.description}</p>
              <p className="mt-4 text-xs font-semibold text-slate-500">
                {track.levels.length} levels · {track.topicCount} topics
              </p>
              <span className="mt-4 text-sm font-bold text-[#397d3a] group-hover:underline">View curriculum →</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
