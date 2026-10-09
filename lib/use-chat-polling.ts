"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Keeps a chat up to date without costing much server time (each check is
// a serverless request, and Vercel bills the CPU they use).
//
// Live: given the chat's Realtime channel (see lib/realtime), the page
// fetches new messages the moment the server pings it, and only checks on
// a timer every few minutes as a safety net.
//
// Otherwise (no channel, or it can't connect), it checks on a timer:
//  - every 15 seconds while messages are coming in or the user just sent one;
//  - slowing down by half again each quiet check, to once a minute.
//
// Either way: never while the tab is hidden (catching up as soon as it's
// shown), and not at all after 20 minutes with no new messages and nobody
// touching the page, until they click or type. The live connection is
// dropped while the tab is hidden or idle, so open-but-unused tabs don't
// hold one of the project's Realtime connections.

export const CHAT_POLL_FAST_MS = 15_000;
export const CHAT_POLL_SLOW_MS = 60_000;
/** While live, a timed check this often in case a ping was missed. */
const LIVE_SAFETY_MS = 5 * 60_000;
const IDLE_MS = 20 * 60_000;
/** Hidden this long: drop the live connection. */
const HIDDEN_DISCONNECT_MS = 60_000;
/** Pings close together (several messages at once) make one fetch. */
const PING_DEBOUNCE_MS = 300;

let browserClient: SupabaseClient | null = null;
function realtimeClient() {
  try {
    browserClient ??= createSupabaseBrowserClient();
    return browserClient;
  } catch {
    return null;
  }
}

/**
 * Calls `poll` on the schedule above. `poll` returns true when it found
 * something new. `topic` is the chat's Realtime channel (null: timer only).
 * Returns `bump`: call it after the user sends a message, so replies are
 * checked for often again. Changing `resetKey` (e.g. opening a different
 * conversation) starts over.
 */
export function useChatPolling(
  poll: () => Promise<boolean | void>,
  {
    enabled = true,
    fastMs = CHAT_POLL_FAST_MS,
    slowMs = CHAT_POLL_SLOW_MS,
    resetKey,
    topic,
  }: { enabled?: boolean; fastMs?: number; slowMs?: number; resetKey?: unknown; topic?: string | null } = {},
) {
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });
  const bumpRef = useRef(() => {});

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let pingTimer: number | undefined;
    let hiddenTimer: number | undefined;
    let delay = fastMs;
    let lastActivity = Date.now();
    let lastPoll = Date.now();
    // Stopped because the tab is hidden or nobody's there.
    let paused = false;
    // A ping came while paused: fetch as soon as we're back.
    let missed = false;
    let polling = false;
    // Asked to check while a check was running: check again after it.
    let again = false;
    let channel: RealtimeChannel | null = null;
    let live = false;
    let closed = false;

    const schedule = () => {
      window.clearTimeout(timer);
      paused = false;
      timer = window.setTimeout(tick, live ? LIVE_SAFETY_MS : delay);
    };
    const tick = async () => {
      if (closed) return;
      if (document.hidden || Date.now() - lastActivity > IDLE_MS) {
        paused = true;
        window.clearTimeout(timer);
        if (Date.now() - lastActivity > IDLE_MS) disconnect();
        return;
      }
      if (polling) {
        again = true;
        return;
      }
      polling = true;
      again = false;
      lastPoll = Date.now();
      missed = false;
      let news = false;
      try {
        news = (await pollRef.current()) === true;
      } catch {
        // A failed check is just a quiet one.
      }
      polling = false;
      if (closed) return;
      if (news) lastActivity = Date.now();
      delay = news ? fastMs : Math.min(Math.round(delay * 1.5), slowMs);
      if (again) void tick();
      else schedule();
    };

    const connect = () => {
      if (!topic || channel || closed) return;
      const client = realtimeClient();
      if (!client) return;
      channel = client
        .channel(topic)
        .on("broadcast", { event: "new" }, () => {
          if (document.hidden || paused) {
            missed = true;
            return;
          }
          window.clearTimeout(pingTimer);
          pingTimer = window.setTimeout(() => {
            lastActivity = Date.now();
            delay = fastMs;
            void tick();
          }, PING_DEBOUNCE_MS);
        })
        .subscribe((status) => {
          const nowLive = status === "SUBSCRIBED";
          if (nowLive === live) return;
          live = nowLive;
          // Connected: anything sent while connecting is fetched now.
          // Lost: back to checking on the timer, starting soon.
          if (live) void tick();
          else if (!paused) {
            delay = fastMs;
            schedule();
          }
        });
    };
    const disconnect = () => {
      if (!channel) return;
      const client = realtimeClient();
      const old = channel;
      channel = null;
      live = false;
      void client?.removeChannel(old);
    };

    const resume = () => {
      lastActivity = Date.now();
      if (document.hidden) return;
      // Reconnects if the connection was dropped (then catches up once live).
      connect();
      if (missed) {
        delay = fastMs;
        void tick();
        return;
      }
      if (!paused) return;
      delay = fastMs;
      if (Date.now() - lastPoll >= fastMs) void tick();
      else schedule();
    };
    const onVisibility = () => {
      window.clearTimeout(hiddenTimer);
      if (document.hidden) hiddenTimer = window.setTimeout(disconnect, HIDDEN_DISCONNECT_MS);
      else resume();
    };

    bumpRef.current = () => {
      lastActivity = Date.now();
      delay = fastMs;
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
    window.addEventListener("focus", resume);
    connect();
    schedule();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.clearTimeout(pingTimer);
      window.clearTimeout(hiddenTimer);
      disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      window.removeEventListener("focus", resume);
      bumpRef.current = () => {};
    };
  }, [enabled, fastMs, slowMs, resetKey, topic]);

  return useCallback(() => bumpRef.current(), []);
}
