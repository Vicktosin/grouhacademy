import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import TracksExplorer from "@/components/TracksExplorer";
import { CURRICULUM } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Internship Tracks and Curriculum",
  description:
    "See every SabiRole internship track and its full curriculum: 5 levels, 4 weeks each, with Practice Lab and Office Life every week.",
  alternates: { canonical: "/tracks" },
};

const HOW_IT_WORKS = [
  {
    title: "Every week",
    text: "You get a main task, a Practice Lab to try what you learned, and an Office Life day that feels like a real workday.",
  },
  { title: "With a cohort", text: "You follow the calendar with your group. Each week opens on Monday and is due on Sunday." },
  { title: "Self-paced", text: "You start when you like and go at your own speed. Finish a week and the next one opens." },
  {
    title: "In-app and Out-app",
    text: "In-app work is done inside SabiRole and marked automatically. Out-app work uses other tools, and you submit text or a link.",
  },
];

export default function TracksPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fc] text-[#141650]">
      <section className="bg-[#141650] text-white">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
          <Breadcrumbs current="Tracks" dark />
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">Our internship tracks</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg">
            {CURRICULUM.length} tracks, 5 levels each, 4 weeks per level. Pick a track to see what you will do each week.
          </p>
          <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {HOW_IT_WORKS.map(({ title, text }) => (
              <div key={title}>
                <dt className="font-bold text-[#8edb70]">{title}</dt>
                <dd className="mt-1 text-sm leading-6 text-white/75">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <TracksExplorer tracks={CURRICULUM} />
    </main>
  );
}
