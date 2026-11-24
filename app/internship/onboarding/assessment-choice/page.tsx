"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";
import FlowExitBar from "@/components/FlowExitBar";

type OnboardingData = {
  programs?: Array<{
    id: string;
    name: string;
    levels: Array<{ id: string; assessmentAvailable: boolean }>;
  }>;
  existingProgramId?: string | null;
  existingLevelId?: string | null;
};

export default function AssessmentChoicePage() {
  const router = useRouter();
  const [assessmentAvailable, setAssessmentAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/internship/onboarding")
      .then(async (response) => {
        const data = (await response.json()) as OnboardingData;
        if (!response.ok) throw new Error("Sign in to continue your application.");
        const program = data.programs?.find(
          (item) => item.id === data.existingProgramId,
        );
        const level = program?.levels.find(
          (item) => item.id === data.existingLevelId,
        );
        setAssessmentAvailable(Boolean(level?.assessmentAvailable));
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load your next step.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function takeAssessment() {
    setStarting(true);
    setError("");
    try {
      const response = await fetch("/api/internship/assessment/start", {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        router.push("/internship/results");
        return;
      }
      if (data.code === "ONBOARDING_REQUIRED") {
        router.replace("/internship/onboarding");
        return;
      }
      if (!response.ok)
        throw new Error(data.error || "Unable to start your assessment.");
      router.push("/internship/assessment/take");
    } catch (startError: unknown) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start your assessment.",
      );
      setStarting(false);
    }
  }

  function skipAssessment() {
    router.push("/internship/results?skipped=1");
  }

  return (
    <main className="min-h-dvh bg-[#F5F8FC]">
      <FlowExitBar backHref="/" backLabel="Back" onBack={() => router.push("/internship/onboarding?step=review")} />
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Step 5 of 5</span>
          <span className="text-[#2f7d52]">Choose your next step</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-full rounded-full bg-[#5FBB46]" />
        </div>

        <header className="mx-auto mt-8 max-w-xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f7eb] text-[#5FBB46]">
            <Sparkles className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
            You’re all set
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-tight text-[#1C1D52] sm:text-3xl">
            How would you like to continue?
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The skills assessment is optional. Either way, you can continue to
            payment and get started with your internship.
          </p>
        </header>

        {error && (
          <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void takeAssessment()}
            disabled={loading || starting || !assessmentAvailable}
            className="group flex min-h-56 flex-col rounded-2xl border-2 border-transparent bg-white p-5 text-left shadow-[0_8px_24px_rgba(28,29,82,0.08)] transition hover:-translate-y-0.5 hover:border-[#5FBB46] hover:shadow-[0_12px_30px_rgba(95,187,70,0.16)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f7eb] text-[#5FBB46]">
              {starting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ClipboardList className="h-5 w-5" />
              )}
            </span>
            <span className="mt-4 text-lg font-bold text-[#1C1D52]">
              Take a two-minute assessment
            </span>
            <span className="mt-2 text-sm leading-6 text-slate-500">
              Check your current skills and knowledge, and get your score right
              away.
            </span>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-[#397d3a]">
              {loading ? "Checking availability…" : "Take assessment"}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </button>

          <button
            type="button"
            onClick={skipAssessment}
            disabled={loading || starting}
            className="group flex min-h-56 flex-col rounded-2xl border-2 border-transparent bg-[#1C1D52] p-5 text-left text-white shadow-[0_8px_24px_rgba(28,29,82,0.15)] transition hover:-translate-y-0.5 hover:border-[#9be28a] hover:shadow-[0_12px_30px_rgba(28,29,82,0.22)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-[#9be28a]">
              <CreditCard className="h-5 w-5" />
            </span>
            <span className="mt-4 text-lg font-bold">
              Skip assessment, go straight to payment
            </span>
            <span className="mt-2 text-sm leading-6 text-white/75">
              Skip the assessment entirely. You can complete your payment and
              start your internship right away.
            </span>
            <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-[#9be28a]">
              Continue to payment
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        {!loading && !assessmentAvailable && (
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-[#5FBB46]" />
            There’s no assessment for this track right now. You can continue to payment.
          </p>
        )}
      </div>
    </main>
  );
}
