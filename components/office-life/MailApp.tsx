"use client";

import { ArrowLeft, Inbox, Loader2, PenSquare, Reply, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Feedback } from "@/lib/office-life/grade";
import type { PersonId } from "@/lib/office-life/story";
import { Avatar, CoachCard, personById, timeLabel, type Act, type DayData, type PersonView, type StepView } from "./shared";

// Mail: an inbox like any work email app. Emails from the manager and the
// client arrive as the workday moves on; the intern writes and sends real
// replies to people at the company, who answer in character.

type Mail = {
  id: string;
  folder: "inbox" | "sent";
  from: PersonView | "you";
  to: PersonId[];
  cc: PersonId[];
  subject: string;
  body: string;
  at: string | null;
  unread: boolean;
  /** An email the intern must open to move on. */
  readStep?: string;
  feedback?: Feedback;
};

function mailbox(day: DayData): Mail[] {
  const mails: Mail[] = [];
  const person = (id: PersonId) => personById(day.people, id);
  for (const step of day.steps) {
    if (step.kind === "inbox" && (step.available || step.done))
      mails.push({
        id: step.id,
        folder: "inbox",
        from: person(step.from),
        to: [],
        cc: [],
        subject: step.subject,
        body: step.body,
        at: step.at ?? day.clockedInAt,
        unread: !step.done,
        readStep: step.available ? step.id : undefined,
      });
    if (!step.done || !step.submission || !step.feedback) continue;
    const submission = step.submission;
    const subject =
      submission.kind === "email" ? submission.subject || "(no subject)" : step.kind === "meeting" ? `Notes: ${step.title}` : step.title;
    if (submission.kind === "email")
      mails.push({ id: `${step.id}-sent`, folder: "sent", from: "you", to: submission.to, cc: submission.cc, subject, body: submission.body, at: step.at, unread: false });
    if (submission.kind === "report")
      mails.push({
        id: `${step.id}-sent`,
        folder: "sent",
        from: "you",
        to: ["manager"],
        cc: [],
        subject,
        body: submission.fields.map((field) => `${field.label}\n${field.text}`).join("\n\n"),
        at: step.at,
        unread: false,
      });
    if (submission.kind === "work")
      mails.push({
        id: `${step.id}-sent`,
        folder: "sent",
        from: "you",
        to: ["manager"],
        cc: [],
        subject,
        body: `${submission.summary}${submission.link ? `\n\n${submission.link}` : ""}`,
        at: step.at,
        unread: false,
      });
    mails.push({
      id: `${step.id}-reply`,
      folder: "inbox",
      from: person(step.feedback.from),
      to: [],
      cc: [],
      subject: step.kind === "meeting" ? subject : `Re: ${subject}`,
      body: step.feedback.reply,
      at: step.at,
      unread: false,
      feedback: step.feedback,
    });
  }
  return mails.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
}

const snippet = (text: string) => text.replace(/\s+/g, " ").slice(0, 90);

export default function MailApp({ day, act, onSent }: { day: DayData; act: Act; onSent: (message: string) => void }) {
  const [folder, setFolder] = useState<"inbox" | "sent">("inbox");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ to: PersonId[]; cc: PersonId[]; subject: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mails = useMemo(() => mailbox(day), [day]);
  const shown = mails.filter((mail) => mail.folder === folder);
  const open = mails.find((mail) => mail.id === openId) ?? null;
  const unread = mails.filter((mail) => mail.folder === "inbox" && mail.unread).length;
  const emailStep = day.steps.find((step): step is Extract<StepView, { kind: "email" }> => step.kind === "email" && step.available);

  async function openMail(mail: Mail) {
    setOpenId(mail.id);
    if (mail.readStep) await act({ action: "read", stepId: mail.readStep });
  }

  function compose(prefill?: Partial<NonNullable<typeof draft>>) {
    setError(null);
    setDraft({ to: [], cc: [], subject: "", body: "", ...prefill });
  }

  async function send() {
    if (!draft || !emailStep) return;
    setSending(true);
    setError(null);
    const failure = await act({ action: "email", stepId: emailStep.id, ...draft });
    setSending(false);
    if (failure) return setError(failure);
    const to = draft.to.map((id) => personById(day.people, id).name.split(" ")[0]).join(" and ");
    setDraft(null);
    setFolder("inbox");
    setOpenId(`${emailStep.id}-reply`);
    onSent(`Sent. ${to} replied.`);
  }

  return (
    <div className="relative flex h-full min-h-[560px] bg-white text-[#202124]">
      {/* Folders */}
      <aside className="hidden w-52 shrink-0 flex-col gap-1 border-r border-[#E8EAED] p-3 sm:flex">
        <button
          type="button"
          onClick={() => compose()}
          disabled={!emailStep}
          title={emailStep ? "Write an email" : "Nothing to send right now"}
          className="mb-2 inline-flex items-center gap-3 rounded-2xl bg-[#C2E7FF] px-5 py-3.5 text-[14px] font-medium text-[#001D35] shadow-sm hover:shadow disabled:opacity-50"
        >
          <PenSquare className="h-5 w-5" /> Compose
        </button>
        {(
          [
            ["inbox", "Inbox", Inbox, unread],
            ["sent", "Sent", Send, 0],
          ] as const
        ).map(([key, label, Icon, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFolder(key);
              setOpenId(null);
            }}
            className={`flex items-center gap-3 rounded-r-full px-4 py-1.5 text-[14px] ${folder === key ? "bg-[#D3E3FD] font-bold" : "hover:bg-[#F1F3F4]"}`}
          >
            <Icon className="h-4 w-4" /> <span className="flex-1 text-left">{label}</span>
            {count > 0 && <span className="text-[12px] font-bold">{count}</span>}
          </button>
        ))}
        <div className="mt-4 border-t border-[#E8EAED] pt-3 text-[12px] text-[#5F6368]">
          <p className="mb-1 font-semibold text-[#202124]">Directory</p>
          {day.people.map((person) => (
            <p key={person.id} className="truncate" title={`${person.name}, ${person.role}`}>
              {person.email}
            </p>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {emailStep && (
          <div className="flex flex-wrap items-center gap-3 border-b border-[#FDD663] bg-[#FEF7E0] px-4 py-2.5 text-[13px]">
            <span className="min-w-0 flex-1">
              <strong>Your task:</strong> {emailStep.task}
            </span>
            <button type="button" onClick={() => compose()} className="rounded-full bg-[#0B57D0] px-4 py-1.5 font-medium text-white">
              Write it
            </button>
          </div>
        )}
        {/* Phones: folder switch and compose */}
        <div className="flex items-center gap-2 border-b border-[#E8EAED] px-3 py-2 sm:hidden">
          {(["inbox", "sent"] as const).map((key) => (
            <button key={key} type="button" onClick={() => setFolder(key)} className={`rounded-full px-3 py-1 text-[13px] ${folder === key ? "bg-[#D3E3FD] font-bold" : ""}`}>
              {key === "inbox" ? `Inbox${unread ? ` (${unread})` : ""}` : "Sent"}
            </button>
          ))}
          <button type="button" disabled={!emailStep} onClick={() => compose()} className="ml-auto rounded-full bg-[#C2E7FF] px-3 py-1 text-[13px] font-medium disabled:opacity-50">
            Compose
          </button>
        </div>

        {open ? (
          <article className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8">
            <button type="button" onClick={() => setOpenId(null)} className="mb-3 inline-flex items-center gap-1 text-[13px] text-[#5F6368] hover:text-[#202124]">
              <ArrowLeft className="h-4 w-4" /> Back to {open.folder}
            </button>
            <h2 className="text-[22px] text-[#1F1F1F]">{open.subject}</h2>
            <div className="mt-4 flex items-start gap-3">
              <Avatar person={open.from} />
              <div className="min-w-0 flex-1 text-[13px]">
                <p>
                  <strong>{open.from === "you" ? `${day.you} (you)` : open.from.name}</strong>{" "}
                  <span className="text-[#5F6368]">&lt;{open.from === "you" ? `${day.you.toLowerCase()}@${day.company.domain}` : open.from.email}&gt;</span>
                </p>
                {open.folder === "sent" && (
                  <p className="text-[#5F6368]">
                    to {open.to.map((id) => personById(day.people, id).name).join(", ")}
                    {open.cc.length > 0 && `, cc ${open.cc.map((id) => personById(day.people, id).name).join(", ")}`}
                  </p>
                )}
              </div>
              <span className="text-[12px] text-[#5F6368]">{timeLabel(open.at)}</span>
            </div>
            <p className="mt-5 whitespace-pre-line text-[14px] leading-6">{open.body}</p>
            {open.from !== "you" && emailStep && emailStep.to.includes(open.from.id) && (
              <button
                type="button"
                onClick={() =>
                  compose({
                    to: [(open.from as PersonView).id],
                    subject: open.subject.startsWith("Re:") ? open.subject : `Re: ${open.subject}`,
                  })
                }
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#747775] px-5 py-2 text-[14px] font-medium hover:bg-[#F1F3F4]"
              >
                <Reply className="h-4 w-4" /> Reply
              </button>
            )}
            {open.feedback && <CoachCard feedback={open.feedback} />}
          </article>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {shown.length === 0 && <li className="p-8 text-center text-[14px] text-[#5F6368]">Nothing here yet.</li>}
            {shown.map((mail) => (
              <li key={mail.id}>
                <button
                  type="button"
                  onClick={() => void openMail(mail)}
                  className={`flex w-full items-center gap-3 border-b border-[#F1F3F4] px-4 py-2.5 text-left text-[14px] hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_rgba(60,64,67,.3)] ${mail.unread ? "bg-white font-bold" : "bg-[#F2F6FC]"}`}
                >
                  <Avatar person={mail.from} size="h-8 w-8 text-[12px]" />
                  <span className="w-36 shrink-0 truncate">
                    {mail.from === "you" ? `To: ${mail.to.map((id) => personById(day.people, id).name.split(" ")[0]).join(", ")}` : mail.from.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {mail.subject} <span className="font-normal text-[#5F6368]">- {snippet(mail.body)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-normal text-[#5F6368]">{timeLabel(mail.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Compose window */}
      {draft && emailStep && (
        <div className="absolute inset-x-2 bottom-2 z-20 flex max-h-[90%] flex-col overflow-hidden rounded-t-xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] sm:left-auto sm:right-6 sm:w-[520px]">
          <div className="flex items-center justify-between bg-[#F2F6FC] px-4 py-2.5 text-[14px] font-medium">
            New message
            <button type="button" onClick={() => setDraft(null)} aria-label="Close" className="rounded p-1 hover:bg-[#E8EAED]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(["to", "cc"] as const).map((field) => (
              <div key={field} className="flex flex-wrap items-center gap-1.5 border-b border-[#F1F3F4] px-4 py-2 text-[13px]">
                <span className="w-7 text-[#5F6368]">{field === "to" ? "To" : "Cc"}</span>
                {day.people.map((person) => {
                  const chosen = draft[field].includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      title={`${person.name}, ${person.role}`}
                      onClick={() =>
                        setDraft((latest) => {
                          if (!latest) return latest;
                          const other = field === "to" ? "cc" : "to";
                          const on = latest[field].includes(person.id);
                          return {
                            ...latest,
                            [field]: on ? latest[field].filter((id) => id !== person.id) : [...latest[field], person.id],
                            // Someone is either in To or in Cc.
                            ...(on ? {} : { [other]: latest[other].filter((id) => id !== person.id) }),
                          };
                        })
                      }
                      className={`rounded-full border px-2 py-0.5 ${chosen ? "border-[#0B57D0] bg-[#D3E3FD] text-[#041E49]" : "border-[#DADCE0] text-[#5F6368] hover:bg-[#F1F3F4]"}`}
                    >
                      {person.email}
                    </button>
                  );
                })}
              </div>
            ))}
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Subject"
              maxLength={200}
              className="w-full border-b border-[#F1F3F4] px-4 py-2.5 text-[14px] outline-none"
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={11}
              maxLength={4000}
              placeholder="Write your email"
              className="w-full resize-none px-4 py-3 text-[14px] leading-6 outline-none"
            />
          </div>
          {error && <p className="px-4 pb-1 text-[13px] text-[#C5221F]">{error}</p>}
          <div className="flex items-center gap-3 border-t border-[#F1F3F4] px-4 py-2.5">
            <button
              type="button"
              disabled={sending || !draft.to.length || !draft.body.trim()}
              onClick={() => void send()}
              className="inline-flex items-center gap-2 rounded-full bg-[#0B57D0] px-6 py-2 text-[14px] font-medium text-white disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {sending ? "Sending…" : "Send"}
            </button>
            <span className="text-[12px] text-[#5F6368]">Emails stay inside Office Life.</span>
          </div>
        </div>
      )}
    </div>
  );
}
