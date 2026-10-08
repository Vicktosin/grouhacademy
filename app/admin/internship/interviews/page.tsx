"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Mic,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/AdminShell";

type Option = { id: string; name: string };
type Setup = {
  id?: string;
  programId: string;
  levelId: string;
  title: string;
  instructions: string;
  questions: string[];
  durationMinutes: number;
  maxAttempts: number;
  active: boolean;
  sessionCount?: number;
};
type SessionRow = {
  id: string;
  intern: string;
  email: string;
  track: string;
  level: string;
  mode: "VIDEO" | "AUDIO";
  status: string;
  score: number | null;
  createdAt: string;
  errorMessage: string | null;
};
type Payload = {
  configured: {
    tavus: boolean;
    grading: boolean;
    freePlan: boolean;
    freePlanMinutes: number;
  };
  tracks: Option[];
  levels: Option[];
  setups: Setup[];
  sessions: SessionRow[];
};

const blankSetup = (programId: string, levelId: string): Setup => ({
  programId,
  levelId,
  title: "Practice job interview",
  instructions: "",
  questions: [
    "Tell me about yourself and why you chose this field.",
    "Describe a project you're proud of and your part in it.",
    "Tell me about a time something went wrong and how you handled it.",
  ],
  durationMinutes: 15,
  maxAttempts: 3,
  active: true,
});

export default function AdminInterviewsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [programId, setProgramId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [draft, setDraft] = useState<Setup | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const load = () =>
    fetch("/api/admin/internship/interviews", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as Payload;
        setData(payload);
        setProgramId((current) => current || payload.tracks[0]?.id || "");
        setLevelId((current) => current || payload.levels[0]?.id || "");
      })
      .catch(() =>
        setMessage({ text: "Unable to load interviews.", error: true }),
      );

  useEffect(() => {
    void load();
  }, []);

  const saved = useMemo(
    () =>
      data?.setups.find(
        (setup) => setup.programId === programId && setup.levelId === levelId,
      ) ?? null,
    [data, programId, levelId],
  );

  // Edit a copy of the saved setup (or a starter) for the chosen pair.
  const editing =
    draft && draft.programId === programId && draft.levelId === levelId
      ? draft
      : (saved ?? blankSetup(programId, levelId));
  const change = (patch: Partial<Setup>) => {
    setDraft({ ...editing, ...patch });
    setMessage(null);
  };

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/internship/interviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          questions: editing.questions.map((q) => q.trim()).filter(Boolean),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save.");
      setDraft(null);
      await load();
      setMessage({ text: "Interview saved.", error: false });
    } catch (saveError) {
      setMessage({
        text:
          saveError instanceof Error ? saveError.message : "Unable to save.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  const moveQuestion = (index: number, by: -1 | 1) => {
    const questions = [...editing.questions];
    [questions[index], questions[index + by]] = [
      questions[index + by],
      questions[index],
    ];
    change({ questions });
  };

  return (
    <AdminShell workspace="internship">
      <div className="mx-auto max-w-[1300px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">
            Practice interviews
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            Interns take a live practice interview with the Tavus AI interviewer
            (video or voice), then Claude scores the transcript and gives them
            feedback. Set the questions for each track and level here.
          </p>
        </header>

        {data && !data.configured.tavus && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Tavus isn&apos;t configured on this server (TAVUS_API_KEY,
            TAVUS_PAL_ID, TAVUS_WEBHOOK_SECRET), so interns can&apos;t start
            interviews yet.
          </p>
        )}
        {data && (data.configured.freePlan || !data.configured.grading) && (
          <ul className="list-disc space-y-1 rounded-lg bg-sky-50 py-3 pl-8 pr-4 text-xs text-sky-800">
            {data.configured.freePlan && (
              <li>
                Tavus free plan: every interview is kept to{" "}
                {data.configured.freePlanMinutes} minutes (the plan ends calls
                at 5), only one can run at a time, and there are 25 minutes a
                month in total. Use 2–3 short questions.
              </li>
            )}
            {!data.configured.grading && (
              <li>
                Automatic scoring is off (no AI key: add ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY or GROQ_API_KEY). Interviews
                still run and transcripts are kept here; once a key is added,
                use Re-score on any interview.
              </li>
            )}
          </ul>
        )}

        {message && (
          <p
            className={`rounded-lg px-4 py-3 text-xs font-semibold ${message.error ? "bg-red-50 text-red-700" : "bg-[#e8f7eb] text-[#397d3a]"}`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-[10px] font-semibold text-slate-500">
              Track
              <select
                value={programId}
                onChange={(event) => setProgramId(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
              >
                {data?.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-[10px] font-semibold text-slate-500">
              Level
              <select
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]"
              >
                {data?.levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[10px] text-slate-400 sm:pb-3">
              {saved
                ? `${saved.active ? "Live" : "Turned off"} · ${saved.sessionCount ?? 0} interviews taken`
                : "Not set up yet"}
            </span>
          </div>

          {programId && levelId && (
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <Field label="Title">
                  <input
                    value={editing.title}
                    onChange={(event) => change({ title: event.target.value })}
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                  />
                </Field>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                      Questions (asked in this order)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        change({ questions: [...editing.questions, ""] })
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
                    >
                      <Plus className="h-3 w-3" /> Add question
                    </button>
                  </div>
                  <ol className="space-y-2">
                    {editing.questions.map((question, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="mt-2.5 w-5 text-[10px] font-bold text-slate-400">
                          {index + 1}
                        </span>
                        <textarea
                          value={question}
                          rows={2}
                          onChange={(event) => {
                            const questions = [...editing.questions];
                            questions[index] = event.target.value;
                            change({ questions });
                          }}
                          className="flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                        />
                        <div className="flex flex-col">
                          <IconButton
                            label="Move up"
                            disabled={index === 0}
                            onClick={() => moveQuestion(index, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Move down"
                            disabled={index === editing.questions.length - 1}
                            onClick={() => moveQuestion(index, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                        <IconButton
                          label="Remove question"
                          onClick={() =>
                            change({
                              questions: editing.questions.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </IconButton>
                      </li>
                    ))}
                  </ol>
                </div>
                <Field label="Notes for the interviewer (optional)">
                  <textarea
                    value={editing.instructions}
                    rows={3}
                    onChange={(event) =>
                      change({ instructions: event.target.value })
                    }
                    placeholder="e.g. Probe for practical experience with automation tools like Zapier or n8n."
                    className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-[#1C1D52] outline-none focus:border-[#5FBB46]"
                  />
                </Field>
              </div>
              <div className="space-y-4 rounded-xl bg-[#f8fbff] p-4">
                <Field
                  label={
                    data?.configured.freePlan &&
                    editing.durationMinutes > data.configured.freePlanMinutes
                      ? `Length (minutes) — runs as ${data.configured.freePlanMinutes} on the free plan`
                      : "Length (minutes)"
                  }
                >
                  <input
                    type="number"
                    min={5}
                    max={45}
                    value={editing.durationMinutes}
                    onChange={(event) =>
                      change({ durationMinutes: Number(event.target.value) })
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
                  />
                </Field>
                <Field label="Attempts per intern at this level">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editing.maxAttempts}
                    onChange={(event) =>
                      change({ maxAttempts: Number(event.target.value) })
                    }
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-[#1C1D52]"
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs text-[#1C1D52]">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(event) =>
                      change({ active: event.target.checked })
                    }
                    className="accent-[#5FBB46]"
                  />
                  Interns can take this interview
                </label>
                <p className="text-[10px] leading-4 text-slate-500">
                  Tavus bills per minute. Length × attempts × interns is the
                  most this can use.
                </p>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : saved
                      ? "Save changes"
                      : "Create interview"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-[0_7px_20px_rgba(28,29,82,0.08)] sm:p-5">
          <h2 className="text-sm font-bold text-[#1C1D52]">Results</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-[#f8fbff] text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Intern</th>
                  <th className="px-3 py-3">Track · Level</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="text-[11px] text-[#1C1D52]">
                {data?.sessions.map((session) => (
                  <tr key={session.id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="font-semibold">{session.intern}</p>
                      <p className="text-[10px] text-slate-400">
                        {session.email}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {session.track} · {session.level}
                    </td>
                    <td className="px-3 py-3">
                      {session.mode === "VIDEO" ? (
                        <Video className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Mic className="h-4 w-4 text-slate-400" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {new Date(session.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {session.status}
                      {session.errorMessage && (
                        <span className="block text-[10px] text-amber-700">
                          Needs attention
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-bold">
                      {session.score !== null ? `${session.score}/100` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpenSessionId(session.id)}
                        className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.sessions.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              No interviews taken yet.
            </p>
          )}
        </section>
      </div>

      {openSessionId && (
        <SessionDetail
          id={openSessionId}
          onClose={() => setOpenSessionId(null)}
          onRescored={() => void load()}
        />
      )}
    </AdminShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

type Detail = {
  intern: string;
  email: string;
  track: string;
  level: string;
  mode: string;
  status: string;
  shutdownReason: string | null;
  transcript: Array<{
    role: string;
    content: string;
    seconds_from_start?: number;
  }>;
  score: number | null;
  feedback: {
    summary: string;
    strengths: string[];
    improvements: string[];
    questions: Array<{ question: string; score: number; feedback: string }>;
  } | null;
  errorMessage: string | null;
};

function SessionDetail({
  id,
  onClose,
  onRescored,
}: {
  id: string;
  onClose: () => void;
  onRescored: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/internship/interviews/${id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setDetail(body?.session ?? null))
      .catch(() => setDetail(null));
  }, [id]);

  async function rescore() {
    const response = await fetch(`/api/admin/internship/interviews/${id}`, {
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    setNotice(
      response.ok
        ? "Re-scoring started. Refresh in a minute to see the new score."
        : (body.error ?? "Unable to re-score."),
    );
    if (response.ok) onRescored();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#11132f]/60"
      role="dialog"
      aria-modal="true"
      aria-label="Interview details"
    >
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#f7f9fc] shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1C1D52]">
              {detail?.intern ?? "Interview"}
            </h2>
            {detail && (
              <p className="text-xs text-slate-500">
                {detail.track} · {detail.level} ·{" "}
                {detail.mode === "VIDEO" ? "Video" : "Voice"} · {detail.status}
                {detail.score !== null ? ` · ${detail.score}/100` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!detail ? (
          <p className="p-6 text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="space-y-4 p-5">
            {(detail.errorMessage || notice) && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {notice ?? detail.errorMessage}
              </p>
            )}
            {detail.transcript.length > 0 && (
              <button
                type="button"
                onClick={() => void rescore()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1C1D52]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-score
              </button>
            )}
            {detail.feedback && (
              <section className="rounded-xl bg-white p-4 text-xs text-slate-600">
                <p className="font-semibold text-[#1C1D52]">
                  {detail.feedback.summary}
                </p>
                {detail.feedback.questions.map((item, index) => (
                  <p key={index} className="mt-2">
                    <strong className="text-[#1C1D52]">
                      Q{index + 1} ({item.score}/10):
                    </strong>{" "}
                    {item.feedback}
                  </p>
                ))}
              </section>
            )}
            <section className="rounded-xl bg-white p-4">
              <h3 className="text-sm font-bold text-[#1C1D52]">Transcript</h3>
              {detail.transcript.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  No transcript yet
                  {detail.shutdownReason
                    ? ` (ended: ${detail.shutdownReason})`
                    : ""}
                  .
                </p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {detail.transcript.map((turn, index) => (
                    <li
                      key={index}
                      className={`rounded-lg px-3 py-2 text-xs leading-5 ${turn.role === "user" ? "bg-[#e8f7eb] text-[#1C1D52]" : "bg-slate-50 text-slate-600"}`}
                    >
                      <span className="font-semibold">
                        {turn.role === "user" ? "Intern" : "Interviewer"}:{" "}
                      </span>
                      {turn.content}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
