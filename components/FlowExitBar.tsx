"use client";

import { clearCachedJson } from "@/lib/client-cache";

import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type FlowExitBarProps = {
  backHref: string;
  backLabel?: string;
  showSignOut?: boolean;
};

/**
 * Top bar for standalone steps (onboarding, results, account security) that
 * have no workspace sidebar, so users always have a way to leave the flow.
 */
export default function FlowExitBar({
  backHref,
  backLabel = "Back",
  showSignOut = true,
}: FlowExitBarProps) {
  const router = useRouter();

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
    clearCachedJson();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#1C1D52] transition hover:bg-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      {showSignOut && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-[#1C1D52]"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      )}
    </header>
  );
}
