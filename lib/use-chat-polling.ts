"use client";

import { useCallback, useEffect, useRef } from "react";

// Checks a chat for new messages without costing much server time (each
// check is a serverless request, and Vercel bills the CPU they use):
//
//  - every 15 seconds while messages are coming in or the user just sent one;
//  - slowing down by half again each quiet check, to once a minute;
//  - never while the tab is hidden, and straight away when it's shown again;
//  - not at all after 20 minutes with no new messages and nobody touching
//    the page (a tab left open on a screen), until they click or type.

export const CHAT_POLL_FAST_MS = 15_000;
export const CHAT_POLL_SLOW_MS = 60_000;
const IDLE_MS = 20 * 60_000;

/**
 * Calls `poll` on the schedule above. `poll` returns true when it found
 * something new. Returns `bump`: call it after the user sends a message, so
 * replies are checked for often again. Changing `resetKey` (e.g. opening a
 * different conversation) starts the schedule over.
 */
export function useChatPolling(
  poll: () => Promise<boolean | void>,
  {
    enabled = true,
    fastMs = CHAT_POLL_FAST_MS,
    slowMs = CHAT_POLL_SLOW_MS,
    resetKey,
  }: { enabled?: boolean; fastMs?: number; slowMs?: number; resetKey?: unknown } = {},
) {
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });
  const bumpRef = useRef(() => {});

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    let delay = fastMs;
    let lastActivity = Date.now();
    let lastPoll = Date.now();
    // Stopped because the tab is hidden or nobody's there.
    let paused = false;

    const schedule = () => {
      window.clearTimeout(timer);
      paused = false;
      timer = window.setTimeout(tick, delay);
    };
    const tick = async () => {
      if (document.hidden || Date.now() - lastActivity > IDLE_MS) {
        paused = true;
        return;
      }
      lastPoll = Date.now();
      let news = false;
      try {
        news = (await pollRef.current()) === true;
      } catch {
        // A failed check is just a quiet one.
      }
      if (news) lastActivity = Date.now();
      delay = news ? fastMs : Math.min(Math.round(delay * 1.5), slowMs);
      schedule();
    };
    const resume = () => {
      lastActivity = Date.now();
      if (!paused || document.hidden) return;
      delay = fastMs;
      if (Date.now() - lastPoll >= fastMs) void tick();
      else schedule();
    };
    const onVisibility = () => {
      if (!document.hidden) resume();
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
    schedule();
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      window.removeEventListener("focus", resume);
      bumpRef.current = () => {};
    };
  }, [enabled, fastMs, slowMs, resetKey]);

  return useCallback(() => bumpRef.current(), []);
}
