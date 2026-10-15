"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useRef, useState } from "react";
import InternshipShell from "@/components/InternshipShell";
import HowItWorksGuide from "@/components/onboarding/HowItWorksGuide";
import { PRACTICE_LAB_GUIDE } from "@/lib/how-it-works";
import LabWorkspace from "@/components/LabWorkspace";
import AdsSimulator from "@/components/AdsSimulator";
import SocialSimulator from "@/components/SocialSimulator";
import AutomationSimulator from "@/components/AutomationSimulator";
import BackendSimulator from "@/components/BackendSimulator";
import WordPressLab from "@/components/WordPressLab";
import FullscreenFrame from "@/components/FullscreenFrame";
import ContentSimulator from "@/components/ContentSimulator";
import type { ContentWork } from "@/lib/content-sim/model";
import type { BackendFiles } from "@/lib/backend-sim/model";
import type { Workflow } from "@/lib/automation-sim/model";
import type { SocialPlan } from "@/lib/social-sim/model";
import type { Campaign } from "@/lib/ads-sim/model";
import type { LabCheckResult, LabFiles } from "@/lib/lab-shared";
import type {
  InternAdsLab,
  InternAutomationLab,
  InternBackendLab,
  InternSocialLab,
  InternWordPressLab,
  InternContentLab,
  InternCodeLab,
  InternLab,
  LabTaskResult,
} from "@/lib/practice-lab";
import { checkForAchievements } from "@/lib/achievement-events";
import { captureLabScreenshots } from "@/lib/lab-screenshots";
import { uploadLabArtifact } from "@/lib/lab-artifact-upload";

/** Save this long after the intern stops typing. */
const AUTOSAVE_MS = 2500;
const REVIEW_POLL_MS = 5000;
/** Stop checking for a review after this long (it's normally under a minute). */
const REVIEW_POLL_LIMIT_MS = 4 * 60 * 1000;

type Attempt = NonNullable<InternLab["attempt"]>;
/** "pending": changed, saved in a moment; "unsaved": the save failed. */
type SaveState = "saved" | "pending" | "saving" | "unsaved";
type Message = { text: string; error: boolean } | null;
type ExerciseProps<L> = {
  lab: L;
  id: string;
  taskId: string | null;
  onSaveState: (state: SaveState) => void;
};

export default function LabExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const taskId = useSearchParams().get("taskId");
  const [lab, setLab] = useState<InternLab | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/internship/lab/${id}${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load.");
        setLab(body as InternLab);
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load.",
        ),
      );
  }, [id, taskId]);

  return (
    <InternshipShell>
      <div className="space-y-4">
        <Link
          href={
            lab?.task
              ? "/internship/dashboard/tasks"
              : "/internship/dashboard/lab"
          }
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52] hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          {lab?.task ? "Back to tasks" : "Back to Practice Lab"}
        </Link>
        <div>
          <HowItWorksGuide guide={PRACTICE_LAB_GUIDE} />
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}

        {!lab ? (
          !error && (
            <div className="flex justify-center rounded-2xl bg-white p-10 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
              <Loader2 className="h-6 w-6 animate-spin text-[#5FBB46]" />
            </div>
          )
        ) : (
          <>
            <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5FBB46]">
                    {lab.kindLabel} · {lab.track} · {lab.level} level
                  </p>
                  <h1 className="mt-1 text-xl font-bold text-[#1C1D52]">
                    {lab.title}
                  </h1>
                  {lab.task && (
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      For your task: {lab.task.title} · pass mark{" "}
                      {lab.task.passMark}%
                    </p>
                  )}
                </div>
                {/* WordPress sites show their own (in-browser) save state. */}
                {lab.kind !== "WORDPRESS" && (
                  <span className="text-[10px] text-slate-400">
                    {saveState === "saving" || saveState === "pending"
                      ? "Saving…"
                      : saveState === "unsaved"
                        ? "Not saved, check your connection"
                        : "All changes saved"}
                  </span>
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                {lab.brief}
              </p>
            </section>

            {/* Every simulator can go full screen (Ads Studio has its own toggle). */}
            <FullscreenFrame ownControls={lab.kind === "ADS"}>
              {lab.kind === "ADS" ? (
                <AdsExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : lab.kind === "BACKEND" ? (
                <BackendExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : lab.kind === "CONTENT" ? (
                <ContentExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : lab.kind === "WORDPRESS" ? (
                <WordPressExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : lab.kind === "AUTOMATION" ? (
                <AutomationExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : lab.kind === "SOCIAL" ? (
                <SocialExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              ) : (
                <CodeExercise
                  lab={lab}
                  id={id}
                  taskId={taskId}
                  onSaveState={setSaveState}
                />
              )}
            </FullscreenFrame>
          </>
        )}
      </div>
    </InternshipShell>
  );
}

/** Saves the work this long after the intern stops changing it. */
function useAutosave(
  id: string,
  work: unknown,
  dirty: React.RefObject<boolean>,
  onSaveState: (state: SaveState) => void,
) {
  useEffect(() => {
    if (!work || !dirty.current) return;
    const timer = window.setTimeout(async () => {
      onSaveState("saving");
      const response = await fetch(`/api/internship/lab/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: work }),
      }).catch(() => null);
      dirty.current = false;
      onSaveState(response?.ok ? "saved" : "unsaved");
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [work, id, dirty, onSaveState]);
}

/**
 * Sends a submission; for a task-linked exercise the server also grades the
 * task. Returns the attempt (null on failure) and a message to show.
 */
async function sendSubmission(
  id: string,
  payload: Record<string, unknown>,
): Promise<{
  attempt: Attempt | null;
  message: NonNullable<Message>;
  /** Automations: the submitted run. */
  run?: InternAutomationLab["runs"][number];
  /** Backend APIs: the submitted test run. */
  backendRun?: InternBackendLab["runs"][number];
}> {
  const response = await fetch(`/api/internship/lab/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  const body = await response?.json().catch(() => ({}));
  if (!response?.ok)
    return {
      attempt: null,
      message: { text: body?.error ?? "Unable to submit.", error: true },
    };
  checkForAchievements();
  const attempt = body.attempt as Attempt;
  const run = body.run as InternAutomationLab["runs"][number] | undefined;
  const backendRun = body.backendRun as InternBackendLab["runs"][number] | undefined;
  const task = body.taskResult as LabTaskResult | null;
  if (!task)
    return { attempt, run, backendRun, message: { text: "Submitted. Nice work!", error: false } };
  if (!task.graded)
    return {
      attempt,
      run,
      backendRun,
      message: {
        text: `Your work is saved, but your task wasn't updated: ${task.reason}`,
        error: true,
      },
    };
  return {
    attempt,
    run,
    backendRun,
    message: task.pending
      ? {
          text: `You scored ${task.percent}% (pass mark ${task.passMark}%). A mentor will confirm your result shortly.`,
          error: false,
        }
      : task.passed
      ? {
          text: `Task passed with ${task.percent}% (pass mark ${task.passMark}%). Nice work!`,
          error: false,
        }
      : {
          text: `You scored ${task.percent}%, and this task needs ${task.passMark}% to pass. Improve your work and submit again before the deadline.`,
          error: true,
        },
  };
}

function StatusMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      className={`rounded-lg px-4 py-3 text-xs font-semibold ${message.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
      role="status"
    >
      {message.text}
    </p>
  );
}

function AdsExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternAdsLab>) {
  const [campaign, setCampaign] = useState<Campaign>(lab.campaign);
  const [runs, setRuns] = useState(lab.runs);
  const [submitted, setSubmitted] = useState(
    lab.attempt?.status === "SUBMITTED",
  );
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, campaign, dirty, onSaveState);

  return (
    <>
      <AdsSimulator
        config={lab.ads}
        campaign={campaign}
        onCampaignChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setCampaign(next);
        }}
        runs={runs}
        maxRuns={lab.ads.maxRuns}
        mediaEnabled={lab.mediaEnabled}
        onRun={async (plan) => {
          const response = await fetch(`/api/internship/lab/${id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign: plan }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok)
            return body?.error ?? "Unable to run the campaign.";
          // Running also saves the plan.
          dirty.current = false;
          onSaveState("saved");
          setRuns((current) => [...current, body.run]);
          return null;
        }}
        onSubmit={async (runIndex) => {
          setMessage(null);
          const result = await sendSubmission(id, { runIndex, taskId });
          if (result.attempt) setSubmitted(true);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
      />
      <StatusMessage message={message} />
      {submitted && !message && (
        <p className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
          You&apos;ve submitted this exercise. You can still submit a
          different run if you get a better one.
        </p>
      )}
    </>
  );
}

function AutomationExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternAutomationLab>) {
  const [workflow, setWorkflow] = useState<Workflow>(lab.workflow);
  const [runs, setRuns] = useState(lab.runs);
  const [submitted, setSubmitted] = useState(
    lab.attempt?.status === "SUBMITTED",
  );
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, workflow, dirty, onSaveState);

  return (
    <>
      <AutomationSimulator
        config={lab.automation}
        workflow={workflow}
        onWorkflowChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setWorkflow(next);
        }}
        runs={runs}
        maxRuns={lab.automation.maxRuns}
        onRun={async (next) => {
          const response = await fetch(`/api/internship/lab/${id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflow: next }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok)
            return body?.error ?? "Unable to run the workflow.";
          // Running also saves the workflow.
          dirty.current = false;
          onSaveState("saved");
          setRuns((current) => [...current, body.run]);
          return null;
        }}
        onSubmit={async () => {
          setMessage(null);
          const result = await sendSubmission(id, { files: workflow, taskId });
          if (result.attempt) {
            dirty.current = false;
            onSaveState("saved");
            setSubmitted(true);
          }
          const run = result.run;
          if (run) setRuns((current) => [...current, run]);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
      />
      <StatusMessage message={message} />
      {submitted && !message && (
        <p className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
          You&apos;ve submitted this exercise. You can improve your workflow
          and submit again.
        </p>
      )}
    </>
  );
}

function SocialExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternSocialLab>) {
  const [plan, setPlan] = useState<SocialPlan>(lab.plan);
  const [runs, setRuns] = useState(lab.runs);
  const [submitted, setSubmitted] = useState(
    lab.attempt?.status === "SUBMITTED",
  );
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, plan, dirty, onSaveState);

  return (
    <>
      <SocialSimulator
        config={lab.social}
        plan={plan}
        onPlanChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setPlan(next);
        }}
        runs={runs}
        maxRuns={lab.social.maxRuns}
        onRun={async (week) => {
          const response = await fetch(`/api/internship/lab/${id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: week }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok) return body?.error ?? "Unable to run the week.";
          // Running also saves the plan.
          dirty.current = false;
          onSaveState("saved");
          setRuns((current) => [...current, body.run]);
          return null;
        }}
        onReply={async (runIndex, replies) => {
          const response = await fetch(`/api/internship/lab/${id}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runIndex, replies }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok)
            return body?.error ?? "Unable to send your replies.";
          setRuns((current) =>
            current.map((run, index) => (index === runIndex ? body.run : run)),
          );
          return null;
        }}
        onSubmit={async (runIndex) => {
          setMessage(null);
          const result = await sendSubmission(id, { runIndex, taskId });
          if (result.attempt) setSubmitted(true);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
      />
      <StatusMessage message={message} />
      {submitted && !message && (
        <p className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
          You&apos;ve submitted this exercise. You can still submit a
          different week if you get a better one.
        </p>
      )}
    </>
  );
}

function BackendExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternBackendLab>) {
  const [files, setFiles] = useState<BackendFiles>(lab.files);
  const [runs, setRuns] = useState(lab.runs);
  const [attempt, setAttempt] = useState<Attempt | null>(lab.attempt);
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, files, dirty, onSaveState);
  useReviewPolling(id, attempt, lab.reviewEnabled, setAttempt);

  return (
    <>
      <BackendSimulator
        files={files}
        onFilesChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setFiles(next);
        }}
        databaseSql={lab.backend.databaseSql}
        env={lab.backend.env}
        tests={lab.backend.tests}
        hiddenTests={lab.backend.hiddenTests}
        submission={runs[runs.length - 1] ?? null}
        onSubmit={async () => {
          setMessage(null);
          const result = await sendSubmission(id, { files, taskId });
          if (result.attempt) {
            dirty.current = false;
            onSaveState("saved");
            setAttempt(result.attempt);
          }
          const run = result.backendRun;
          if (run) setRuns((current) => [...current, run]);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
        extraActions={
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Replace your code with the starter files?")) return;
              dirty.current = true;
              onSaveState("pending");
              setFiles(lab.starterFiles);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        }
      />
      <StatusMessage message={message} />
      <CodeReview attempt={attempt} reviewEnabled={lab.reviewEnabled} />
    </>
  );
}

function ContentExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternContentLab>) {
  const [work, setWork] = useState<ContentWork>(lab.work);
  const [runs, setRuns] = useState(lab.runs);
  const [submitted, setSubmitted] = useState(lab.attempt?.status === "SUBMITTED");
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, work, dirty, onSaveState);

  return (
    <>
      <ContentSimulator
        config={lab.content}
        work={work}
        onWorkChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setWork(next);
        }}
        runs={runs}
        aiEnabled={lab.aiEnabled}
        onRun={async (next) => {
          const response = await fetch(`/api/internship/lab/${id}/run`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ work: next }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok) return body?.error ?? "Unable to mark your work.";
          // Running also saves the work.
          dirty.current = false;
          onSaveState("saved");
          setRuns((current) => [...current, body.run]);
          return null;
        }}
        onSubmit={async (runIndex) => {
          setMessage(null);
          const result = await sendSubmission(id, { runIndex, taskId });
          if (result.attempt) setSubmitted(true);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
      />
      <StatusMessage message={message} />
      {submitted && !message && (
        <p className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
          You&apos;ve submitted this exercise. You can still submit a different run if you get a better one.
        </p>
      )}
    </>
  );
}

function WordPressExercise({
  lab,
  id,
  taskId,
}: ExerciseProps<InternWordPressLab>) {
  const [submitted, setSubmitted] = useState(lab.attempt?.status === "SUBMITTED");
  const [message, setMessage] = useState<Message>(null);

  return (
    <>
      <WordPressLab
        config={lab.wp}
        // The site is kept in this browser, one per exercise.
        storageKey={`wp-lab:${lab.id}`}
        snapshotForReview={Boolean(lab.task)}
        onSubmit={async ({ results, summary, files, snapshot }) => {
          setMessage(null);
          // For a task, mentors can open the site itself.
          const key = snapshot ? await uploadLabArtifact(id, "snapshot", snapshot) : null;
          const result = await sendSubmission(id, {
            files: { summary, files },
            checkResults: results,
            taskId,
            artifacts: key && snapshot ? { snapshot: { key, bytes: snapshot.size } } : undefined,
          });
          if (result.attempt) setSubmitted(true);
          setMessage(result.message);
        }}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
      />
      <StatusMessage message={message} />
      {submitted && !message && (
        <p className="rounded-lg bg-[#e8f7eb] px-4 py-3 text-xs font-semibold text-[#397d3a]">
          You&apos;ve submitted this exercise. You can keep improving your site
          and submit again.
        </p>
      )}
    </>
  );
}

function CodeExercise({
  lab,
  id,
  taskId,
  onSaveState,
}: ExerciseProps<InternCodeLab>) {
  const [files, setFiles] = useState<LabFiles>(lab.files);
  const [attempt, setAttempt] = useState<Attempt | null>(lab.attempt);
  const [message, setMessage] = useState<Message>(null);
  const dirty = useRef(false);
  useAutosave(id, files, dirty, onSaveState);

  // While a submitted attempt's AI review is being prepared, check for it.
  useReviewPolling(id, attempt, lab.reviewEnabled, setAttempt);

  const submit = useCallback(
    async (checkResults: LabCheckResult[]) => {
      setMessage(null);
      // For a task, mentors also see the site itself (desktop and phone).
      let artifacts: { screenshots: Array<{ key: string; label: string; width: number; height: number }> } | undefined;
      if (lab.task) {
        const shots = await captureLabScreenshots(lab.kind, files);
        const uploaded = await Promise.all(
          shots.map(async (shot) => {
            const key = await uploadLabArtifact(id, "screenshot", shot.blob);
            return key ? { key, label: shot.label, width: shot.width, height: shot.height } : null;
          }),
        );
        const screenshots = uploaded.filter((shot) => shot !== null);
        if (screenshots.length) artifacts = { screenshots };
      }
      const result = await sendSubmission(id, { files, checkResults, taskId, artifacts });
      if (result.attempt) {
        dirty.current = false;
        onSaveState("saved");
        setAttempt(result.attempt);
      }
      setMessage(result.message);
    },
    [files, id, taskId, onSaveState, lab.task, lab.kind],
  );

  return (
    <>
      <LabWorkspace
        kind={lab.kind}
        files={files}
        onFilesChange={(next) => {
          dirty.current = true;
          onSaveState("pending");
          setFiles(next);
        }}
        checks={lab.checks}
        onSubmit={submit}
        submitLabel={lab.task ? "Submit to task" : "Submit"}
        extraActions={
          <button
            type="button"
            onClick={() => {
              dirty.current = true;
              setFiles(lab.starterFiles);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        }
      />

      <StatusMessage message={message} />

      <CodeReview attempt={attempt} reviewEnabled={lab.reviewEnabled} />
    </>
  );
}

/** Polls for a submitted attempt's AI review until it's ready. */
function useReviewPolling(
  id: string,
  attempt: Attempt | null,
  reviewEnabled: boolean,
  setAttempt: (attempt: Attempt) => void,
) {
  const waitingForReview = Boolean(
    reviewEnabled &&
      attempt?.status === "SUBMITTED" &&
      !attempt.review &&
      !attempt.reviewUnavailable,
  );
  useEffect(() => {
    if (!waitingForReview) return;
    const started = Date.now();
    const timer = window.setInterval(async () => {
      if (Date.now() - started > REVIEW_POLL_LIMIT_MS) {
        window.clearInterval(timer);
        return;
      }
      const response = await fetch(`/api/internship/lab/${id}/attempt`, {
        cache: "no-store",
      }).catch(() => null);
      const body = await response?.json().catch(() => null);
      if (body?.attempt?.review || body?.attempt?.reviewUnavailable)
        setAttempt(body.attempt as Attempt);
    }, REVIEW_POLL_MS);
    return () => window.clearInterval(timer);
  }, [waitingForReview, id, setAttempt]);
}

function CodeReview({
  attempt,
  reviewEnabled,
}: {
  attempt: Attempt | null;
  reviewEnabled: boolean;
}) {
  return (
    <>
      {attempt?.status === "SUBMITTED" && (
        <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <Sparkles className="h-4 w-4 text-[#5FBB46]" /> Code review
          </h2>
          {attempt.review ? (
            <div className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
              <p>
                <span className="mr-2 rounded-full bg-[#e8f7eb] px-2.5 py-1 font-bold text-[#397d3a]">
                  {attempt.review.rating}/10
                </span>
                {attempt.review.summary}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <ReviewList
                  icon={<CheckCircle2 className="h-4 w-4 text-[#5FBB46]" />}
                  title="What's good"
                  items={attempt.review.strengths}
                />
                <ReviewList
                  icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
                  title="To improve"
                  items={attempt.review.improvements}
                />
              </div>
            </div>
          ) : reviewEnabled && attempt.reviewUnavailable ? (
            <p className="mt-2 text-xs text-slate-500">
              The AI reviewer is busy right now, so there&apos;s no written
              review for this submission. Your result still counts; submit
              again later if you&apos;d like a review.
            </p>
          ) : reviewEnabled ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#5FBB46]" />
              Reviewing your code… this usually takes under a minute.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Submitted {attempt.checksPassed ?? 0} of{" "}
              {attempt.checksTotal ?? 0} checks passed. You can keep improving
              and submit again.
            </p>
          )}
        </section>
      )}
    </>
  );
}

function ReviewList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl bg-[#f8fbff] p-4">
      <p className="flex items-center gap-2 font-bold text-[#1C1D52]">
        {icon} {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
