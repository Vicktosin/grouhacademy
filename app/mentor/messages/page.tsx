"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Search, Send } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { MentorPage } from "@/components/MentorPage";
import { bringIntoView } from "@/lib/bring-into-view";
import { useChatPolling } from "@/lib/use-chat-polling";

type ConversationSummary = {
  internId: string;
  programId: string;
  name: string;
  avatarUrl: string | null;
  subtitle: string;
  unread: number;
  lastMessage: { content: string; createdAt: string; isMine: boolean } | null;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
};

// The open thread is checked like other chats (see useChatPolling); the
// list of conversations less often.
const LIST_POLL_FAST_MS = 30_000;
const LIST_POLL_SLOW_MS = 120_000;

function formatTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MentorMessages() {
  const requestedIntern = useSearchParams().get("intern");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef<string | null>(null);
  // What the list looked like last time, to tell when something changed.
  const listSignature = useRef("");
  // Realtime channels (see lib/realtime): all this mentor's chats, and the open one.
  const [inboxTopic, setInboxTopic] = useState<string | null>(null);
  const [threadTopic, setThreadTopic] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // On phones the chat sits below the conversation list.
  const chatRef = useRef<HTMLDivElement>(null);

  const active =
    conversations.find((conversation) => conversation.internId === activeId) ??
    null;

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/mentor/conversations", {
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to load conversations.");
      const rows = body.conversations as ConversationSummary[];
      setConversations(rows);
      setInboxTopic(body.realtimeTopic ?? null);
      const signature = rows.map((row) => `${row.internId}:${row.unread}:${row.lastMessage?.createdAt ?? ""}`).join("|");
      const changed = Boolean(listSignature.current) && signature !== listSignature.current;
      listSignature.current = signature;
      setActiveId(
        (current) =>
          current ??
          (rows.some((row) => row.internId === requestedIntern)
            ? requestedIntern
            : (rows[0]?.internId ?? null)),
      );
      return changed;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load conversations.",
      );
    } finally {
      setLoadingList(false);
    }
  }, [requestedIntern]);

  const loadThread = useCallback(
    async (internId: string, programId: string, initial: boolean) => {
      const url = new URL(
        `/api/mentor/conversations/${internId}`,
        window.location.origin,
      );
      url.searchParams.set("programId", programId);
      if (!initial && lastFetchedAt.current)
        url.searchParams.set("after", lastFetchedAt.current);
      try {
        const response = await fetch(url.toString(), { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          if (initial)
            setError(body?.error ?? "Unable to load this conversation.");
          return;
        }
        const incoming = body.messages as Message[];
        if (initial) setThreadTopic(body.realtimeTopic ?? null);
        if (incoming.length > 0)
          lastFetchedAt.current = incoming[incoming.length - 1].createdAt;
        setMessages((current) => {
          if (initial) return incoming;
          const known = new Set(current.map((message) => message.id));
          return [...current, ...incoming.filter((m) => !known.has(m.id))];
        });
        // Opening the thread marks its messages read.
        setConversations((current) =>
          current.map((c) => (c.internId === internId ? { ...c, unread: 0 } : c)),
        );
        return !initial && incoming.length > 0;
      } finally {
        if (initial) setLoadingThread(false);
      }
    },
    [],
  );

  useEffect(() => {
    const first = window.setTimeout(() => void loadConversations(), 0);
    return () => window.clearTimeout(first);
  }, [loadConversations]);
  useChatPolling(loadConversations, { fastMs: LIST_POLL_FAST_MS, slowMs: LIST_POLL_SLOW_MS, topic: inboxTopic });

  const activeProgramId = active?.programId ?? null;
  useEffect(() => {
    if (!activeId || !activeProgramId) return;
    const first = window.setTimeout(() => {
      lastFetchedAt.current = null;
      setMessages([]);
      setThreadTopic(null);
      setLoadingThread(true);
      setError(null);
      void loadThread(activeId, activeProgramId, true);
    }, 0);
    return () => window.clearTimeout(first);
  }, [activeId, activeProgramId, loadThread]);
  // The open conversation: often while you're chatting, rarely when quiet.
  const bumpThreadPolling = useChatPolling(
    async () => (activeId && activeProgramId ? loadThread(activeId, activeProgramId, false) : false),
    { enabled: Boolean(activeId && activeProgramId), resetKey: activeId, topic: threadTopic },
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !active || sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/mentor/conversations/${active.internId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, programId: active.programId }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Unable to send message.");
      setMessages((current) => [...current, body as Message]);
      lastFetchedAt.current = body.createdAt;
      // The intern may reply soon: check often again.
      bumpThreadPolling();
      setConversations((current) =>
        current.map((c) =>
          c.internId === active.internId
            ? {
                ...c,
                lastMessage: {
                  content: body.content,
                  createdAt: body.createdAt,
                  isMine: true,
                },
              }
            : c,
        ),
      );
      setDraft("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to send message.",
      );
    } finally {
      setSending(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? conversations.filter((c) =>
        `${c.name} ${c.subtitle}`.toLowerCase().includes(needle),
      )
    : conversations;

  return (
    <MentorPage
      title="Messages"
      description="Chat directly with your interns, answer questions, and keep mentorship conversations connected to their internship work."
    >
      <section className="grid min-h-[620px] overflow-hidden rounded-2xl bg-white shadow-sm md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 md:border-b-0 md:border-r">
          <div className="border-b border-slate-200 p-4">
            <label className="flex items-center gap-2 rounded-lg bg-[#f3f6fb] px-3 py-2 text-xs text-slate-400">
              <Search className="h-3.5 w-3.5" />
              <span className="sr-only">Search conversations</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search interns"
                className="w-full bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="divide-y divide-slate-100">
            {loadingList && (
              <p className="p-4 text-xs text-slate-500">Loading conversations…</p>
            )}
            {!loadingList && conversations.length === 0 && (
              <p className="p-4 text-xs text-slate-500">
                No interns are assigned to you yet.
              </p>
            )}
            {visible.map((conversation) => (
              <button
                key={`${conversation.internId}-${conversation.programId}`}
                type="button"
                onClick={() => {
                  setActiveId(conversation.internId);
                  bringIntoView(chatRef.current);
                }}
                className={`flex w-full items-center gap-3 p-4 text-left ${conversation.internId === activeId ? "bg-[#eef7f0]" : "hover:bg-slate-50"}`}
              >
                <Image
                  src={conversation.avatarUrl || "/avatar-placeholder.png"}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized={Boolean(conversation.avatarUrl)}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs text-[#1C1D52]">
                    {conversation.name}
                  </strong>
                  <span className="mt-1 block truncate text-[10px] text-slate-500">
                    {conversation.lastMessage
                      ? `${conversation.lastMessage.isMine ? "You: " : ""}${conversation.lastMessage.content}`
                      : conversation.subtitle}
                  </span>
                </span>
                {conversation.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#5FBB46] px-1 text-[9px] font-bold text-white">
                    {conversation.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>
        <div ref={chatRef} className="flex min-h-[560px] scroll-mt-4 flex-col">
          {active ? (
            <>
              <header className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-bold text-[#1C1D52]">
                  {active.name}
                </h2>
                <p className="mt-1 text-[10px] text-slate-500">
                  {active.subtitle}
                </p>
              </header>
              <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto bg-[#fbfdff] p-4 sm:p-6"
              >
                {loadingThread && (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                )}
                {!loadingThread && messages.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No messages yet. Say hello to {active.name}.
                  </p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.isMine ? "rounded-br-sm bg-[#1C1D52] text-white" : "rounded-bl-sm bg-white text-slate-600 shadow-sm"}`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <span
                        className={`mt-2 block text-[9px] ${message.isMine ? "text-white/60" : "text-slate-400"}`}
                      >
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {error && (
                <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <form
                onSubmit={sendMessage}
                className="flex gap-2 border-t border-slate-200 p-4"
              >
                <label className="sr-only" htmlFor="mentor-message">
                  Message {active.name}
                </label>
                <input
                  id="mentor-message"
                  value={draft}
                  maxLength={2000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${active.name}...`}
                  className="min-w-0 flex-1 rounded-lg bg-[#f3f6fb] px-3 py-2.5 text-xs text-[#1C1D52] outline-none focus:ring-2 focus:ring-[#5FBB46]/25"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-xs text-slate-500">
              {error ??
                (loadingList
                  ? "Loading…"
                  : "Select an intern to start a conversation.")}
            </div>
          )}
        </div>
      </section>
    </MentorPage>
  );
}

export default function MentorMessagesPage() {
  return (
    <Suspense fallback={null}>
      <MentorMessages />
    </Suspense>
  );
}
