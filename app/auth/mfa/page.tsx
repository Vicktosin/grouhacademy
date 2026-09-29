"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAllowedPostAuthPath } from "@/lib/supabase/mfa";

function MfaChallengeForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  useEffect(() => {
    async function startChallenge() {
      const supabase = createSupabaseBrowserClient();
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === "verified");
      if (factorsError || !factor) {
        router.replace("/login");
        return;
      }
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) setError(challengeError.message);
      else {
        setFactorId(factor.id);
        setChallengeId(challenge.id);
      }
      setLoading(false);
    }
    void startChallenge();
  }, [router]);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function redeemBackupCode() {
    setVerifying(true);
    setError(null);
    const response = await fetch("/api/auth/mfa/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: backupCode }),
    });
    const data = (await response.json().catch(() => null)) as {
      redirectTo?: string;
      error?: string;
    } | null;
    if (!response.ok || !data?.redirectTo) {
      setError(data?.error ?? "Unable to use that backup code.");
      setVerifying(false);
      return;
    }
    // The authenticator was removed on the server; refresh so the browser's
    // session no longer lists it. If the session was ended, the user can now
    // sign in again with just their password.
    const { error: refreshError } =
      await createSupabaseBrowserClient().auth.refreshSession();
    router.replace(refreshError ? "/login" : `${data.redirectTo}?recovered=1`);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (useBackupCode) {
      await redeemBackupCode();
      return;
    }
    if (!factorId || !challengeId) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } =
      await createSupabaseBrowserClient().auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
    if (verifyError) {
      setError(verifyError.message);
      setVerifying(false);
      return;
    }
    if (isAllowedPostAuthPath(next)) {
      router.replace(next);
      router.refresh();
      return;
    }
    try {
      const response = await fetch("/api/auth/redirect", { cache: "no-store" });
      const data = (await response.json()) as { redirectTo?: string };
      if (!response.ok || !data.redirectTo)
        throw new Error("Unable to determine your workspace.");
      router.replace(data.redirectTo);
      router.refresh();
    } catch (redirectError) {
      setError(
        redirectError instanceof Error
          ? redirectError.message
          : "Unable to determine your workspace.",
      );
      setVerifying(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <img
          src="/logo.png"
          alt="Grouh Academy logo"
          className="mb-6 h-10 w-auto"
        />
        <h1 className="text-3xl font-bold text-[#1c1d52]">
          Verify your sign-in
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {useBackupCode
            ? "Enter one of the backup codes you saved when you set up Google Authenticator. This removes the authenticator so you can set up a new one."
            : "Enter the six-digit code from Google Authenticator to continue."}
        </p>
        {useBackupCode ? (
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Backup code
            <input
              required
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXXX-XXXXX"
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.2em] outline-none focus:border-[#5fbb46]"
            />
          </label>
        ) : (
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Authenticator code
            <input
              required
              minLength={6}
              maxLength={6}
              inputMode="numeric"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[#5fbb46]"
            />
          </label>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={
            loading ||
            verifying ||
            (useBackupCode ? !backupCode.trim() : code.length !== 6)
          }
          className="mt-6 w-full rounded-xl bg-[#1c1d52] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading
            ? "Preparing..."
            : verifying
              ? "Verifying..."
              : useBackupCode
                ? "Use backup code"
                : "Verify code"}
        </button>
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setError(null);
          }}
          className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-[#397d3a] hover:underline"
        >
          {useBackupCode
            ? "Use my authenticator app instead"
            : "Lost your phone? Use a backup code"}
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-[#1c1d52]"
        >
          Back to login
        </button>
      </form>
    </main>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
          Preparing verification...
        </main>
      }
    >
      <MfaChallengeForm />
    </Suspense>
  );
}
