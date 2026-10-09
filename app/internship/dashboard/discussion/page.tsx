"use client";

import PageGuide from "@/components/onboarding/PageGuide";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Phone,
  Send,
  X,
} from "lucide-react";
import InternshipShell from "@/components/InternshipShell";
import { useChatPolling } from "@/lib/use-chat-polling";

/** A teammate's number; sent only to the group leader. */
type Contact = { phone: string; whatsapp: string | null };
type Member = {
  userId: string;
  name: string;
  isLeader: boolean;
  isMe: boolean;
  /** Present (possibly null) only when you're the group leader. */
  contact?: Contact | null;
};
type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  /** Posted by the academy team (an admin), not a group member. */
  fromTeam?: boolean;
};
type Meeting = {
  title: string;
  scheduledLabel: string;
  createdByName: string | null;
};
type MemberProfile = {
  visible: boolean;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  skills?: string[];
  isLeader: boolean;
  progressPercent?: number;
  completedTasks?: number;
  totalTasks?: number;
  contact?: Contact | null;
};


function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const knownIds = new Set(current.map((message) => message.id));
  const newMessages = incoming.filter((message) => !knownIds.has(message.id));
  return newMessages.length === 0 ? current : [...current, ...newMessages];
}

export default function DiscussionPage() {
  const [groupNumber, setGroupNumber] = useState<number | null>(null);
  // The group's Realtime channel (see lib/realtime).
  const [realtimeTopic, setRealtimeTopic] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(
    null,
  );
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingDateTime, setMeetingDateTime] = useState("");
  const [schedulingMeeting, setSchedulingMeeting] = useState(false);

  const lastFetchedAt = useRef<string | null>(null);
  const isPolling = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadGroup(initial: boolean) {
    if (!initial && isPolling.current) return;
    if (!initial) isPolling.current = true;

    try {
      const url = new URL("/api/internship/group", window.location.origin);
      if (!initial && lastFetchedAt.current)
        url.searchParams.set("after", lastFetchedAt.current);

      const response = await fetch(url.toString());
      const body = await response.json();

      if (!response.ok) {
        if (initial) setError(body?.error ?? "Unable to load your group.");
        return;
      }

      if (initial) {
        setRealtimeTopic(body.realtimeTopic ?? null);
        setGroupNumber(body.groupNumber);
        setIsLeader(body.isLeader);
        setMembers(body.members);
        setMeeting(body.meeting);
        setMessages(body.messages);
      } else if (body.messages.length > 0) {
        setMessages((current) => mergeMessages(current, body.messages));
      }

      if (body.messages.length > 0) {
        const newestMessage = body.messages[body.messages.length - 1];
        if (
          !lastFetchedAt.current ||
          newestMessage.createdAt > lastFetchedAt.current
        ) {
          lastFetchedAt.current = newestMessage.createdAt;
        }
      }
      setError(null);
      // Tells the polling whether anything new came in.
      return !initial && body.messages.length > 0;
    } catch {
      if (initial) setError("Unable to load your group.");
    } finally {
      if (initial) setLoading(false);
      else isPolling.current = false;
    }
  }

  useEffect(() => {
    const first = window.setTimeout(() => void loadGroup(true), 0);
    return () => window.clearTimeout(first);
  }, []);
  // New messages: live, or often while the group is talking and rarely
  // when it's quiet (see useChatPolling).
  const bumpPolling = useChatPolling(() => loadGroup(false), { topic: realtimeTopic });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/internship/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to send message.");

      setMessages((current) => mergeMessages(current, [body]));
      if (!lastFetchedAt.current || body.createdAt > lastFetchedAt.current) {
        lastFetchedAt.current = body.createdAt;
      }
      setDraft("");
      // Replies are likely soon: check often again.
      bumpPolling();
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send message.",
      );
    } finally {
      setSending(false);
    }
  }

  async function openMemberProfile(member: Member) {
    setSelectedMember(member);
    setMemberProfile(null);
    setLoadingProfile(true);
    try {
      const response = await fetch(
        `/api/internship/group/member?userId=${encodeURIComponent(member.userId)}`,
      );
      const body = await response.json();
      if (response.ok) setMemberProfile(body);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function scheduleMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meetingDateTime) return;
    setSchedulingMeeting(true);
    setError(null);
    try {
      const response = await fetch("/api/internship/group/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(meetingDateTime).toISOString(),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to schedule meeting.");
      setShowMeetingForm(false);
      setMeetingDateTime("");
      loadGroup(true);
    } catch (scheduleError) {
      setError(
        scheduleError instanceof Error
          ? scheduleError.message
          : "Unable to schedule meeting.",
      );
    } finally {
      setSchedulingMeeting(false);
    }
  }

  if (loading) {
    return (
      <InternshipShell>
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          Loading your group...
        </p>
      </InternshipShell>
    );
  }

  if (error && messages.length === 0 && members.length === 0) {
    return (
      <InternshipShell>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm text-red-700">
          {error}
        </div>
      </InternshipShell>
    );
  }

  return (
    <InternshipShell>
      <div className="mb-4">
        <PageGuide section="discussion" />
      </div>
      <div className="grid min-h-[calc(100dvh-104px)] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)] sm:p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-[#1C1D52]">
              Group {groupNumber}
            </h1>
            <span className="rounded-full bg-[#eaf1ff] px-3 py-1 text-[10px] font-semibold text-[#1C1D52]">
              {members.length} members
            </span>
          </div>
          <div className="mt-5">
            {members.map((member) => (
              <button
                key={member.userId}
                type="button"
                onClick={() => openMemberProfile(member)}
                className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-3 text-left transition hover:bg-[#f8fafc]"
              >
                <span>
                  <strong className="block text-sm text-[#1C1D52]">
                    {member.name}
                    {member.isMe ? " (You)" : ""}
                  </strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    {member.isLeader ? "Group Leader" : "Intern"}
                  </span>
                  {member.contact && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[#1C1D52]">
                      <Phone className="h-3 w-3" /> {member.contact.phone}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
          <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-xl font-bold text-[#1C1D52]">
                Group {groupNumber} - Discussion
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {meeting
                  ? `Next meeting: ${meeting.scheduledLabel}`
                  : "No meeting scheduled"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLeader && (
                <button
                  type="button"
                  onClick={() => setShowMeetingForm((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${meeting ? "bg-[#e8f7eb] text-[#397d3a]" : "text-[#1C1D52] shadow-[inset_0_0_0_2px_#1C1D52]"}`}
                >
                  <CalendarDays className="h-4 w-4" />
                  {meeting ? "Reschedule Meeting" : "Schedule Meeting"}
                </button>
              )}
              <Link
                href="/internship/dashboard/tasks"
                className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4aaa3e]"
              >
                <ClipboardList className="h-4 w-4" />
                Group tasks
              </Link>
            </div>
          </header>

          {showMeetingForm && (
            <form
              onSubmit={scheduleMeeting}
              className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3"
            >
              <input
                type="datetime-local"
                value={meetingDateTime}
                onChange={(e) => setMeetingDateTime(e.target.value)}
                required
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={schedulingMeeting}
                className="rounded-lg bg-[#5FBB46] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {schedulingMeeting ? "Scheduling…" : "Confirm"}
              </button>
            </form>
          )}

          {error && (
            <p className="border-b border-slate-200 px-5 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <div
            ref={scrollRef}
            className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-16"
          >
            {messages.length === 0 ? (
              <p className="text-center text-sm text-slate-400">
                No messages yet — say hello to your group!
              </p>
            ) : (
              messages.map((message) => {
                const sender = members.find(
                  (m) => m.userId === message.senderId,
                );
                return (
                  <article
                    key={message.id}
                    className={
                      message.isMine
                        ? "ml-auto max-w-[88%] text-right"
                        : "max-w-[88%]"
                    }
                  >
                    <div className={`flex items-center gap-2 text-xs font-bold text-[#1C1D52] ${message.isMine ? "justify-end" : ""}`}>
                      {message.fromTeam ? (
                        <span className="inline-flex items-center gap-1.5">
                          Grouh Academy team
                          <span className="rounded-full bg-[#1C1D52] px-2 py-0.5 text-[9px] font-semibold text-white">
                            Admin
                          </span>
                        </span>
                      ) : (
                        (sender?.name ?? "Member")
                      )}
                      <span className="font-normal text-slate-400">
                        {new Date(message.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p
                      className={`mt-2 whitespace-pre-line rounded-xl px-3 py-3 text-left text-sm leading-5 ${message.isMine ? "bg-[#e8f7eb]" : message.fromTeam ? "border border-[#c9d8ff] bg-[#eef3ff]" : "bg-[#f3f6fb]"} text-[#1C1D52]`}
                    >
                      {message.content}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 border-t border-slate-200 p-4 sm:px-5"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a message..."
              aria-label="Type a message"
              className="min-w-0 flex-1 rounded-full bg-[#f3f6fb] px-4 py-3 text-xs text-[#1C1D52] outline-none focus:ring-2 focus:ring-[#5FBB46]/25"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5FBB46] text-white transition hover:bg-[#4aaa3e] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1D52]/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1D52]">
                {selectedMember.name}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            {loadingProfile ? (
              <p className="mt-4 text-xs text-slate-400">Loading profile...</p>
            ) : memberProfile?.visible === false ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500">
                  This member has kept their profile private.
                </p>
                <ContactBlock contact={memberProfile.contact} />
              </div>
            ) : memberProfile ? (
              <div className="mt-4 space-y-3 text-xs text-slate-600">
                {memberProfile.isLeader && (
                  <span className="inline-block rounded-full bg-[#eaf1ff] px-2 py-1 text-[10px] font-semibold text-[#1C1D52]">
                    Group Leader
                  </span>
                )}
                {memberProfile.bio && <p>{memberProfile.bio}</p>}
                {memberProfile.skills && memberProfile.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {memberProfile.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded bg-[#f3f6fb] px-2 py-1 text-[10px] font-medium text-[#1C1D52]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <p className="font-semibold text-[#1C1D52]">
                    Progress: {memberProfile.progressPercent}%
                  </p>
                  <p className="text-slate-400">
                    {memberProfile.completedTasks} / {memberProfile.totalTasks}{" "}
                    tasks completed
                  </p>
                </div>
                <ContactBlock contact={memberProfile.contact} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-400">
                Unable to load this profile.
              </p>
            )}
          </div>
        </div>
      )}
    </InternshipShell>
  );
}

/** A teammate's phone with call and WhatsApp buttons (group leaders only). */
function ContactBlock({ contact }: { contact: Contact | null | undefined }) {
  // Undefined: you aren't the group leader, so nothing is shown.
  if (contact === undefined) return null;
  return (
    <div className="border-t border-slate-100 pt-3 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        Phone (visible to you as group leader)
      </p>
      {contact ? (
        <>
          <p className="mt-1 text-sm font-semibold text-[#1C1D52]">
            {contact.phone}
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-semibold text-white"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
            {contact.whatsapp && (
              <a
                href={`https://wa.me/${contact.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="mt-1 text-slate-500">No phone number on record.</p>
      )}
    </div>
  );
}
