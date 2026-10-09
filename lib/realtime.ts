import { createHmac } from "node:crypto";
import { after } from "next/server";

// Live chat updates with Supabase Realtime (Broadcast), without putting
// any message on it: when a message is saved, the server sends a "ping"
// (no content) on that chat's channel. Open chat pages listening on the
// channel then fetch the new messages through the normal, logged-in API.
// So Realtime needs no database access rules, and a page that can't
// connect simply keeps checking on a timer (lib/use-chat-polling).
//
// Channels are public (Realtime's default), so their names are kept
// unguessable: an HMAC of the chat's id with a server secret. Only people
// allowed in a chat are given its channel name, by the API that loads it.
// Without a secret, there are no channels and pages poll as before.

const secret = () => process.env.REALTIME_TOPIC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type Chat =
  | { kind: "group"; groupId: string }
  /** An intern's conversation with their mentor on a track. */
  | { kind: "mentor-chat"; internId: string; programId: string | null }
  /** Everything for one mentor (their conversations list). */
  | { kind: "mentor-inbox"; mentorId: string };

function key(chat: Chat) {
  switch (chat.kind) {
    case "group":
      return `group:${chat.groupId}`;
    case "mentor-chat":
      return `mentor-chat:${chat.internId}:${chat.programId ?? ""}`;
    case "mentor-inbox":
      return `mentor-inbox:${chat.mentorId}`;
  }
}

/** The channel to listen on for a chat, or null when live updates are off. */
export function chatTopic(chat: Chat): string | null {
  const value = secret();
  if (!value) return null;
  return `chat-${createHmac("sha256", value).update(key(chat)).digest("base64url").slice(0, 32)}`;
}

const TIMEOUT_MS = 5000;

/**
 * Tells everyone listening on these chats that something new is there.
 * Sent after the response, so it never slows the request down; a failure
 * only means pages pick the message up on their next timed check.
 */
export function notifyChats(chats: Chat[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const topics = [...new Set(chats.map(chatTopic).filter((topic): topic is string => Boolean(topic)))];
  if (!url || !apiKey || !topics.length) return;
  after(async () => {
    try {
      const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: topics.map((topic) => ({ topic, event: "new", payload: {}, private: false })),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) console.warn(`[realtime] Broadcast failed: HTTP ${response.status}`);
    } catch (error) {
      console.warn("[realtime] Broadcast failed:", error instanceof Error ? error.message : error);
    }
  });
}
