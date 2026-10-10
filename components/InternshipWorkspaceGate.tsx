"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadShell, peekShell } from "@/lib/client-cache";

// Who may use the internship dashboard. Its pages are static files (no
// server work on each view, which Vercel bills), so the decision the server
// used to make on every page is made here, from the shell request: anyone
// without workspace access (removed, unpaid, still applying) is sent where
// they belong, exactly as before.
//
// Until it knows, the page is rendered but hidden: its data loads at the
// same time, and nothing flashes for someone being sent away. Once this tab
// knows, pages show straight away and it re-checks in the background.
// The data itself is protected by the APIs (requireInternshipWorkspace),
// never by this.

type State = "checking" | "allowed" | "leaving" | "failed";

export default function InternshipWorkspaceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>(() => (peekShell()?.workspace?.redirect === null ? "allowed" : "checking"));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Cached for a minute, so moving between pages rarely makes a request.
    void loadShell().then((shell) => {
      if (cancelled) return;
      const workspace = shell?.workspace;
      if (!workspace) {
        // Couldn't tell (network or server trouble, or signed out): someone
        // already let in keeps working; otherwise offer to try again.
        setState((current) => (current === "allowed" ? current : "failed"));
      } else if (workspace.redirect) {
        setState("leaving");
        router.replace(workspace.redirect);
      } else {
        setState("allowed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router, pathname, attempt]);

  const hidden = state !== "allowed";
  return (
    <>
      {hidden && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F0F7FF] px-6">
          {state === "failed" ? (
            <div className="max-w-sm text-center text-sm text-[#1C1D52]">
              <p className="font-semibold">We couldn&apos;t open your workspace.</p>
              <p className="mt-1 text-slate-500">Check your connection and try again.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setState("checking");
                    setAttempt((value) => value + 1);
                  }}
                  className="rounded-lg bg-[#1C1D52] px-4 py-2 text-sm font-semibold text-white"
                >
                  Try again
                </button>
                <Link href="/login" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#1C1D52] shadow-sm">
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-[#1C1D52]" aria-label="Loading" />
          )}
        </div>
      )}
      <div className={hidden ? "invisible" : "contents"} aria-hidden={hidden || undefined} inert={hidden}>
        {children}
      </div>
    </>
  );
}
