"use client";

import { LogIn, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AdminContext } from "@/lib/admin-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

/**
 * Whether this page is open in the Support Admin workspace (/support). The
 * internship pages Support Admins share with admins use it to hide what only
 * admins may do; the APIs refuse those actions either way.
 */
export function useAdminSupportMode() {
  const pathname = usePathname() ?? "";
  return pathname === "/support" || pathname.startsWith("/support/");
}

/** Where the shared internship pages live for this workspace. */
export function useAdminBasePath() {
  return useAdminSupportMode() ? "/support" : "/admin/internship";
}

export default function AdminShell({
  workspace,
  children,
}: {
  workspace: "student" | "internship";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supportAdmin = useAdminSupportMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminContext | null>(null);
  // The sign-in was ended elsewhere (e.g. logged out on another device):
  // pages here don't re-check it, so every request would just be refused.
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAdminContext() {
      try {
        const response = await fetch("/api/admin/context", {
          cache: "no-store",
        });
        if (response.status === 403) {
          if (!cancelled) setSignedOut(true);
          return;
        }
        if (!response.ok) return;

        const context = (await response.json()) as AdminContext;
        if (!cancelled) setAdmin(context);
      } catch {
        // The shell stays usable with neutral labels if context is temporarily unavailable.
      }
    }

    loadAdminContext();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signInAgain() {
    // Clears the ended session from this browser, then back here after signing in.
    await createSupabaseBrowserClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-[#edf3ff] text-[#1C1D52]">
      <div className="relative z-30 shrink-0">
        <AdminHeader workspace={workspace} admin={admin} supportAdmin={supportAdmin} />
        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label="Toggle admin navigation"
          className="absolute left-3 top-3 z-40 rounded-lg bg-[#1C1D52] p-2 text-white md:hidden"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-5 overflow-hidden px-3 pb-3 sm:px-5 lg:gap-6 lg:px-6">
        <AdminSidebar workspace={workspace} admin={admin} supportAdmin={supportAdmin} />
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-[#1C1D52]/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <AdminSidebar workspace={workspace} admin={admin} mobile supportAdmin={supportAdmin} />
          </>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-2">
          {signedOut && (
            <div role="alert" className="mx-auto mb-4 flex max-w-3xl flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong>Your sign-in has ended</strong> (this account may have logged out on another device or tab). Sign in again to keep working.
              </p>
              <button
                type="button"
                onClick={() => void signInAgain()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-2.5 text-sm font-semibold text-white"
              >
                <LogIn className="h-4 w-4" /> Sign in again
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
