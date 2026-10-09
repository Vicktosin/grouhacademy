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

type Entry = { at: number; value: Promise<unknown> };
const entries = new Map<string, Entry>();

/**
 * The JSON at `url`, fetched at most once per `maxAgeMs`. A failed request
 * isn't kept, and resolves to null.
 */
export function cachedJson<T>(url: string, maxAgeMs: number): Promise<T | null> {
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
