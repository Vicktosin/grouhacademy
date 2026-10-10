"use client";

// A small in-memory cache for data every page's shell loads (the sidebar's
// profile, the header's name and unread count, access status, banners).
// Internship pages each render their own shell, so without this every
// navigation re-asked the server for all of it: several serverless calls
// per page view, each billed by Vercel.
//
// Kept in memory only: a full page reload always starts fresh. Requests
// for the same URL at the same time share one fetch. After the user
// changes something these show (their profile, avatar, notifications),
// call clearCachedJson() so the next page shows it.

import type { ShellData } from "@/app/api/internship/shell/route";

type Entry ={ at: number; value: Promise<unknown> };
const entries = new Map<string, Entry>();

// Logging out and in again doesn't reload the page, so the cache is
// emptied whenever the signed-in user changes (in this tab or another):
// the next person must never see the last one's name or photo.
let watchingAuth = false;
function watchAuth() {
  if (watchingAuth || typeof window === "undefined") return;
  watchingAuth = true;
  void import("@/lib/supabase/client")
    .then(({ createSupabaseBrowserClient }) => {
      let userId: string | null | undefined;
      createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
        const next = session?.user.id ?? null;
        if (userId !== undefined && next !== userId) clearCachedJson();
        userId = next;
      });
    })
    .catch(() => {
      // Without Supabase there's no login to change.
    });
}

// On internship pages these come from one request (/api/internship/shell)
// instead of four. Each maps the combined answer to what its own route
// returns, as far as the shell uses it; null means "ask the route itself".
const SHELL_URL = "/api/internship/shell";
const SHELL_PARTS: Record<string, (shell: ShellData) => unknown> = {
  "/api/internship/access-status": (shell) => shell.accessStatus,
  "/api/internship/profile": (shell) => shell.profile,
  "/api/student/profile": (shell) => shell.profile && { name: shell.profile.name, avatarUrl: shell.profile.avatarUrl },
  "/api/student/notifications/unread-count?workspace=internship": (shell) =>
    shell.unreadCount === null ? null : { count: shell.unreadCount },
};

/**
 * The JSON at `url`, fetched at most once per `maxAgeMs`. A failed request
 * isn't kept, and resolves to null.
 */
export function cachedJson<T>(url: string, maxAgeMs: number): Promise<T | null> {
  const part = SHELL_PARTS[url];
  if (part && typeof window !== "undefined" && window.location.pathname.startsWith("/internship")) {
    // Reused for the shortest of the parts' times, so each stays as fresh
    // as it was when it had its own request.
    return fetchJson<ShellData>(SHELL_URL, Math.min(maxAgeMs, CACHE_MS.unreadCount)).then(
      (shell) => ((shell && part(shell)) as T | null) ?? fetchJson<T>(url, maxAgeMs),
    );
  }
  return fetchJson<T>(url, maxAgeMs);
}

function fetchJson<T>(url: string, maxAgeMs: number): Promise<T | null> {
  watchAuth();
  const now = Date.now();
  const entry = entries.get(url);
  if (entry && now - entry.at < maxAgeMs) return entry.value as Promise<T | null>;
  const value = fetch(url, { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<T>) : Promise.reject(new Error(`HTTP ${response.status}`))))
    .catch((error: unknown) => {
      // Don't keep failures: the next caller tries again.
      if (entries.get(url)?.value === value) entries.delete(url);
      console.error(`Failed to load ${url}:`, error);
      return null;
    });
  entries.set(url, { at: now, value });
  return value;
}

/** Forget cached data (all of it, or the URLs starting with `prefix`). */
export function clearCachedJson(prefix?: string) {
  for (const url of [...entries.keys()]) if (!prefix || url.startsWith(prefix)) entries.delete(url);
}

/** How long each kind of shell data is reused. */
export const CACHE_MS = {
  profile: 5 * 60_000,
  accessStatus: 2 * 60_000,
  banners: 10 * 60_000,
  unreadCount: 60_000,
};
