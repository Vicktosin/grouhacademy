"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import GoogleIcon from "@/components/GoogleIcon";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message || "Unable to sign in. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === "aal1" && assurance.nextLevel === "aal2") {
      router.replace("/auth/mfa");
      return;
    }

    try {
      const response = await fetch("/api/auth/redirect", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Unable to determine your workspace.");
      }

      const data = (await response.json()) as { redirectTo?: string };
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const redirectTo = requestedNext?.startsWith("/internship/")
        ? "/internship/onboarding"
        : requestedNext?.startsWith("/")
          ? requestedNext
          : data.redirectTo || "/student";

      router.replace(redirectTo);
      router.refresh();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuth = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${getSiteUrl()}/auth/callback?next=/internship/onboarding` },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-[#17251c]">
      <section className="relative isolate flex min-h-screen items-center overflow-hidden py-10 sm:py-16">
        <div className="absolute inset-0 -z-10 " />

        <Container className="relative z-10 w-full py-0">
          <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgba(28,29,82,0.16)] md:min-h-[620px] md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
              <div className="mx-auto w-full max-w-md">
                <div className="mb-10">
                  <Link href="/" className="inline-flex"><Image src="/logo.png" alt="Grouh Academy logo" width={160} height={64} className="mb-3 h-10 w-auto" /></Link>
                  <h1 className="text-3xl font-bold tracking-tight text-[#1c1d52] sm:text-4xl">Welcome back</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-500">Sign in to continue building the skills that move you forward.</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15"
                      required
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
                      <Link href="/forgot-password" className="text-xs font-semibold text-[#4d9d39] hover:underline">Forgot password?</Link>
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-[#1c1d52] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#1c1d52]/20 transition hover:bg-[#292a68] focus:outline-none focus:ring-4 focus:ring-[#1c1d52]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Logging in..." : "Log in"}
                  </button>
                </form>

                <div className="my-8 flex items-center gap-4 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>or continue with</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div>
                  <button type="button" onClick={handleOAuth} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" aria-label="Continue with Google">
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </div>

                <p className="mt-8 text-center text-sm text-slate-500">Don&apos;t have an account? <Link href="/register" className="font-semibold text-[#4d9d39] hover:underline">Register now</Link></p>
              </div>
            </div>

        <div className="hidden md:block relative bg-cover bg-center" style={{ backgroundImage: "url('/right-bg.png')" }}>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-black/10 to-black/20"></div>

          {/* Glassmorphism Card */}
          <div className="absolute left-16 top-16 w-[420px] h-[420px] rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 p-8 flex items-start">
            <div className="max-w-sm">
                <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#f0be43]">Learn with purpose</p>
                <h2 className="text-4xl font-bold leading-tight lg:text-5xl text-white">Your next chapter starts here.</h2>
                <p className="mt-5 max-w-xs text-sm leading-6 text-white/75">Access practical courses, supportive mentors, and a community that keeps you moving.</p>
            </div>
          </div>

          {/* Woman Image */}
          <div className="absolute right-8 bottom-0 w-80">
            <Image src="/woman-with-tab.png" alt="Woman with tablet" width={640} height={760} className="h-auto w-full" />
          </div>

          {/* Thunderbolt Badge */}
          <div className="absolute left-8 top-72 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md">
            <Image src="/thunderbolt.png" alt="Thunderbolt icon" width={32} height={32} className="h-8 w-8" />
          </div>
        </div>

    
          </div>
        </Container>
      </section>
    </main>
  );
}
