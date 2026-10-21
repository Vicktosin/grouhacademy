"use client";

import { LayoutDashboard, LogOut, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// The Affiliate Program's own app frame: not the website's header and
// footer, and not the internship workspace's sidebar.

const nav = [
  { label: "Dashboard", href: "/affiliate", icon: LayoutDashboard },
  { label: "Settings", href: "/affiliate/settings", icon: Settings },
];

export default function AffiliateShell({
  children,
  showNav = true,
}: {
  children: React.ReactNode;
  /** Off before the intern has joined (nothing to set up yet). */
  showNav?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut({ scope: "local" }).catch(() => undefined);
    router.replace("/affiliate/login");
  }

  return (
    <div className="min-h-screen bg-[#edf3ff] text-[#1C1D52]">
      <header className="border-b border-[#dfe7f5] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/affiliate" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Grouh Academy" width={90} height={54} className="h-9 w-auto object-contain" />
            <span className="hidden rounded-full bg-[#e8f7eb] px-3 py-1 text-[11px] font-bold text-[#397d3a] sm:inline">
              Affiliate Program
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            {showNav &&
              nav.map(({ label, href, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${active ? "bg-[#1C1D52] text-white" : "text-[#1C1D52] hover:bg-slate-100"}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </Link>
                );
              })}
            <Link
              href="/internship/dashboard"
              className="hidden rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100 md:inline"
            >
              Internship
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
