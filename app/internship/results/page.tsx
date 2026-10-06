"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import CommunityInvite, { WhatsAppIcon } from "@/components/CommunityInvite";
import CommunityLink from "@/components/CommunityLink";

type Result = {
  programName: string;
  levelName: string;
  /** Open levels below this one, offered after a fail. */
  lowerLevels: Array<{ id: string; name: string; acceptanceFee: number }>;
  scorePercent: number;
  score: number;
  totalQuestions: number;
  passed: boolean;
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

export default function AssessmentResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [showPassModal, setShowPassModal] = useState(false);

  useEffect(() => {
    fetch("/api/internship/assessment/result")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No result found.");
        setResult(data);
        setShowPassModal(Boolean(data.passed && !data.acceptanceFeePaid));
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "No result found.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function retryAssessment() {
    setRetrying(true);
    try {
      const response = await fetch("/api/internship/assessment/start", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to start a new attempt.");
      router.push("/internship/assessment/take");
    } catch {
      setRetrying(false);
    }
  }

  async function switchToLevel(levelId: string) {
    setSwitchingTo(levelId);
    setActionError("");
    try {
      const response = await fetch("/api/internship/application/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Unable to change your level.");
      router.push("/internship/assessment/readiness");
    } catch (switchError) {
      setActionError(
        switchError instanceof Error
          ? switchError.message
          : "Unable to change your level.",
      );
      setSwitchingTo(null);
    }
  }

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
          {error || "No result found."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-[#F0F7FF] px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-12">
        {result.passed && !result.acceptanceFeePaid ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-[#5FBB46]" />
        ) : result.passed ? (
          <button
            type="button"
            onClick={() => router.push("/internship/dashboard")}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f]"
          >
            Go to workspace <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <XCircle className="mx-auto h-14 w-14 text-red-400" />
        )}
        <h1 className="mt-5 text-2xl font-bold text-[#1C1D52]">
          {result.passed ? "Hooray, you qualified!" : "Not quite there yet"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          You scored{" "}
          <strong className="text-[#1C1D52]">{result.scorePercent}%</strong> (
          {result.score}/{result.totalQuestions}) on the {result.programName}{" "}
          {result.levelName} level assessment.
          {result.passed
            ? " You are qualified for this internship program."
            : result.lowerLevels.length
              ? " You can try again whenever you're ready, or start at a lower level."
              : " You can try again whenever you're ready."}
        </p>

        <section className="mt-8 text-left">
          <div className="flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#5FBB46]">
                Answer review
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#1C1D52]">
                Your answers and the correct answers
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {result.answerReview.filter((answer) => answer.isCorrect).length}/
              {result.answerReview.length} correct
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {result.answerReview.map((answer, index) => (
              <article
                key={answer.questionId}
                className="rounded-xl border border-slate-200 bg-[#f8fbff] p-4"
              >
                <p className="text-xs font-bold leading-5 text-[#1C1D52]">
                  {index + 1}. {answer.question}
                </p>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <p
                    className={`rounded-lg px-3 py-2 ${answer.isCorrect ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}
                  >
                    <span className="font-semibold">Your answer:</span>{" "}
                    {answer.selectedAnswer}
                  </p>
                  <p className="rounded-lg bg-[#e8f7eb] px-3 py-2 text-[#397d3a]">
                    <span className="font-semibold">Correct answer:</span>{" "}
                    {answer.correctAnswer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {result.passed ? (
          <button
            type="button"
            onClick={() => setShowPassModal(true)}
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3.5 text-sm font-bold text-[#14204f]"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={retryAssessment}
              disabled={retrying || switchingTo !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-6 py-3.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {retrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Retry {result.levelName} Assessment
                </>
              )}
            </button>
            {result.lowerLevels.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => void switchToLevel(level.id)}
                disabled={retrying || switchingTo !== null}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-50 disabled:opacity-60"
              >
                {switchingTo === level.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
                Apply for {level.name} level instead (₦
                {level.acceptanceFee.toLocaleString()})
              </button>
            ))}
            {actionError && (
              <p className="text-xs font-semibold text-red-600" role="alert">
                {actionError}
              </p>
            )}
          </div>
        )}
      </div>

      {!result.acceptanceFeePaid && (
        <CommunityInvite
          location="results_page"
          className="mx-auto mt-5 max-w-xl"
          title={
            result.passed
              ? "Have questions before you pay?"
              : "Prepare for your next attempt"
          }
          description={
            result.passed
              ? "Join our WhatsApp community to learn more about the programme and hear from current interns before you secure your place."
              : "Join our WhatsApp community for preparation tips and support from other applicants and interns."
          }
        />
      )}

      {result.passed && !result.acceptanceFeePaid && showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white text-center shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <div className="bg-[#1C1D52] px-6 pb-8 pt-7 text-white">
              <span className="inline-flex items-center rounded-full border border-[#9be28a]/40 bg-[#9be28a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
                Qualified
              </span>
              <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7eb] text-[#5FBB46]">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <div className="px-7 pb-7 pt-6">
              <h2 className="text-2xl font-bold text-[#1C1D52]">
                Well done! You did well.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Are you ready to get started with your internship?
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => router.push("/internship/payment")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-6 py-3 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:translate-y-[-1px]"
                >
                  Pay acceptance fee <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-50"
                >
                  Review results
                </button>
              </div>
              <CommunityLink
                location="results_popup"
                className="mt-6 inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 transition hover:text-[#1C1D52]"
              >
                <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
                Not ready yet?{" "}
                <span className="font-semibold text-[#1fae55] underline underline-offset-2">
                  Join our community
                </span>
              </CommunityLink>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
