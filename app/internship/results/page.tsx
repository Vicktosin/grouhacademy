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
  "left-[12%] top-8 bg-[#5FBB46]",
  "left-[27%] top-3 bg-[#f0be43]",
  "left-[47%] top-7 bg-[#ff8e72]",
  "right-[28%] top-2 bg-[#8b9cff]",
  "right-[12%] top-9 bg-[#5FBB46]",
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

  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-[#F0F7FF] px-5 py-10 sm:px-8 sm:py-14">
      <div className="relative mx-auto max-w-xl overflow-hidden rounded-2xl bg-white px-7 py-10 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:px-12 sm:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 overflow-hidden">
          {confetti.map((position, index) => (
            <span
              key={position}
              className={`absolute h-2.5 w-2.5 rounded-sm opacity-80 ${position} ${index % 2 ? "animate-bounce" : "animate-pulse"}`}
            />
          ))}
        </div>
        <div className="mx-auto flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-[#e8f7eb] text-[#5FBB46]">
          {result.assessmentTaken ? (
            <Sparkles className="h-8 w-8" />
          ) : (
            <CheckCircle2 className="h-8 w-8" />
          )}
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
          Your internship journey starts here
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#1C1D52] sm:text-3xl">
          Wow, congratulations!
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {result.assessmentTaken && result.scorePercent !== null
            ? <>You&apos;re done with your onboarding and scored <strong className="text-[#1C1D52]">{result.scorePercent}%</strong> on your assessment.</>
            : <>You&apos;re done with your onboarding process.</>}{" "}
          {result.acceptanceFeePaid
            ? "Your internship workspace is ready."
            : <>Complete your payment to start your {result.programName} internship.</>}
        </p>
      </div>

      {result.acceptanceFeePaid ? (
        <div className="mx-auto mt-5 max-w-xl text-center">
          <button
            type="button"
            onClick={() => router.push("/internship/dashboard")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f] sm:w-auto"
          >
            Go to your dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <section className="mx-auto mt-5 max-w-xl rounded-2xl bg-[#1C1D52] p-6 text-left text-white shadow-[0_8px_24px_rgba(28,29,82,0.15)] sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5FBB46]">Ready to start?</p>
            <h2 className="mt-1 text-lg font-bold">Complete your payment</h2>
            <p className="mt-1 text-sm text-white/75">
              Acceptance fee: <strong className="text-white">₦{result.acceptanceFee.toLocaleString()}</strong>
            </p>
            <button
              type="button"
              onClick={() => router.push("/internship/payment")}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:-translate-y-px"
            >
              Complete payment <ArrowRight className="h-4 w-4" />
            </button>
          </section>
          <CommunityInvite
            location="results_page"
            className="mx-auto mt-4 max-w-xl"
            title="Not ready to pay now?"
            description="Join our WhatsApp community to learn more about the programme and hear from current interns."
          />
        </>
      )}
    </main>
  );
}
