"use client";

import { Loader2, Megaphone, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminSupportMode } from "@/components/AdminShell";
import { useChatPolling } from "@/lib/use-chat-polling";

// Admin tools for talking to internship groups: read and post in one
// group's discussion, or send the same message to several groups. Members
// see admin posts as "SabiRole team" (Support Admins' as "Support
// Admin") and get a notification.

/** How members see this workspace's messages. */
function useSenderName() {
  return useAdminSupportMode() ? "Support Admin" : "SabiRole team";
}

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderName: string;
  fromTeam: boolean;
  teamRole: "ADMIN" | "SUPPORT_ADMIN" | null;
};

const MAX_LENGTH = 2000;

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f1438]/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1C1D52]">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One group's discussion: read it and post as the academy team. */
export function GroupChatDialog({
  group,
  onClose,
}: {
  group: { id: string; number: number; members: Array<{ userId: string }> };
  onClose: () => void;
}) {
  const senderName = useSenderName();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latest = useRef<string | null>(null);
  const [realtimeTopic, setRealtimeTopic] = useState<string | null>(null);

  const load = useCallback(
    async (initial: boolean) => {
      const query = !initial && latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
      const response = await fetch(`/api/admin/internship/groups/${group.id}/messages${query}`, {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) {
        if (initial) setError("Unable to load this group's chat.");
        return;
      }
      const body = (await response.json()) as { messages: ChatMessage[]; realtimeTopic?: string | null };
      if (initial) setRealtimeTopic(body.realtimeTopic ?? null);
      if (body.messages.length) latest.current = body.messages[body.messages.length - 1].createdAt;
      setMessages((current) => {
        if (initial || !current) return body.messages;
        const known = new Set(current.map((m) => m.id));
        const fresh = body.messages.filter((m) => !known.has(m.id));
        return fresh.length ? [...current, ...fresh] : current;
      });
      // Tells the polling whether anything new came in.
      return !initial && body.messages.length > 0;
    },
    [group.id],
  );

  useEffect(() => {
    const first = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(first);
  }, [load]);
  // New messages: live, or often while the group is talking and rarely
  // when it's quiet (see useChatPolling).
  const bumpPolling = useChatPolling(() => load(false), { resetKey: group.id, topic: realtimeTopic });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    setSending(true);
    setError(null);
    const response = await fetch(`/api/admin/internship/groups/${group.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSending(false);
    if (!response?.ok) {
      setError(body?.error ?? "Unable to send.");
      return;
    }
    setDraft("");
    await load(false);
    bumpPolling();
  }

  return (
    <Sheet
      title={`Group ${group.number} discussion`}
      subtitle={`${group.members.length} member${group.members.length === 1 ? "" : "s"} · your messages appear as “${senderName}” and members are notified`}
      onClose={onClose}
    >
      <div ref={listRef} className="min-h-[240px] flex-1 space-y-3 overflow-y-auto bg-[#fbfdff] px-5 py-4">
        {!messages ? (
          <p className="text-xs text-slate-500">{error ?? "Loading…"}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400">No messages in this group yet.</p>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={message.fromTeam ? "ml-auto max-w-[85%] text-right" : "max-w-[85%]"}>
              <p className="text-[11px] font-bold text-[#1C1D52]">
                {message.fromTeam
                  ? `${message.teamRole === "SUPPORT_ADMIN" ? "Support Admin" : "SabiRole team"} (${message.senderName})`
                  : message.senderName}
                <span className="ml-2 font-normal text-slate-400">
                  {new Date(message.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
              <p className={`mt-1 whitespace-pre-line rounded-xl px-3 py-2 text-left text-xs leading-5 text-[#1C1D52] ${message.fromTeam ? "bg-[#e8f0ff]" : "bg-[#f3f6fb]"}`}>
                {message.content}
              </p>
            </article>
          ))
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) void send();
        }}
        className="space-y-2 border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
      >
        {error && messages && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            maxLength={MAX_LENGTH}
            placeholder={`Message Group ${group.number}…`}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46]"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#1C1D52] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/** The same message to several groups at once. */
export function BroadcastDialog({
  groups,
  cohortName,
  onClose,
  onSent,
}: {
  groups: Array<{ id: string; number: number; members: Array<{ userId: string }> }>;
  cohortName: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const senderName = useSenderName();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(groups.map((g) => g.id)));
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = groups.filter((g) => chosen.has(g.id)).reduce((t, g) => t + g.members.length, 0);
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    setSending(true);
    setError(null);
    const response = await fetch("/api/admin/internship/groups/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds: [...chosen], content: draft }),
    }).catch(() => null);
    const body = await response?.json().catch(() => ({}));
    setSending(false);
    if (!response?.ok) {
      setError(body?.error ?? "Unable to send.");
      return;
    }
    onSent(`Message sent to ${body.groups} group${body.groups === 1 ? "" : "s"} (${body.people} intern${body.people === 1 ? "" : "s"} notified).`);
  }

  return (
    <Sheet title="Message groups" subtitle={`${cohortName} · posts into each group's discussion as “${senderName}”`} onClose={onClose}>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Send to</p>
            <button
              type="button"
              onClick={() => setChosen(chosen.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)))}
              className="text-[11px] font-semibold text-[#1C1D52]"
            >
              {chosen.size === groups.length ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groups.map((group) => (
              <label key={group.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${chosen.has(group.id) ? "border-[#5FBB46] bg-[#f4faf2]" : "border-slate-200"}`}>
                <input type="checkbox" className="accent-[#5FBB46]" checked={chosen.has(group.id)} onChange={() => toggle(group.id)} />
                <span className="text-[#1C1D52]">
                  Group {group.number}
                  <span className="block text-[10px] text-slate-400">{group.members.length} members</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Message</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            maxLength={MAX_LENGTH}
            placeholder="e.g. Reminder: submit your group task before Friday 11:59 PM."
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46]"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
      </div>
      <div className="border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim() || !chosen.size}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
          Send to {chosen.size} group{chosen.size === 1 ? "" : "s"} ({people} intern{people === 1 ? "" : "s"})
        </button>
      </div>
    </Sheet>
  );
}

