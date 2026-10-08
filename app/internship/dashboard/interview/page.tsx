"use client";

import {
  ChevronRight,
  Clock3,
  Loader2,
  Mic,
  RotateCcw,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import InternshipShell from "@/components/InternshipShell";
import type { InterviewSessionView } from "@/lib/interviews";

type Overview = {
  track: string;
  level: string;
  configured: boolean;
  setup: {
    title: string;
    durationMinutes: number;
    maxAttempts: number;
    questionCount: number;
  } | null;
  attemptsUsed: number;
  sessions: InterviewSessionView[];
};

const STATUS_LABEL: Record<string, string> = {
  STARTING: "Starting",
  ACTIVE: "In progress",
  ENDED: "Waiting for feedback",
  SCORED: "Scored",
  FAILED: "Didn't start",
};

export default function InterviewPage() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<"VIDEO" | "AUDIO" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/internship/interview", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load.");
        setData(body as Overview);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function start(mode: "VIDEO" | "AUDIO") {
    setStarting(mode);
    setError(null);
    try {
      const response = await fetch("/api/internship/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to start.");
      router.push(`/internship/dashboard/interview/${body.session.id}`);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Unable to start.",
      );
      setStarting(null);
    }
  }

  const live = data?.sessions.find(
    (session) => session.status === "ACTIVE" || session.status === "STARTING",
  );
  const attemptsLeft = data?.setup
    ? Math.max(0, data.setup.maxAttempts - data.attemptsUsed)
    : 0;

  return (
    <InternshipShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1D52]">
            Practice interview
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Rehearse a real job interview with our AI interviewer, then get a
            score and tips to improve. Choose a video call or a voice-only call.
          </p>
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center rounded-2xl bg-white p-10 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
          </div>
        ) : !data ? null : !data.setup ? (
          <Notice
            text={`There's no practice interview for ${data.track} at ${data.level} level yet. Check back soon.`}
          />
        ) : !data.configured ? (
          <Notice text="Practice interviews are being set up. Check back soon." />
        ) : (
          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
              {data.track} · {data.level} level
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#1C1D52]">
              {data.setup.title}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> About{" "}
                {data.setup.durationMinutes} minutes
              </span>
              <span>{data.setup.questionCount} questions</span>
              <span>
                {attemptsLeft} of {data.setup.maxAttempts} attempts left
              </span>
            </p>

            {live ? (
              <Link
                href={`/internship/dashboard/interview/${live.id}`}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f]"
              >
                Return to your interview in progress
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : attemptsLeft === 0 ? (
              <p className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600">
                You&apos;ve used all your practice interviews for this level.
                Review your feedback below.
              </p>
            ) : (
              <>
                <p className="mt-5 text-xs text-slate-600">
                  Find a quiet place and allow your browser to use your{" "}
                  microphone (and camera for video) when asked.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <StartButton
                    icon={<Video className="h-5 w-5" />}
                    title="Video interview"
                    text="Face-to-face with the AI interviewer."
                    busy={starting === "VIDEO"}
                    disabled={starting !== null}
                    onClick={() => void start("VIDEO")}
                  />
                  <StartButton
                    icon={<Mic className="h-5 w-5" />}
                    title="Voice interview"
                    text="Audio only; uses less data."
                    busy={starting === "AUDIO"}
                    disabled={starting !== null}
                    onClick={() => void start("AUDIO")}
                  />
                </div>
              </>
            )}
          </section>
        )}

        {data && data.sessions.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
            <h2 className="text-sm font-bold text-[#1C1D52]">
              Your interviews
            </h2>
            <ul className="mt-3 space-y-2">
              {data.sessions.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/internship/dashboard/interview/${session.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-xs hover:bg-[#f8fbff]"
                  >
                    <span className="flex items-center gap-2 text-[#1C1D52]">
                      {session.mode === "VIDEO" ? (
                        <Video className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Mic className="h-4 w-4 text-slate-400" />
                      )}
                      {new Date(session.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-500">
                        {STATUS_LABEL[session.status] ?? session.status}
                      </span>
                      {session.score !== null && (
                        <span className="rounded-full bg-[#e8f7eb] px-2.5 py-1 font-bold text-[#397d3a]">
                          {session.score}/100
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </InternshipShell>
  );
}

function StartButton({
  icon,
  title,
  text,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-[#5FBB46] hover:bg-[#f4faf2] disabled:opacity-60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1C1D52] text-white">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </span>
      <span>
        <strong className="block text-sm text-[#1C1D52]">
          {busy ? "Starting…" : title}
        </strong>
        <span className="mt-0.5 block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-6 text-sm text-slate-600 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <RotateCcw className="h-5 w-5 shrink-0 text-slate-300" />
      {text}
    </div>
  );
}
