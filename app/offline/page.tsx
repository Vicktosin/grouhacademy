"use client";

import { useEffect } from "react";
import { isSafeInternalPath } from "@/lib/safe-redirect";

// The service worker sends failed navigations here as /offline?from=<page>.
// Read it at click time rather than render time: this page is cached once and
// served for every failed navigation, so it cannot be rendered per request.
function pageToRetry() {
  const from = new URLSearchParams(window.location.search).get("from");
  return isSafeInternalPath(from) && !from.startsWith("/offline") ? from : "/";
}

function retry() {
  window.location.assign(pageToRetry());
}

export default function OfflinePage() {
  useEffect(() => {
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fbff] px-6">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_16px_45px_rgba(28,29,82,0.12)]">
        {/* A plain <img> so the icon loads from the service worker cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="Grouh Academy"
          className="mx-auto h-20 w-20 rounded-2xl"
        />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#5FBB46]">
          You&apos;re offline
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[#1C1D52]">
          Check your connection
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Grouh Academy needs an internet connection to load the latest learning
          content and account information.
        </p>
        <p
          role="status"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#5FBB46]" />
          Waiting for connection. We&apos;ll take you back automatically.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {/* Plain anchors: client-side navigation needs the network. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              retry();
            }}
            className="inline-flex justify-center rounded-lg bg-[#5FBB46] px-5 py-3 text-sm font-bold text-[#14204f]"
          >
            Try again
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-[#1C1D52] hover:bg-slate-50"
          >
            Go to home page
          </a>
        </div>
      </section>
    </main>
  );
}
