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
        setResult(data);
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
            ? <>You completed your optional skills assessment and scored <strong className="text-[#1C1D52]">{result.scorePercent}%</strong>. Ready to start your {result.programName} internship journey? Complete your payment to get started.</>
            : <>Your application is ready. You can skip the assessment and go straight to payment. Complete your payment to start your {result.programName} internship journey.</>}
        </p>

        {result.assessmentTaken && result.score !== null && result.totalQuestions !== null && (
          <p className="mt-4 inline-flex rounded-full bg-[#f3f6fb] px-4 py-2 text-xs font-semibold text-[#1C1D52]">
            Skills check: {result.score}/{result.totalQuestions} correct
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push(result.acceptanceFeePaid ? "/internship/dashboard" : "/internship/payment")}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:-translate-y-px sm:w-auto"
        >
          {result.acceptanceFeePaid ? "Go to your dashboard" : "Complete payment"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {result.assessmentTaken && result.answerReview.length > 0 && (
        <section className="mx-auto mt-5 max-w-xl rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-8">
          <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5FBB46]">Optional assessment</p>
              <h2 className="mt-1 text-lg font-bold text-[#1C1D52]">Your answers and the correct answers</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {result.answerReview.filter((answer) => answer.isCorrect).length}/{result.answerReview.length} correct
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {result.answerReview.map((answer, index) => (
              <article key={answer.questionId} className="rounded-xl border border-slate-200 bg-[#f8fbff] p-4">
                <p className="text-xs font-bold leading-5 text-[#1C1D52]">{index + 1}. {answer.question}</p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <p className={`rounded-lg px-3 py-2 ${answer.isCorrect ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}>
                    <span className="font-semibold">Your answer:</span> {answer.selectedAnswer}
                  </p>
                  <p className="rounded-lg bg-[#e8f7eb] px-3 py-2 text-[#397d3a]">
                    <span className="font-semibold">Correct answer:</span> {answer.correctAnswer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {!result.acceptanceFeePaid && (
        <CommunityInvite
          location="results_page"
          className="mx-auto mt-5 max-w-xl"
          title="Have questions before you pay?"
          description="Join our WhatsApp community to learn more about the programme and hear from current interns before you secure your place."
        />
      )}
    </main>
  );
}
