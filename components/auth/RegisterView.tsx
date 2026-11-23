"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Container from "@/components/Container";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  LEARNER_TRACKS,
  requestedPathForTrack,
  type LearnerTrack,
} from "@/lib/learner-tracks";
import { getSiteUrl } from "@/lib/site-url";
import GoogleIcon from "@/components/GoogleIcon";

/**
 * The sign-up page for one learner side. New accounts join this side; an
 * email that already has an account is pointed to this side's login, where
 * the same password adds it to this side.
 */
export default function RegisterView({ track }: { track: LearnerTrack }) {
  const config = LEARNER_TRACKS[track];
  const [existingAccount, setExistingAccount] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const referralClickRef = useRef<string | null>(null);
  const referralCapture = useRef<Promise<string | null> | null>(null);
  // Who shared the achievement card that brought them here.
  const [invite, setInvite] = useState<{ name: string; title: string; track: string | null; cardUrl: string } | null>(null);
  const router = useRouter();

  function captureReferralIfNeeded() {
    if (track !== "internship") return Promise.resolve(null);
    referralCapture.current ??= (async () => {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (!code) return null;
      const response = await fetch("/api/referrals/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error("Unable to record this referral link.");
      const data = (await response.json()) as { clickId?: unknown; invite?: typeof invite };
      if (data.invite) setInvite(data.invite);
      if (typeof data.clickId !== "string") return null;
      referralClickRef.current = data.clickId;
      return data.clickId;
    })().catch((captureError: unknown) => {
      referralCapture.current = null;
      throw captureError;
    });
    return referralCapture.current;
  }

  async function markReferralRegistrationStarted(clickId: string | null) {
    if (!clickId) return;
    const response = await fetch("/api/referrals/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickId }),
    });
    if (!response.ok) throw new Error("Unable to record referral registration start.");
  }

  useEffect(() => {
    // Once, on arrival (captureReferralIfNeeded keeps a single request).
    void captureReferralIfNeeded().catch((captureError: unknown) =>
      console.error("Referral tracking is unavailable:", captureError),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  function nextPath() {
    const destination =
      requestedPathForTrack(
        track,
        new URLSearchParams(window.location.search).get("next"),
      ) ?? config.home;
    const clickId = referralClickRef.current;
    if (track !== "internship" || !clickId) return destination;
    const url = new URL(destination, window.location.origin);
    url.searchParams.set("referralClick", clickId);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setExistingAccount(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agreed) {
      setError("Please accept the terms and privacy policy to continue.");
      return;
    }

    setIsSubmitting(true);

    let clickId = referralClickRef.current;
    try {
      clickId = (await captureReferralIfNeeded()) ?? clickId;
      await markReferralRegistrationStarted(clickId);
    } catch (referralError) {
      console.error("Referral tracking could not be completed:", referralError);
    }

    const supabase = createSupabaseBrowserClient();
    const destination = nextPath();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${getSiteUrl()}${config.loginPath}?next=${encodeURIComponent(destination)}`,
      },
    });

    if (signUpError) {
      setError(
        signUpError.message || "Unable to create your account right now.",
      );
      setIsSubmitting(false);
      return;
    }

    // Supabase reports an email that is already registered as a user with
    // no identities (it does not reveal it as an error).
    if (data.user && data.user.identities?.length === 0) {
      setExistingAccount(true);
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      // Adds the new account to this side before entering it.
      const redirectQuery = new URLSearchParams({ track });
      if (clickId) redirectQuery.set("referralClick", clickId);
      await fetch(`/api/auth/redirect?${redirectQuery}`, { cache: "no-store" });
      router.push(destination);
      router.refresh();
      return;
    }

    setSuccess(
      "Account created. Please check your email to verify your address before signing in.",
    );
    setIsSubmitting(false);
  };

  const handleOAuth = async () => {
    setError(null);
    let clickId = referralClickRef.current;
    try {
      clickId = (await captureReferralIfNeeded()) ?? clickId;
      await markReferralRegistrationStarted(clickId);
    } catch (referralError) {
      console.error("Referral tracking could not be completed:", referralError);
    }
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(nextPath())}&track=${track}`,
      },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <main className="min-h-screen bg-slate-100 text-[#17251c]">
      <section className="relative isolate flex min-h-screen items-center overflow-hidden py-10 sm:py-16">
        <div className="absolute inset-0 -z-10" />

        <Container className="relative z-10 w-full py-0">
          <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_70px_rgba(28,29,82,0.16)] md:min-h-[620px] md:grid-cols-[0.9fr_1.1fr]">
            <div className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
              <div className="mx-auto w-full max-w-md">
                <div className="mb-8">
                  <Link href="/" className="inline-flex">
                    <Image
                      src="/logo.png"
                      alt="SabiRole logo"
                      width={160}
                      height={64}
                      className="mb-3 h-10 w-auto"
                    />
                  </Link>
                  {invite && (
                    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#5FBB46]/30 bg-[#5FBB46]/10 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the generated card */}
                      <img src={invite.cardUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl" />
                      <p className="text-sm leading-5 text-[#1c1d52]">
                        <span className="font-bold">{invite.name}</span> just unlocked{" "}
                        <span className="font-bold">“{invite.title}”</span>
                        {invite.track ? ` in our ${invite.track} internship` : " here"}. Your turn: start below.
                      </p>
                    </div>
                  )}
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4d9d39]">
                    {config.name}
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#1c1d52] sm:text-4xl">
                    {config.registerTitle}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {config.registerSubtitle}
                  </p>
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

                <div className="my-8 flex items-center gap-4 text-xs text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>or continue with</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Full name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15"
                      required
                    />
                  </div>
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
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Create a password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Confirm your password"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#5fbb46] focus:bg-white focus:ring-4 focus:ring-[#5fbb46]/15"
                      required
                    />
                  </div>

                  <label className="flex items-start gap-3 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(event) => setAgreed(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#5fbb46] focus:ring-[#5fbb46]"
                    />
                    <span>I agree to the terms and privacy policy.</span>
                  </label>

                  {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  {existingAccount ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      An account with this email already exists.{" "}
                      <Link
                        href={config.loginPath}
                        className="font-semibold text-[#1c1d52] underline"
                      >
                        Log in here
                      </Link>{" "}
                      with the same password to continue.
                    </div>
                  ) : null}

                  {success ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {success}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-[#1c1d52] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#1c1d52]/20 transition hover:bg-[#292a68] focus:outline-none focus:ring-4 focus:ring-[#1c1d52]/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </button>
                </form>

                <p className="mt-8 text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <Link
                    href={config.loginPath}
                    className="font-semibold text-[#4d9d39] hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </div>

            {/* Glassmorphism Card */}
            <div
              className="hidden md:block flex items-center relative bg-cover bg-center"
              style={{ backgroundImage: "url('/right-bg.png')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-black/10 to-black/20" />

              <div className="absolute left-16 top-60 w-[480px] h-[420px] rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 p-8 flex items-start">
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
                <div className="absolute right-[-40] bottom-0 w-60">
                  <Image
                    src="/woman-with-tab.png"
                    alt="Woman with tablet"
                    width={640}
                    height={760}
                    className="h-auto w-full"
                  />
                </div>
              </div>

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
