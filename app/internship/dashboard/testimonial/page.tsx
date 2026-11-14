"use client";

import InternshipShell from "@/components/InternshipShell";
import ExperienceForm from "@/components/graduation/ExperienceForm";
import GraduationFlyerButton from "@/components/graduation/GraduationFlyerButton";
import { useGraduation } from "@/components/graduation/graduation-data";

// Graduation & testimonial: graduates reach their flyer here (the pop-up),
// and any intern can share their experience: a video in the Google Drive
// folder, a voice note, or writing (components/graduation/ExperienceForm).

export default function InternTestimonialPage() {
  const { data, loaded } = useGraduation();

  return (
    <InternshipShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">Graduation &amp; testimonial</h1>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Share your experience of the internship{data ? ` on ${data.trackName}` : ""}. A short video is the best way
            to inspire future interns.
          </p>
        </div>

        <GraduationFlyerButton />

        {!loaded && <p className="text-xs text-slate-500">Loading…</p>}
        {loaded && !data && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Unable to load this page. Please refresh and try again.
          </p>
        )}
        {data && (
          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
            <ExperienceForm data={data} />
          </section>
        )}
      </div>
    </InternshipShell>
  );
}
