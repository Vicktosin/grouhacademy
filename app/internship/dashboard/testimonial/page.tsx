"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import InternshipShell from "@/components/InternshipShell";
import ExperienceForm from "@/components/graduation/ExperienceForm";
import GraduationFlyerButton from "@/components/graduation/GraduationFlyerButton";
import { useGraduation } from "@/components/graduation/graduation-data";

// Graduation & testimonial: graduates reach their flyer here (the pop-up),
// and any intern can share their experience: a video in the Google Drive
// folder, a voice note, or writing (components/graduation/ExperienceForm).
// A graduate must share it before downloading their certificate; the
// certificate page sends them here with ?next= to return to it afterwards.

/** Only pages inside the internship dashboard (never another site). */
function safeNext(value: string | null) {
  return value && /^\/internship\/dashboard(\/[\w-]*)*$/.test(value) ? value : null;
}

export default function InternTestimonialPage() {
  const { data, loaded } = useGraduation();
  const router = useRouter();
  const required = Boolean(data?.graduated && !data.isPreview && !data.experienceShared);
  // After sharing, a graduate goes on to their certificate (or ?next=).
  const continueTo = data?.graduated
    ? () =>
        router.push(
          safeNext(new URLSearchParams(window.location.search).get("next")) ?? "/internship/dashboard/certificate",
        )
    : undefined;

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

        {required && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Your certificate is waiting.</strong> Tell us about your experience below (a video, a voice note
              or writing) to unlock your certificate download.
            </span>
          </p>
        )}

        <GraduationFlyerButton />

        {!loaded && <p className="text-xs text-slate-500">Loading…</p>}
        {loaded && !data && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Unable to load this page. Please refresh and try again.
          </p>
        )}
        {data && (
          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
            <ExperienceForm
              data={data}
              onDone={continueTo}
              doneLabel={continueTo ? "Continue to my certificate" : undefined}
            />
          </section>
        )}
      </div>
    </InternshipShell>
  );
}
