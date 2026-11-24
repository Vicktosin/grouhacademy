"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Minus,
  Rocket,
  Users,
} from "lucide-react";
import FlowExitBar from "@/components/FlowExitBar";
import type { ChoiceOptions } from "@/lib/learning-mode-rules";

// Onboarding in four short steps (track → how you'll learn → about you →
// review). Each step is in the URL (?step=) so the phone's back
// button and the Back link move between steps instead of leaving. Mobile
// first: most applicants are on phones.

type LearningMode = "SELF_PACED" | "COHORT";
type Level = {
  id: string;
  name: string;
  description: string | null;
  acceptanceFee: number;
  assessmentAvailable: boolean;
  learning?: ChoiceOptions;
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

const STEPS = ["track", "learning", "about", "review"] as const;
type Step = (typeof STEPS)[number];
const STEP_TITLES: Record<Step, string> = {
  track: "Choose your track",
  learning: "How do you want to learn?",
  about: "About you",
  review: "Check and start",
};
const DRAFT_KEY = "sabirole-onboarding-draft";

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

function naira(amount: number) {
  return `₦${amount.toLocaleString("en-NG")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
  });
}

/** Phone questions are free text set by admins; show them as phone fields. */
function isPhoneQuestion(question: Question) {
  return question.fieldType === "text" && /phone|whatsapp|number/i.test(question.prompt);
}

/** A short, clear label (and hint) for the common questions. */
function questionLabel(question: Question): { label: string; hint?: string } {
  if (isPhoneQuestion(question)) {
    if (/whatsapp/i.test(question.prompt))
      return { label: "WhatsApp number", hint: "We'll guide you through the internship here." };
    if (/altern|another|other|second/i.test(question.prompt))
      return { label: "Another phone number", hint: "In case we can't reach you on WhatsApp." };
  }
  return { label: question.prompt };
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^[+\d\s()-]+$/.test(value.trim()) && digits.length >= 10 && digits.length <= 15;
}

function readDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

type Draft = {
  programId: string;
  levelId: string;
  answers: Record<string, string>;
  learningMode: LearningMode | "";
};

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStep = searchParams.get("step") as Step | null;
  const [programs, setPrograms] = useState<Program[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [learningMode, setLearningMode] = useState<LearningMode | "">("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  // Whether we moved between steps here, so Back can use the history.
  const movedHere = useRef(false);

  useEffect(() => {
    fetch("/api/internship/onboarding")
      .then((r) => r.json())
      .then((data) => {
        setPrograms(data.programs ?? []);
        setQuestions(data.questions ?? []);
        // A draft from this visit (e.g. after a refresh) wins over saved answers.
        const draft = readDraft();
        setProgramId(draft?.programId || data.existingProgramId || "");
        setLevelId(draft?.levelId || data.existingLevelId || "");
        setAnswers({ ...(data.existingAnswers ?? {}), ...(draft?.answers ?? {}) });
        setLearningMode(draft?.learningMode || data.existingLearningMode || "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    try {
      const draft: Draft = { programId, levelId, answers, learningMode };
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing: the draft just isn't kept.
    }
  }, [loading, programId, levelId, answers, learningMode]);

  const orderedPrograms = [...programs].sort(
    (first, second) => trackOrderIndex(first.name) - trackOrderIndex(second.name),
  );
  const program = programs.find((item) => item.id === programId);
  const levels = program?.levels ?? [];
  // Keep a previous choice only if it's still open for the chosen track.
  const level = levels.find((item) => item.id === levelId) ?? levels[0];
  const learning = level?.learning;
  const selfPacedOpen = learning?.selfPaced.available ?? false;
  const cohortOpen = learning?.cohort.available ?? false;
  // Only one way open: it's chosen for them.
  const chosenMode: LearningMode | "" =
    learningMode === "SELF_PACED" && selfPacedOpen
      ? "SELF_PACED"
      : learningMode === "COHORT" && cohortOpen
        ? "COHORT"
        : selfPacedOpen && !cohortOpen
          ? "SELF_PACED"
          : cohortOpen && !selfPacedOpen
            ? "COHORT"
            : "";

  function answerProblem(question: Question) {
    const value = (answers[question.id] ?? "").trim();
    if (!value) return question.required ? "Please fill this in." : null;
    if (isPhoneQuestion(question) && !validPhone(value)) return "Enter a valid phone number, e.g. 0803 123 4567.";
    return null;
  }

  const stepDone: Record<Step, boolean> = {
    track: Boolean(program && level),
    learning: Boolean(chosenMode) || (!selfPacedOpen && !cohortOpen && Boolean(level)),
    about: questions.every((question) => !answerProblem(question)),
    review: false,
  };
  // The furthest step that may be shown: the first one not done yet.
  const firstOpen = STEPS.find((step) => !stepDone[step]) ?? "review";
  const step: Step =
    requestedStep && STEPS.includes(requestedStep) && STEPS.indexOf(requestedStep) <= STEPS.indexOf(firstOpen)
      ? requestedStep
      : requestedStep && STEPS.includes(requestedStep)
        ? firstOpen
        : "track";
  const stepIndex = STEPS.indexOf(step);

  function goTo(next: Step) {
    setError("");
    setShowErrors(false);
    movedHere.current = true;
    router.push(`/internship/onboarding?step=${next}`, { scroll: true });
  }

  function goBack() {
    if (stepIndex === 0) return router.push("/");
    if (movedHere.current) return router.back();
    router.replace(`/internship/onboarding?step=${STEPS[stepIndex - 1]}`);
  }

  function continueFrom(current: Step) {
    if (!stepDone[current]) {
      setShowErrors(true);
      return;
    }
    goTo(STEPS[STEPS.indexOf(current) + 1]);
  }

  async function saveOnboardingAndChooseNextStep() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/internship/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          levelId: level?.id,
          answers,
          learningMode: chosenMode || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save your answers.");

      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push("/internship/onboarding/assessment-choice");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save your answers.");
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

  const primaryButton =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-3.5 text-sm font-bold text-[#14204f] shadow-[0_10px_24px_rgba(95,187,70,0.22)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="min-h-dvh bg-[#F5F8FC]">
      <FlowExitBar
        backHref="/"
        onBack={goBack}
        backLabel={stepIndex === 0 ? "Home" : "Back"}
      />
      <div className="mx-auto w-full max-w-xl px-4 pb-32 sm:pb-12">
        {/* Progress */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <span className="text-[#2f7d52]">{STEP_TITLES[step]}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span
              key={item}
              className={`h-1.5 rounded-full transition-colors ${index <= stepIndex ? "bg-[#5FBB46]" : "bg-slate-200"}`}
            />
          ))}
        </div>

        {step === "track" && (
          <section className="mt-6">
            <h1 className="text-2xl font-bold leading-tight text-[#1C1D52]">Which track do you want to learn?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pick one. You can change it before you continue.
            </p>
            <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Track">
              {orderedPrograms.map((item) => {
                const selected = item.id === programId;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border-2 bg-white transition ${selected ? "border-[#5FBB46] shadow-[0_8px_24px_rgba(95,187,70,0.14)]" : "border-transparent shadow-[0_4px_16px_rgba(28,29,82,0.07)]"}`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setProgramId(item.id);
                        setLevelId(item.levels[0]?.id ?? "");
                      }}
                      className="flex w-full items-start gap-3 p-4 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[#5FBB46] bg-[#5FBB46] text-white" : "border-slate-300"}`}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <strong className="text-[15px] leading-5 text-[#1C1D52]">{item.name}</strong>
                          {item.levels[0] && (
                            <span className="shrink-0 text-xs font-semibold text-slate-500">
                              {naira(item.levels[0].acceptanceFee)}
                            </span>
                          )}
                        </span>
                        <span className={`mt-1 block text-xs leading-5 text-slate-500 ${selected ? "" : "line-clamp-2"}`}>
                          {item.duration}
                          {item.description ? ` · ${item.description}` : ""}
                        </span>
                      </span>
                    </button>

                    {selected && item.levels.length === 0 && (
                      <p className="mx-4 mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                        Applications for this track open soon. Please choose another track for now.
                      </p>
                    )}
                    {selected && item.levels.length > 1 && (
                      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                        <p className="text-xs font-bold text-[#1C1D52]">Your starting level</p>
                        <p className="mt-0.5 text-xs text-slate-500">New to this? Start at {item.levels[0].name}.</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {item.levels.map((option) => {
                            const active = option.id === level?.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setLevelId(option.id)}
                                className={`rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}
                              >
                                <span className="block text-sm font-semibold text-[#1C1D52]">{option.name}</span>
                                <span className="block text-xs text-slate-500">Fee {naira(option.acceptanceFee)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {programs.length === 0 && (
                <p className="text-sm text-slate-500">No tracks are open for applications right now.</p>
              )}
            </div>
            {showErrors && !stepDone.track && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">Choose a track to continue.</p>
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              The assessment is optional. You can go straight to payment after completing your details.
            </p>
          </section>
        )}

        {step === "learning" && learning && (
          <section className="mt-6">
            <h1 className="text-2xl font-bold leading-tight text-[#1C1D52]">How do you want to learn?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Same tasks and the same certificate either way. Choose what suits your life right now.
            </p>
            {learning.note && (
              <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">{learning.note}</p>
            )}
            <div className="mt-5 space-y-3" role="radiogroup" aria-label="How you'll learn">
              {selfPacedOpen && (
                <LearningCard
                  selected={chosenMode === "SELF_PACED"}
                  onSelect={() => setLearningMode("SELF_PACED")}
                  icon={<Rocket className="h-6 w-6" />}
                  title="Start now, on your own"
                  subtitle="Begin as soon as you pay"
                  pros={[
                    "No waiting: your tasks open right away",
                    "Work at your own pace, on your own schedule",
                    "All lessons and resources are in the app",
                  ]}
                  cons={["You work alone: no teammates or group projects"]}
                />
              )}
              {cohortOpen && (
                <LearningCard
                  selected={chosenMode === "COHORT"}
                  onSelect={() => setLearningMode("COHORT")}
                  icon={<Users className="h-6 w-6" />}
                  title={learning.cohort.waitlist ? "Wait for the next cohort" : "Join the next cohort"}
                  subtitle={
                    learning.cohort.startDate
                      ? `Starts ${formatDate(learning.cohort.startDate)}${learning.cohort.daysLeft !== null ? ` · ${learning.cohort.daysLeft === 0 ? "today" : `${learning.cohort.daysLeft} day${learning.cohort.daysLeft === 1 ? "" : "s"} to go`}` : ""}`
                      : "Start date to be announced"
                  }
                  pros={[
                    "Learn with a group of interns who start with you",
                    "Teammates, team tasks and group support",
                    "A set timetable with deadlines keeps you on track",
                  ]}
                  cons={[
                    learning.cohort.waitlist
                      ? "You wait until the next cohort is scheduled"
                      : "You wait until the start date",
                  ]}
                />
              )}
            </div>
            {selfPacedOpen && cohortOpen && (
              <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d52]" aria-hidden="true" />
                Start on your own and want a group later? You can join a cohort once from your dashboard and keep your work.
              </p>
            )}
            {showErrors && !stepDone.learning && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">Choose one to continue.</p>
            )}
          </section>
        )}

        {step === "about" && (
          <section className="mt-6">
            <h1 className="text-2xl font-bold leading-tight text-[#1C1D52]">A little about you</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              So we can reach you and set you up well.
            </p>
            <div className="mt-5 space-y-5 rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.08)]">
              {questions.map((question) => {
                const { label, hint } = questionLabel(question);
                const value = answers[question.id] ?? "";
                const problem = showErrors ? answerProblem(question) : null;
                const setValue = (next: string) => setAnswers((current) => ({ ...current, [question.id]: next }));
                const inputClass = `mt-1.5 w-full rounded-xl border bg-white px-3.5 text-[15px] text-[#1C1D52] outline-none transition focus:border-[#5FBB46] focus:ring-2 focus:ring-[#5FBB46]/20 ${problem ? "border-red-400" : "border-slate-200"}`;
                return (
                  <div key={question.id}>
                    {question.fieldType === "select" ? (
                      <fieldset>
                        <legend className="text-sm font-semibold text-[#1C1D52]">
                          {label}
                          {!question.required && <span className="font-normal text-slate-400"> (optional)</span>}
                        </legend>
                        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option) => {
                            const active = value === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setValue(option)}
                                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition ${active ? "border-[#5FBB46] bg-[#f4faf2] font-semibold text-[#1C1D52]" : "border-slate-200 text-slate-700"}`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-[#5FBB46] bg-[#5FBB46]" : "border-slate-300"}`}
                                >
                                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </span>
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : (
                      <label className="block">
                        <span className="text-sm font-semibold text-[#1C1D52]">
                          {label}
                          {!question.required && <span className="font-normal text-slate-400"> (optional)</span>}
                        </span>
                        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
                        {question.fieldType === "textarea" ? (
                          <textarea
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            rows={4}
                            className={`${inputClass} py-3`}
                          />
                        ) : (
                          <input
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            type={isPhoneQuestion(question) ? "tel" : "text"}
                            inputMode={isPhoneQuestion(question) ? "tel" : undefined}
                            autoComplete={isPhoneQuestion(question) ? "tel" : undefined}
                            placeholder={isPhoneQuestion(question) ? "0803 123 4567" : undefined}
                            className={`${inputClass} h-12`}
                          />
                        )}
                      </label>
                    )}
                    {problem && <p className="mt-1.5 text-xs font-semibold text-red-600">{problem}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === "review" && program && level && (
          <section className="mt-6">
            <h1 className="text-2xl font-bold leading-tight text-[#1C1D52]">Check your details</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tap Change to fix anything.</p>
            <dl className="mt-5 divide-y divide-slate-100 rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.08)]">
              <ReviewRow
                label="Track"
                value={`${program.name}${levels.length > 1 ? ` · ${level.name}` : ""}`}
                onChange={() => goTo("track")}
              />
              <ReviewRow
                label="How you'll learn"
                value={
                  chosenMode === "SELF_PACED"
                    ? "Start now, on your own"
                    : chosenMode === "COHORT"
                      ? learning?.cohort.startDate
                        ? `Next cohort · starts ${formatDate(learning.cohort.startDate)}`
                        : "Next cohort (waiting list)"
                      : "We'll ask you after payment"
                }
                onChange={() => goTo("learning")}
              />
              {questions.map((question) => (
                <ReviewRow
                  key={question.id}
                  label={questionLabel(question).label}
                  value={answers[question.id]?.trim() || "Not given"}
                  onChange={() => goTo("about")}
                />
              ))}
            </dl>

            <div className="mt-5 flex gap-3 rounded-2xl bg-[#1C1D52] p-5 text-white">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#9be28a]">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold">Your details are ready</p>
                <p className="mt-1 text-xs leading-5 text-white/75">
                  Next, choose whether to take the optional two-minute skills assessment or go straight to payment for your {naira(level.acceptanceFee)} acceptance fee.
                </p>
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
          </section>
        )}
      </div>

      {/* The main action stays in reach of the thumb on phones. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-auto sm:max-w-xl sm:border-0 sm:bg-transparent sm:px-4 sm:pb-12 sm:pt-0">
        {step === "review" ? (
          <button type="button" onClick={() => void saveOnboardingAndChooseNextStep()} disabled={submitting} className={primaryButton}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Choose my next step <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button type="button" onClick={() => continueFrom(step)} className={primaryButton}>
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function LearningCard({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  pros,
  cons,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  pros: string[];
  cons: string[];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`block w-full rounded-2xl border-2 bg-white p-5 text-left transition active:scale-[0.99] ${selected ? "border-[#5FBB46] shadow-[0_8px_24px_rgba(95,187,70,0.16)]" : "border-transparent shadow-[0_4px_16px_rgba(28,29,82,0.08)]"}`}
    >
      <span className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-[#5FBB46] text-white" : "bg-[#eef1ff] text-[#1C1D52]"}`}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-[#1C1D52]">{title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#2f7d52]">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> {subtitle}
          </span>
        </span>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[#5FBB46] bg-[#5FBB46] text-white" : "border-slate-300"}`}
          aria-hidden="true"
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </span>
      <ul className="mt-4 space-y-1.5 text-sm leading-5 text-slate-700">
        {pros.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7d52]" aria-hidden="true" />
            {item}
          </li>
        ))}
        {cons.map((item) => (
          <li key={item} className="flex items-start gap-2 text-slate-500">
            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </button>
  );
}

function ReviewRow({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-[#1C1D52]">{value}</dd>
      </div>
      <button type="button" onClick={onChange} className="shrink-0 text-sm font-semibold text-[#2f7d52] underline-offset-2 hover:underline">
        Change
      </button>
    </div>
  );
}

export default function InternshipOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
        </div>
      }
    >
      <OnboardingFlow />
    </Suspense>
  );
}
