"use client";

import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import InternshipShell from "@/components/InternshipShell";

type Progression = {
  programName: string;
  levelName: string;
  certificateId: string | null;
  nextLevel: { id: string; name: string; acceptanceFee: number | null } | null;
  queuedApplicationId: string | null;
};

export default function NextLevelPage() {
  const [progression, setProgression] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internship/progression", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load.");
        setProgression(data as Progression);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  /** Queues the next level, then pays its fee through Paystack. */
  async function moveUp() {
    setPaying(true);
    setError(null);
    try {
      const started = await fetch("/api/internship/progression", {
        method: "POST",
      });
      const startData = await started.json();
      if (!started.ok)
        throw new Error(startData.error || "Unable to start the next level.");

      const payment = await fetch(
        "/api/internship/payment/acceptance/initialize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: startData.applicationId }),
        },
      );
      const paymentData = await payment.json();
      if (!payment.ok || !paymentData.authorization_url)
        throw new Error(paymentData.message || "Unable to start the payment.");
      window.location.assign(paymentData.authorization_url);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to start the next level.",
      );
      setPaying(false);
    }
  }

  const next = progression?.nextLevel;

  return (
    <InternshipShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <Link
          href="/internship/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {loading ? (
          <div className="flex justify-center rounded-2xl bg-white p-10 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
          </div>
        ) : !progression ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
            {error ?? "Unable to load your internship."}
          </p>
        ) : !progression.certificateId ? (
          <Notice
            icon={<Lock className="h-10 w-10 text-slate-300" />}
            title="Finish your current level first"
            text={`Earn your ${progression.programName} ${progression.levelName} level certificate to unlock the next level.`}
          />
        ) : !next ? (
          <Notice
            icon={<Award className="h-10 w-10 text-[#5FBB46]" />}
            title="You've reached the highest level"
            text={`Congratulations on completing every level of ${progression.programName}.`}
          />
        ) : next.acceptanceFee === null ? (
          <Notice
            icon={<Lock className="h-10 w-10 text-slate-300" />}
            title={`${next.name} level opens soon`}
            text={`${next.name} level for ${progression.programName} isn't open yet. Please check back soon.`}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <div className="bg-[#1C1D52] px-6 py-7 text-white sm:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
                Next level
              </p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                {progression.programName} · {next.name} level
              </h1>
              <p className="mt-2 text-sm text-white/70">
                Build on your {progression.levelName} level experience with a
                new cohort, new tasks and a new certificate.
              </p>
            </div>
            <div className="space-y-4 px-6 py-6 sm:px-8">
              <ul className="space-y-2 text-sm text-slate-600">
                {[
                  `No entrance exam — your ${progression.levelName} level certificate qualifies you.`,
                  `You'll join the next ${next.name} level cohort for ${progression.programName}.`,
                  "Your earlier certificates stay available to download.",
                ].map((point) => (
                  <li key={point} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5FBB46]" />
                    {point}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between rounded-xl bg-[#f8fbff] px-4 py-3">
                <span className="text-xs font-semibold text-slate-500">
                  Acceptance fee
                </span>
                <span className="text-lg font-bold text-[#1C1D52]">
                  ₦{next.acceptanceFee.toLocaleString()}
                </span>
              </div>
              {error && (
                <p
                  className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={() => void moveUp()}
                disabled={paying}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-5 py-3.5 text-sm font-bold text-[#14204f] disabled:opacity-60"
              >
                {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {paying
                  ? "Taking you to payment…"
                  : `Pay ₦${next.acceptanceFee.toLocaleString()} and join ${next.name} level`}
              </button>
              <p className="text-center text-[11px] text-slate-400">
                You keep full access to your current workspace until the payment
                is complete.
              </p>
            </div>
          </section>
        )}
      </div>
    </InternshipShell>
  );
}

function Notice({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-4 text-lg font-bold text-[#1C1D52]">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}
