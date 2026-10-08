"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PhoneOff,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import InternshipShell from "@/components/InternshipShell";
import type { InterviewSessionView } from "@/lib/interviews";

/** How often to check for the call ending and for feedback. */
const POLL_MS = 5000;

export default function InterviewSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<InterviewSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/internship/interview/${id}`, {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Unable to load.");
    const next = body.session as InterviewSessionView;
    setSession(next);
    return next;
  }, [id]);

  // Keep checking while the call runs or feedback is on its way.
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const tick = () =>
      load()
        .then((next) => {
          // Nothing more will change once scored or failed, or once the
          // transcript is saved while automatic scoring is off.
          const done =
            next.status === "SCORED" ||
            next.status === "FAILED" ||
            (next.hasTranscript && !next.gradingEnabled);
          if (!stopped && !done) timer = window.setTimeout(tick, POLL_MS);
        })
        .catch((loadError: unknown) => {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load.",
          );
          if (!stopped) timer = window.setTimeout(tick, POLL_MS * 3);
        });
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function end() {
    setEnding(true);
    try {
      const response = await fetch(`/api/internship/interview/${id}/end`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) setSession(body.session as InterviewSessionView);
    } finally {
      setEnding(false);
    }
  }

  const live =
    session &&
    (session.status === "ACTIVE" || session.status === "STARTING") &&
    session.conversationUrl;

  return (
    <InternshipShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          href="/internship/dashboard/interview"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to practice interviews
        </Link>

        {error && !session && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {!session ? (
          <div className="flex justify-center rounded-2xl bg-white p-10 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
          </div>
        ) : live ? (
          <section className="space-y-3">
            <div className="overflow-hidden rounded-2xl bg-[#101426] shadow-[0_12px_30px_rgba(28,29,82,0.16)]">
              <iframe
                src={session.conversationUrl!}
                title="Practice interview"
                allow="camera; microphone; autoplay; fullscreen; display-capture"
                className={`w-full ${session.mode === "VIDEO" ? "aspect-video" : "h-72"}`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {session.mode === "VIDEO" ? "Video" : "Voice"} interview in
                progress. Allow microphone
                {session.mode === "VIDEO" ? " and camera" : ""} access if your
                browser asks.
              </p>
              <button
                type="button"
                onClick={() => void end()}
                disabled={ending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {ending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="h-4 w-4" />
                )}
                End interview
              </button>
            </div>
          </section>
        ) : session.status === "FAILED" ? (
          <Card>
            <p className="text-sm text-slate-600">
              {session.errorMessage ?? "This interview didn't start."} It
              doesn&apos;t count toward your attempts.
            </p>
          </Card>
        ) : session.status !== "SCORED" &&
          session.hasTranscript &&
          !session.gradingEnabled ? (
          <Card>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#5FBB46]" />
              <div>
                <p className="text-sm font-bold text-[#1C1D52]">
                  Interview complete — well done!
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Your interview has been saved. Feedback will appear here once
                  it has been reviewed.
                </p>
              </div>
            </div>
          </Card>
        ) : session.status !== "SCORED" || !session.feedback ? (
          <Card>
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#5FBB46]" />
              <div>
                <p className="text-sm font-bold text-[#1C1D52]">
                  Interview finished — preparing your feedback
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {session.errorMessage ??
                    "This usually takes a minute or two. You can leave this page and come back."}
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Feedback session={session} />
        )}
      </div>
    </InternshipShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      {children}
    </section>
  );
}

function Feedback({ session }: { session: InterviewSessionView }) {
  const feedback = session.feedback!;
  const score = session.score ?? 0;
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-2xl bg-[#1C1D52] p-6 text-white sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-[#5FBB46]">
          <span className="text-3xl font-bold">{score}</span>
          <span className="text-[10px] text-white/60">out of 100</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9be28a]">
            Your practice interview
          </p>
          <p className="mt-2 text-sm leading-6 text-white/85">
            {feedback.summary}
          </p>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <List
          icon={<CheckCircle2 className="h-4 w-4 text-[#5FBB46]" />}
          title="What went well"
          items={feedback.strengths}
        />
        <List
          icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
          title="To work on"
          items={feedback.improvements}
        />
      </div>

      {feedback.questions.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold text-[#1C1D52]">
            Question by question
          </h2>
          <ol className="mt-3 space-y-3">
            {feedback.questions.map((item, index) => (
              <li key={index} className="rounded-xl bg-[#f8fbff] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-[#1C1D52]">
                    {index + 1}. {item.question}
                  </p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#1C1D52]">
                    {item.score}/10
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {item.feedback}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function List({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
        {icon} {title}
      </h2>
      {items.length ? (
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Nothing noted.</p>
      )}
    </Card>
  );
}
