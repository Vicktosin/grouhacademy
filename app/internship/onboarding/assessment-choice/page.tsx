"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FlowExitBar from "@/components/FlowExitBar";

type OnboardingData = {
  programs?: Array<{
    id: string;
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

  return (
    <main className="min-h-dvh bg-[#F5F8FC]">
      <FlowExitBar
        backHref="/"
        backLabel="Back"
        onBack={() => router.push("/internship/onboarding?step=review")}
      />

      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-2">
        <h1 className="mb-4 text-center text-2xl font-bold leading-tight text-[#1C1D52]">
          How would you like to continue?
        </h1>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void takeAssessment()}
            disabled={starting || (!loading && !assessmentAvailable)}
            className="flex min-h-32 w-full flex-col justify-center rounded-2xl bg-[#1C1D52] px-5 py-4 text-left text-white shadow-[0_6px_18px_rgba(28,29,82,0.14)] transition hover:bg-[#252761] active:scale-[0.99] disabled:cursor-not-allowed"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
              Option 1
            </span>
            <span className="mt-1 text-lg font-bold">
              Take a two-minute assessment
            </span>
            <span className="mt-1 text-sm leading-5 text-white/85">
              We’d like to know your present level of knowledge.
            </span>
            {starting && (
              <span className="mt-2 text-xs font-semibold text-white/70">
                Starting assessment…
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push("/internship/results?skipped=1")}
            disabled={starting}
            className="flex min-h-32 w-full flex-col justify-center rounded-2xl bg-[#5FBB46] px-5 py-4 text-left text-[#14204f] shadow-[0_6px_18px_rgba(95,187,70,0.18)] transition hover:bg-[#55ad3e] active:scale-[0.99] disabled:cursor-wait"
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#14204f]/70">
              Option 2
            </span>
            <span className="mt-1 text-lg font-bold">
              Skip the assessment and go straight to payment
            </span>
            <span className="mt-1 text-sm leading-5 text-[#14204f]/85">
              Skip the assessment entirely and continue to payment.
            </span>
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        {!loading && !assessmentAvailable && !error && (
          <p className="mt-3 text-center text-xs text-slate-500">
            The assessment is unavailable for this track. Please choose payment.
          </p>
        )}
      </div>
    </main>
  );
}
