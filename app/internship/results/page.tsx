"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import CommunityInvite from "@/components/CommunityInvite";

type Result = {
  programName: string;
  levelName: string;
  assessmentTaken: boolean;
  scorePercent: number | null;
  score: number | null;
  totalQuestions: number | null;
  acceptanceFee: number;
  acceptanceFeePaid: boolean;
  answerReview: Array<{
    questionId: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
  }>;
};

const confetti = [
  "left-[16%] top-3 bg-[#5FBB46]",
  "left-[58%] top-4 bg-[#f0be43]",
  "left-[74%] top-2 bg-[#ff8e72]",
  "right-[14%] top-5 bg-[#8b9cff]",
  "right-[5%] top-2 bg-[#5FBB46]",
];

export default function AssessmentResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/internship/assessment/result")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load your application.");
        // Someone who chose to skip never sees a score (even an old one).
        const skipped = new URLSearchParams(window.location.search).get("skipped") === "1";
        setResult(skipped ? { ...data, assessmentTaken: false, scorePercent: null, score: null } : data);
      })
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load your application."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-[#F0F7FF] px-5 py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center bg-[#F0F7FF] px-5 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm text-red-700">
          {error || "Unable to load your application."}
        </div>
      </main>
    );
  }

  // Kept short on purpose: both choices (pay, or join the community) must show
  // on a small phone without scrolling.
  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-[#F0F7FF] px-4 pb-4 sm:px-8 sm:pt-4">
      <div className="mx-auto flex max-w-xl flex-col gap-3 sm:gap-4">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:gap-4 sm:px-6 sm:py-4">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-8">
            {confetti.map((position, index) => (
              <span
                key={position}
                className={`absolute h-1.5 w-1.5 rounded-sm opacity-80 ${position} ${index % 2 ? "motion-safe:animate-bounce" : "motion-safe:animate-pulse"}`}
              />
            ))}
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f7eb] text-[#5FBB46]">
            {result.assessmentTaken ? <Sparkles className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-6 text-[#1C1D52] sm:text-xl">Congratulations!</h1>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600 sm:text-sm">
              You&apos;re done with your onboarding
              {result.assessmentTaken && result.scorePercent !== null && (
                <> and scored <strong className="text-[#1C1D52]">{result.scorePercent}%</strong></>
              )}
              .{result.acceptanceFeePaid && " Your internship workspace is ready."}
            </p>
          </div>
        </div>

        {result.acceptanceFeePaid ? (
          <button
            type="button"
            onClick={() => router.push("/internship/dashboard")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f]"
          >
            Go to your dashboard <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <section className="rounded-2xl bg-[#1C1D52] p-4 text-left text-white shadow-[0_8px_24px_rgba(28,29,82,0.15)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold leading-6 sm:text-lg">Complete your payment</h2>
                <p className="shrink-0 text-right text-xs text-white/75">
                  <strong className="block text-lg leading-6 text-white">₦{result.acceptanceFee.toLocaleString()}</strong>
                  Acceptance fee
                </p>
              </div>
              <p className="mt-1 text-[13px] leading-5 text-white/75 sm:text-sm">
                Start your {result.programName} internship.
              </p>
              <button
                type="button"
                onClick={() => router.push("/internship/payment")}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:-translate-y-px"
              >
                Complete payment <ArrowRight className="h-4 w-4" />
              </button>
            </section>
            <CommunityInvite
              compact
              location="results_page"
              title="Not ready to pay now?"
              description="Join our WhatsApp community and hear from current interns."
            />
          </>
        )}
      </div>
    </main>
  );
}
