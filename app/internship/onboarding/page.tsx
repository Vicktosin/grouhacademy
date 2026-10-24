"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Loader2 } from "lucide-react";

type Level = {
  id: string;
  name: string;
  description: string | null;
  acceptanceFee: number;
};
type Program = {
  id: string;
  name: string;
  slug: string;
  duration: string;
  description: string | null;
  /** Levels open to applicants on this track, lowest first. */
  levels: Level[];
};
type Question = {
  id: string;
  prompt: string;
  fieldType: "select" | "textarea" | "text";
  options: string[];
  required: boolean;
};

const trackOrder = [
  "socialmedia",
  "aiautomation",
  "digitalmarketing",
  "aiforcontentcreation",
  "frontenddevelopment",
  "specialclass",
  "backendengineering",
  "wordpressdevelopment",
];

function trackOrderIndex(name: string) {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const index = trackOrder.findIndex((track) => normalizedName.startsWith(track));
  return index === -1 ? trackOrder.length : index;
}

export default function InternshipOnboardingPage() {
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showReadyModal, setShowReadyModal] = useState(false);

  useEffect(() => {
    fetch("/api/internship/onboarding")
      .then((r) => r.json())
      .then((data) => {
        setPrograms(data.programs ?? []);
        setQuestions(data.questions ?? []);
        if (data.existingProgramId) setProgramId(data.existingProgramId);
        if (data.existingLevelId) setLevelId(data.existingLevelId);
        if (data.existingAnswers) {
          setAnswers(data.existingAnswers);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const program = programs.find((item) => item.id === programId);
  const levels = program?.levels ?? [];
  // Keep a previous choice only if it's still open for the chosen track.
  const selectedLevelId = levels.some((level) => level.id === levelId)
    ? levelId
    : (levels[0]?.id ?? "");
  const orderedPrograms = [...programs].sort(
    (first, second) =>
      trackOrderIndex(first.name) - trackOrderIndex(second.name),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/internship/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          levelId: selectedLevelId,
          answers,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to save your answers.");
      setSubmitting(false);
      setShowReadyModal(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save your answers.",
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-[#1C1D52] px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
            Before we begin
          </p>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
            Tell us a bit about you
          </h1>
          <p className="mt-2 text-sm text-white/70">
            A few quick questions before your assessment.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-5 rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-8"
        >
          <div>
            <label className="block text-xs font-bold text-[#1C1D52]">
              Which stack are you interested in?
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Prices shown are the acceptance fees for each track&apos;s first
              available level. Select a level below to see its fee.
            </p>
            <div className="mt-3 space-y-2">
              {orderedPrograms.map((program) => (
                <label
                  key={program.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${programId === program.id ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    name="program"
                    value={program.id}
                    checked={programId === program.id}
                    onChange={() => setProgramId(program.id)}
                    className="mt-1"
                    required
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <strong className="text-sm text-[#1C1D52]">
                        {program.name}
                      </strong>
                      {program.levels[0] && (
                        <span className="shrink-0 rounded-full bg-[#397d3a] px-2.5 py-1 text-[10px] font-bold text-white">
                          ₦
                          {program.levels[0].acceptanceFee.toLocaleString(
                            "en-NG",
                          )}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {program.duration}
                      {program.description ? ` · ${program.description}` : ""}
                    </span>
                  </span>
                </label>
              ))}
              {programs.length === 0 && (
                <p className="text-xs text-slate-400">
                  No programs are currently open for applications.
                </p>
              )}
            </div>
          </div>

          {program && (
            <div>
              <label className="block text-xs font-bold text-[#1C1D52]">
                Which level are you applying for?
              </label>
              <p className="mt-1 text-xs text-slate-500">
                You&apos;ll take the entrance assessment for this level. New to
                the field? Start at {levels[0]?.name ?? "the first"} level.
              </p>
              {levels.length === 0 ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Applications for {program.name} open soon. Please check back
                  later or choose another stack.
                </p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {levels.map((level) => (
                    <label
                      key={level.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${selectedLevelId === level.id ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}
                    >
                      <input
                        type="radio"
                        name="level"
                        value={level.id}
                        checked={selectedLevelId === level.id}
                        onChange={() => setLevelId(level.id)}
                        className="mt-1"
                      />
                      <span>
                        <strong className="block text-sm text-[#1C1D52]">
                          {level.name}
                        </strong>
                        {level.description && (
                          <span className="mt-1 block text-xs text-slate-500">
                            {level.description}
                          </span>
                        )}
                        <span className="mt-1 block text-xs font-semibold text-[#1C1D52]">
                          Acceptance fee ₦{level.acceptanceFee.toLocaleString()}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {questions.map((question) => (
            <label
              key={question.id}
              className="block text-xs font-bold text-[#1C1D52]"
            >
              {question.prompt}
              {question.fieldType === "select" ? (
                <select
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      [question.id]: event.target.value,
                    })
                  }
                  required={question.required}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                >
                  <option value="" disabled>
                    Select one
                  </option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : question.fieldType === "textarea" ? (
                <textarea
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      [question.id]: event.target.value,
                    })
                  }
                  required={question.required}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                />
              ) : (
                <input
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      [question.id]: event.target.value,
                    })
                  }
                  required={question.required}
                  className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              )}
            </label>
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !programId || !selectedLevelId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-3.5 text-sm font-bold text-[#14204f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Continue"}{" "}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      {showReadyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11132f]/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] bg-white text-center shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
            <div className="bg-[#1C1D52] px-6 pb-8 pt-7 text-white">
              <span className="inline-flex items-center rounded-full border border-[#9be28a]/40 bg-[#9be28a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9be28a]">
                Entrance exam
              </span>
              <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7eb] text-[#5FBB46]">
                <ClipboardList className="h-8 w-8" />
              </div>
            </div>
            <div className="px-7 pb-7 pt-6">
              <h2 className="text-2xl font-bold text-[#1C1D52]">
                Are you ready for your entrance examination?
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This first assessment is objective-based and automatically
                calculated. You will be informed immediately if you pass or need
                to retake it.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() =>
                    router.push("/internship/assessment/readiness")
                  }
                  className="inline-flex items-center justify-center rounded-xl bg-[#5FBB46] px-6 py-3 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition hover:translate-y-[-1px]"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowReadyModal(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-50"
                >
                  Not yet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
