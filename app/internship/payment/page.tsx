"use client";

import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import CommunityInvite from "@/components/CommunityInvite";

type Result = {
  programName: string;
  scorePercent: number;
  passed: boolean;
  acceptanceFee: number;
  acceptanceFeePaid: boolean;
};

export default function InternshipPaymentPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/internship/assessment/result")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Complete your assessment before continuing.",
          );
        setResult(data);
      })
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Complete your assessment before continuing.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function payAcceptanceFee() {
    setPaying(true);
    setError("");
    try {
      const response = await fetch("/api/internship/payment/initialize", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.authorization_url)
        throw new Error(data.message || "Payment could not be initialized.");
      window.location.href = data.authorization_url;
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Payment could not be initialized.",
      );
      setPaying(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
      </div>
    );
  if (error || !result || !result.passed)
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <AlertCircle className="mx-auto h-9 w-9 text-amber-500" />
        <h1 className="mt-4 text-xl font-bold text-[#1C1D52]">
          Assessment required
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {error ||
            "Pass the entrance assessment before paying the acceptance fee."}
        </p>
        <Link
          href="/internship/assessment/readiness"
          className="mt-6 inline-flex rounded-lg bg-[#5FBB46] px-5 py-3 text-xs font-bold text-[#14204f]"
        >
          Go to assessment
        </Link>
      </div>
    );
  if (result.acceptanceFeePaid)
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[#5FBB46]" />
        <h1 className="mt-4 text-xl font-bold text-[#1C1D52]">
          Acceptance fee paid
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your internship access is ready.
        </p>
        <Link
          href="/internship/dashboard"
          className="mt-6 inline-flex rounded-lg bg-[#5FBB46] px-5 py-3 text-xs font-bold text-[#14204f]"
        >
          Go to dashboard
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-8">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8f7eb] text-[#5FBB46]">
            <CreditCard className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
              You qualified
            </p>
            <h1 className="mt-1 text-2xl font-bold text-[#1C1D52]">
              Pay your acceptance fee
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              You scored {result.scorePercent}% on the {result.programName}{" "}
              entrance assessment.
            </p>
          </div>
        </div>
        <div className="mt-7 rounded-xl bg-[#1C1D52] p-5 text-white">
          <div className="flex items-end justify-between gap-4">
            <span className="text-xs text-white/70">Acceptance fee</span>
            <strong className="text-2xl">
              ₦{result.acceptanceFee.toLocaleString()}
            </strong>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-white/65">
            This one-time payment is available only after passing your entrance
            assessment and unlocks the internship workspace.
          </p>
          <button
            type="button"
            onClick={payAcceptanceFee}
            disabled={paying}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-3 text-xs font-bold text-[#14204f] disabled:cursor-wait disabled:opacity-60"
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting to Paystack…
              </>
            ) : (
              <>
                <LockKeyhole className="h-4 w-4" />
                Pay acceptance fee
              </>
            )}
          </button>
        </div>
      </div>

      <CommunityInvite
        title="Not ready to pay yet?"
        description="Join our WhatsApp community to ask questions, learn more about the programme, and hear from current interns."
      />
    </div>
  );
}
