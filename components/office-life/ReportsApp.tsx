"use client";

import { ClipboardList, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { CoachCard, personById, timeLabel, type Act, type DayData, type StepView } from "./shared";

// Reports: the close of business report (and the build summary on the
// project day), sent to the manager, who replies.

type FormStep = Extract<StepView, { kind: "report" } | { kind: "work" }>;

export default function ReportsApp({ day, act, onSent }: { day: DayData; act: Act; onSent: (message: string) => void }) {
  const current = day.steps.find((step): step is FormStep => (step.kind === "report" || step.kind === "work") && step.available);
  const done = day.steps.filter((step): step is FormStep => (step.kind === "report" || step.kind === "work") && step.done);
  const [fields, setFields] = useState<string[]>(["", "", ""]);
  const [summary, setSummary] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manager = personById(day.people, "manager");

  async function send() {
    if (!current) return;
    setSending(true);
    setError(null);
    const failure =
      current.kind === "report"
        ? await act({ action: "report", stepId: current.id, fields })
        : await act({ action: "work", stepId: current.id, summary, link });
    setSending(false);
    if (failure) return setError(failure);
    setFields(["", "", ""]);
    setSummary("");
    setLink("");
    onSent(`Sent to ${manager.name.split(" ")[0]}. Their reply is below and in your inbox.`);
  }

  const field = "w-full rounded-lg border border-[#DADCE0] px-3 py-2 text-[14px] leading-6 outline-none focus:border-[#0B57D0]";

  return (
    <div className="h-full min-h-[560px] overflow-y-auto bg-[#F8F9FA] p-4 text-[#202124] sm:p-6">
      {current ? (
        <section className="mx-auto max-w-2xl rounded-xl bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-[18px] font-medium">
            <ClipboardList className="h-5 w-5 text-[#0B57D0]" /> {current.title}
          </p>
          <p className="mt-1 text-[13px] text-[#5F6368]">
            {current.task} To: {manager.name}, {manager.role}
          </p>
          <div className="mt-4 space-y-3">
            {current.kind === "report" ? (
              current.fields.map((label, i) => (
                <label key={label} className="block text-[13px] font-medium">
                  {label}
                  <textarea
                    value={fields[i]}
                    onChange={(e) => setFields(fields.map((value, j) => (j === i ? e.target.value : value)))}
                    rows={3}
                    maxLength={2000}
                    className={`${field} mt-1 font-normal`}
                  />
                </label>
              ))
            ) : (
              <>
                <label className="block text-[13px] font-medium">
                  What you built, why, and how it meets the client&apos;s needs
                  <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} maxLength={3000} className={`${field} mt-1 font-normal`} />
                </label>
                <label className="block text-[13px] font-medium">
                  Link or details for review (optional)
                  <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} className={`${field} mt-1 font-normal`} placeholder="e.g. your Practice Lab exercise, or what to look at" />
                </label>
              </>
            )}
          </div>
          {error && <p className="mt-2 text-[13px] text-[#C5221F]">{error}</p>}
          <button
            type="button"
            disabled={sending}
            onClick={() => void send()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0B57D0] px-6 py-2 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : `Send to ${manager.name.split(" ")[0]}`}
          </button>
        </section>
      ) : (
        <p className="mx-auto max-w-2xl rounded-xl bg-white p-5 text-[14px] text-[#5F6368] shadow-sm">No report due right now. Your reports appear here once you send them.</p>
      )}

      {done.map((step) => (
        <section key={step.id} className="mx-auto mt-4 max-w-2xl rounded-xl bg-white p-5 shadow-sm">
          <p className="text-[15px] font-medium">
            {step.title} <span className="text-[12px] font-normal text-[#5F6368]">sent {timeLabel(step.at)}</span>
          </p>
          <div className="mt-2 space-y-2 text-[13px] text-[#3C4043]">
            {step.submission?.kind === "report" &&
              step.submission.fields.map((item) => (
                <p key={item.label}>
                  <strong>{item.label}:</strong> {item.text || "(left empty)"}
                </p>
              ))}
            {step.submission?.kind === "work" && <p className="whitespace-pre-line">{step.submission.summary}</p>}
          </div>
          {step.feedback && (
            <>
              <div className="mt-3 rounded-lg border-l-4 border-[#1565C0] bg-[#F1F3F4] px-4 py-3 text-[13px]">
                <p className="font-semibold">{manager.name} replied:</p>
                <p className="mt-1 whitespace-pre-line">{step.feedback.reply}</p>
              </div>
              <CoachCard feedback={step.feedback} />
            </>
          )}
        </section>
      ))}
    </div>
  );
}
