"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MFA_CHALLENGE_PATH } from "@/lib/supabase/mfa";

// Sign-in for the Affiliate Program: the same email and password as the
// internship. Anyone can sign in; the app itself checks they're an intern.

export default function AffiliateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: straight to the program.
  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace("/affiliate");
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setBusy(false);
      setError("That email and password don't match. Use your internship sign-in details.");
      return;
    }
    // Accounts with two-step sign-in finish it first, then come back here.
    const response = await fetch("/api/auth/redirect", { cache: "no-store" }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { redirectTo?: string };
    router.replace(
      data?.redirectTo === MFA_CHALLENGE_PATH
        ? `${MFA_CHALLENGE_PATH}?next=${encodeURIComponent("/affiliate")}`
        : "/affiliate",
    );
  }

  const input =
    "mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#edf3ff] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/logo.png" alt="SabiRole" width={120} height={72} className="h-12 w-auto object-contain" />
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-3xl bg-white p-7 shadow-[0_15px_40px_rgba(28,29,82,0.1)] sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Affiliate Program</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52]">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">
              Use the email and password you use for your internship.
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Email address
            <input required type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            <span className="flex items-center justify-between">
              Password
              <Link href="/forgot-password" className="text-xs font-semibold text-[#397d3a] hover:underline">
                Forgot password?
              </Link>
            </span>
            <span className="relative block">
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button disabled={busy} className="w-full rounded-xl bg-[#5FBB46] px-4 py-3.5 text-sm font-bold text-[#14204f] disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-xs text-slate-500">
            Not an intern yet?{" "}
            <Link href="/register" className="font-semibold text-[#397d3a] hover:underline">
              Apply for an internship
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
