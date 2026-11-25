"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import DeleteAccountButton from "@/components/admin/DeleteAccountButton";

type Enrollee = {
  userId: string;
  applicationId: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  gender: string | null;
  institution: string | null;
  studyProgram: string | null;
  track: string;
  cohort: string;
  examScore: number | null;
  attempts: number;
  paymentStatus: string;
  appliedOn: string | null;
  onboardingUpdatedOn: string | null;
};

type OnboardingResponse = {
  id: string;
  prompt: string;
  answer: string | null;
  retired: boolean;
};

const paymentLabels: Record<string, string> = {
  NOT_STARTED: "Awaiting payment",
  PENDING: "Acceptance fee pending",
  FAILED: "Payment failed",
  CANCELLED: "Payment cancelled",
  PAID: "Paid",
};

export default function EnrolleeOnboardingReviewPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const router = useRouter();
  const [enrollee, setEnrollee] = useState<Enrollee | null>(null);
  const [responses, setResponses] = useState<OnboardingResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/internship/enrollees/${applicationId}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This enrollee could not be found."
              : `Enrollee request failed (${response.status}).`,
          );
        const payload = (await response.json()) as {
          enrollee: Enrollee;
          responses: OnboardingResponse[];
        };
        setEnrollee(payload.enrollee);
        setResponses(payload.responses);
      })
      .catch((reason) => {
        setError(
          reason instanceof Error ? reason.message : "Enrollee is unavailable.",
        );
      });
  }, [applicationId]);

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1100px] space-y-5">
        <Link
          href="/admin/internship/enrollees"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-[#5FBB46]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to enrollees
        </Link>

        {error && (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && !enrollee && (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500">
            Loading onboarding details…
          </p>
        )}

        {enrollee && (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
                  Onboarding review
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
                  {enrollee.name}
                </h1>
                <p className="mt-2 text-xs text-slate-500">{enrollee.email}</p>
              </div>
              <span className="w-fit rounded-full bg-[#edf3ff] px-3 py-1.5 text-[10px] font-semibold text-[#1C1D52]">
                {paymentLabels[enrollee.paymentStatus] ?? enrollee.paymentStatus}
              </span>
            </header>

            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <section className="h-fit rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
                <h2 className="text-sm font-semibold text-[#1C1D52]">
                  Enrollee details
                </h2>
                <dl className="mt-4 space-y-3 text-xs">
                  <Detail label="Track" value={enrollee.track} />
                  <Detail label="Cohort" value={enrollee.cohort} />
                  <Detail
                    label="Latest exam score"
                    value={
                      enrollee.examScore !== null
                        ? `${enrollee.examScore}%`
                        : null
                    }
                  />
                  <Detail label="Exam attempts" value={String(enrollee.attempts)} />
                  <Detail label="Phone" value={enrollee.phone} />
                  <Detail label="Location" value={enrollee.location} />
                  <Detail label="Gender" value={enrollee.gender} />
                  <Detail label="Institution" value={enrollee.institution} />
                  <Detail label="Course of study" value={enrollee.studyProgram} />
                  <Detail label="Applied on" value={enrollee.appliedOn} />
                  <Detail
                    label="Last updated"
                    value={enrollee.onboardingUpdatedOn}
                  />
                </dl>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <DeleteAccountButton
                    userId={enrollee.userId}
                    name={enrollee.name}
                    onDeleted={() => router.replace("/admin/internship/enrollees")}
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
                <h2 className="text-sm font-semibold text-[#1C1D52]">
                  Onboarding answers
                </h2>
                {responses.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-500">
                    No onboarding questions or answers were found for this
                    enrollee.
                  </p>
                ) : (
                  <ol className="mt-4 divide-y divide-slate-100">
                    {responses.map((response, index) => (
                      <li className="py-4 first:pt-0 last:pb-0" key={response.id}>
                        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1C1D52]">
                          <span className="text-slate-400">{index + 1}.</span>
                          {response.prompt}
                          {response.retired && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                              No longer asked
                            </span>
                          )}
                        </p>
                        <p
                          className={`mt-2 whitespace-pre-line text-xs leading-6 ${response.answer ? "text-slate-600" : "italic text-slate-400"}`}
                        >
                          {response.answer ?? "No answer given"}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </dt>
      <dd className={`mt-0.5 ${value ? "text-[#1C1D52]" : "text-slate-400"}`}>
        {value ?? "Not provided"}
      </dd>
    </div>
  );
}
