"use client";

import { clearCachedJson } from "@/lib/client-cache";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isStaffWorkspace,
  LEARNER_TRACKS,
  requestedPathForTrack,
  type LearnerTrack,
} from "@/lib/learner-tracks";
import { MFA_CHALLENGE_PATH } from "@/lib/supabase/mfa";
import { getSiteUrl } from "@/lib/site-url";
import GoogleIcon from "@/components/GoogleIcon";
import { Eye, EyeOff } from "lucide-react";

/**
 * The login page for one learner side. The same email and password work on
 * both sides; signing in here adds the account to this side and enters it.
 */
export default function LoginView({ track }: { track: LearnerTrack }) {
  const config = LEARNER_TRACKS[track];
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  // Back from a Support Admin invitation link (app/auth/support-invite).
  const [invite, setInvite] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the browser-only URL once
    setInvite(new URLSearchParams(window.location.search).get("invite"));
  }, []);

  // Someone already signed in (e.g. an intern opening the courses login)
  // can continue into this side without typing their password again.
  useEffect(() => {
    createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setSignedInEmail(data.user?.email ?? null))
      .catch(() => setSignedInEmail(null));
  }, []);

  function requestedPath() {
    return requestedPathForTrack(
      track,
      new URLSearchParams(window.location.search).get("next"),
    );
  }

  /** Adds the signed-in account to this side and goes there. */
  async function enterTrack() {
    const requested = requestedPath();
    const referralClick = requested
      ? new URL(requested, window.location.origin).searchParams.get("referralClick")
      : null;
    const query = new URLSearchParams({ track });
    if (referralClick) query.set("referralClick", referralClick);
    const response = await fetch(`/api/auth/redirect?${query}`, {
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      redirectTo?: string;
    };
    if (!response.ok) throw new Error("Unable to determine your workspace.");

    if (data.redirectTo === MFA_CHALLENGE_PATH) {
      // After the second factor, continue to this side.
      const next = requested ?? (track === "courses" ? config.home : null);
      router.replace(
        next
          ? `${MFA_CHALLENGE_PATH}?next=${encodeURIComponent(next)}`
          : MFA_CHALLENGE_PATH,
      );
      return;
    }
    // Staff go to their workspace; a requested learner page is only for
    // learners.
    router.replace(
      (isStaffWorkspace(data.redirectTo) ? data.redirectTo : requested) ??
        data.redirectTo ??
        config.home,
    );
    router.refresh();
  }

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

    try {
      await enterTrack();
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

  const handleContinue = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await enterTrack();
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : "Unable to continue. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
    clearCachedJson();
    setSignedInEmail(null);
  };

  const handleOAuth = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    // Only pass a destination that was asked for: without one, the callback
    // works out where this account belongs (e.g. admins to the admin
    // workspace) once it knows who signed in.
    const next = requestedPath();
    const callback = new URL("/auth/callback", getSiteUrl());
    if (next) callback.searchParams.set("next", next);
    callback.searchParams.set("track", track);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
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
                  <Link href="/" className="inline-flex">
                    <Image
                      src="/logo.png"
                      alt="SabiRole logo"
                      width={160}
                      height={64}
                      className="mb-3 h-10 w-auto"
                    />
                  </Link>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4d9d39]">
                    {config.name}
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1c1d52] sm:text-4xl">
                    {config.loginTitle}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {config.loginSubtitle}
                  </p>
                </div>

                {signedInEmail && (
                  <div className="mb-8 rounded-xl border border-[#5fbb46]/30 bg-[#f0faed] p-4">
                    <p className="text-sm text-slate-600">
                      You&apos;re signed in as{" "}
                      <strong className="text-[#1c1d52]">
                        {signedInEmail}
                      </strong>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleContinue()}
                      disabled={isSubmitting}
                      className="mt-3 w-full rounded-xl bg-[#5fbb46] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#4d9d39] disabled:opacity-70"
                    >
                      {isSubmitting ? "Continuing..." : config.continueLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="mt-2 w-full text-center text-xs font-semibold text-slate-500 hover:underline"
                    >
                      Not you? Sign out
                    </button>
                  </div>
                )}

                {invite && (
                  <p
                    role="status"
                    className={`mb-5 rounded-xl px-4 py-3 text-sm ${invite === "confirmed" ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-amber-50 text-amber-900"}`}
                  >
                    {invite === "confirmed"
                      ? "Your email is confirmed. Sign in with the password your administrator gave you."
                      : "This invitation link has expired or was already used. Ask your administrator to resend it, or sign in if you've already confirmed your email."}
                  </p>
                )}

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Email address
                    </label>
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
                      <label
                        htmlFor="password"
                        className="text-sm font-semibold text-slate-700"
                      >
                        Password
                      </label>
                      <Link
                        href={
                          track === "courses"
                            ? "/forgot-password?track=courses"
                            : "/forgot-password"
                        }
                        className="text-xs font-semibold text-[#4d9d39] hover:underline"
                      >
                        Forgot password?
                      </Link>
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
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
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
                  <button
                    type="button"
                    onClick={handleOAuth}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    aria-label="Continue with Google"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                </div>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Don&apos;t have an account?{" "}
                  <Link
                    href={config.registerPath}
                    className="font-semibold text-[#4d9d39] hover:underline"
                  >
                    Register now
                  </Link>
                </p>
              </div>
            </div>

            <div
              className="hidden md:block relative bg-cover bg-center"
              style={{ backgroundImage: "url('/right-bg.png')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-black/10 to-black/20"></div>

              {/* Glassmorphism Card */}
              <div className="absolute left-16 top-16 w-[420px] h-[420px] rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 p-8 flex items-start">
                <div className="max-w-sm">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#f0be43]">
                    Learn with purpose
                  </p>
                  <h2 className="text-4xl font-bold leading-tight lg:text-5xl text-white">
                    Your next chapter starts here.
                  </h2>
                  <p className="mt-5 max-w-xs text-sm leading-6 text-white/75">
                    Access practical courses, supportive mentors, and a
                    community that keeps you moving.
                  </p>
                </div>
              </div>

              {/* Woman Image */}
              <div className="absolute right-8 bottom-0 w-80">
                <Image
                  src="/woman-with-tab.png"
                  alt="Woman with tablet"
                  width={640}
                  height={760}
                  className="h-auto w-full"
                />
              </div>

              {/* Thunderbolt Badge */}
              <div className="absolute left-8 top-72 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-md">
                <Image
                  src="/thunderbolt.png"
                  alt="Thunderbolt icon"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
