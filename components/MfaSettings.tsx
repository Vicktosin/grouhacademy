"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MfaSettings() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [remainingCodes, setRemainingCodes] = useState<number | null>(null);

  async function loadRemainingCodes() {
    const response = await fetch("/api/auth/mfa/recovery-codes", {
      cache: "no-store",
    });
    if (response.ok) {
      const data = (await response.json()) as { remaining: number };
      setRemainingCodes(data.remaining);
    }
  }

  async function loadFactors() {
    const { data, error: factorsError } =
      await createSupabaseBrowserClient().auth.mfa.listFactors();
    if (factorsError) setError(factorsError.message);
    else {
      const verifiedId =
        data.totp.find((factor) => factor.status === "verified")?.id ?? null;
      setFactorId(verifiedId);
      if (verifiedId) await loadRemainingCodes();
    }
    setLoading(false);
  }

  async function generateRecoveryCodes() {
    const response = await fetch("/api/auth/mfa/recovery-codes", {
      method: "POST",
    });
    const data = (await response.json().catch(() => null)) as {
      codes?: string[];
      error?: string;
    } | null;
    if (!response.ok || !data?.codes) {
      setError(data?.error ?? "Unable to create backup codes.");
      return;
    }
    setRecoveryCodes(data.codes);
    setRemainingCodes(data.codes.length);
  }

  async function regenerateRecoveryCodes() {
    if (
      !window.confirm(
        "Create new backup codes? Your current backup codes will stop working.",
      )
    )
      return;
    setError(null);
    setMessage(null);
    setWorking(true);
    await generateRecoveryCodes();
    setWorking(false);
  }

  function recoveryCodesText() {
    return [
      "SabiRole backup codes",
      "Each code can be used once if you lose access to your authenticator app.",
      "",
      ...(recoveryCodes ?? []),
    ].join("\n");
  }

  async function copyRecoveryCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodesText());
      setMessage("Backup codes copied.");
    } catch {
      setError("Unable to copy. Please write the codes down instead.");
    }
  }

  function downloadRecoveryCodes() {
    const url = URL.createObjectURL(
      new Blob([recoveryCodesText()], { type: "text/plain" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "grouh-academy-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const task = window.setTimeout(() => {
      void loadFactors();
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  async function enroll() {
    setError(null);
    setMessage(null);
    setWorking(true);
    const { data, error: enrollError } =
      await createSupabaseBrowserClient().auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Google Authenticator",
      });
    if (enrollError || !data?.totp)
      setError(enrollError?.message ?? "Unable to start authenticator setup.");
    else {
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }
    setWorking(false);
  }

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setError(null);
    setWorking(true);
    const supabase = createSupabaseBrowserClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) setError(challengeError.message);
    else {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) setError(verifyError.message);
      else {
        setQrCode(null);
        setSecret(null);
        setCode("");
        setMessage("Google Authenticator is now protecting your account.");
        await generateRecoveryCodes();
      }
    }
    setWorking(false);
  }

  async function remove() {
    if (
      !factorId ||
      !window.confirm("Remove Google Authenticator from this account?")
    )
      return;
    setError(null);
    setWorking(true);
    const { error: removeError } =
      await createSupabaseBrowserClient().auth.mfa.unenroll({ factorId });
    if (removeError) setError(removeError.message);
    else {
      await fetch("/api/auth/mfa/recovery-codes", { method: "DELETE" });
      setFactorId(null);
      setRecoveryCodes(null);
      setRemainingCodes(null);
      setMessage("Google Authenticator was removed.");
    }
    setWorking(false);
  }

  if (loading)
    return (
      <p className="mt-4 text-xs text-slate-500">
        Checking authenticator status...
      </p>
    );

  return (
    <div className="mt-5 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-[#1C1D52]">
            Google Authenticator
          </h3>
          <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
            Use a time-based code from Google Authenticator whenever you sign
            in.
          </p>
        </div>
        {factorId && !qrCode && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={working}
            className="rounded-lg border border-red-200 px-3 py-2 text-[10px] font-bold text-red-600 disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      {!factorId && !qrCode && (
        <button
          type="button"
          onClick={() => void enroll()}
          disabled={working}
          className="mt-4 rounded-lg bg-[#5FBB46] px-4 py-2 text-[10px] font-bold text-[#14204f] disabled:opacity-60"
        >
          Set up authenticator
        </button>
      )}
      {qrCode && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
          <img
            src={qrCode}
            alt="QR code for Google Authenticator"
            className="h-40 w-40 rounded-lg border border-slate-200 p-2"
          />
          <div>
            <p className="text-xs font-semibold text-[#1C1D52]">
              Scan this QR code, then enter the six-digit code.
            </p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
              Manual key: {secret}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="000000"
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-[0.2em] outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => void verify()}
                disabled={working || code.length !== 6}
                className="rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-60"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
      {recoveryCodes && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="text-xs font-bold text-[#1C1D52]">
            Save your backup codes
          </h4>
          <p className="mt-1 text-[10px] leading-5 text-slate-600">
            If you lose your phone, each code lets you sign in once and set up
            a new authenticator. Store them somewhere safe. They won&apos;t be
            shown again.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-[#1C1D52]">
            {recoveryCodes.map((recoveryCode) => (
              <li
                key={recoveryCode}
                className="rounded-md bg-white px-2 py-1.5 text-center"
              >
                {recoveryCode}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyRecoveryCodes()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold text-[#1C1D52]"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={downloadRecoveryCodes}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-bold text-[#1C1D52]"
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoveryCodes(null);
                setMessage(null);
              }}
              className="rounded-lg bg-[#1C1D52] px-3 py-2 text-[10px] font-bold text-white"
            >
              I&apos;ve saved them
            </button>
          </div>
        </div>
      )}
      {factorId && !qrCode && !recoveryCodes && remainingCodes !== null && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div>
            <h3 className="text-sm font-bold text-[#1C1D52]">Backup codes</h3>
            <p
              className={`mt-1 text-[10px] leading-5 ${remainingCodes <= 2 ? "font-semibold text-red-600" : "text-slate-500"}`}
            >
              {remainingCodes === 0
                ? "You have no backup codes left. Create new ones now."
                : `${remainingCodes} unused backup code${remainingCodes === 1 ? "" : "s"} remaining.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void regenerateRecoveryCodes()}
            disabled={working}
            className="rounded-lg border border-slate-300 px-3 py-2 text-[10px] font-bold text-[#1C1D52] disabled:opacity-60"
          >
            {remainingCodes === 0 ? "Create backup codes" : "Create new codes"}
          </button>
        </div>
      )}
      {message && (
        <p className="mt-3 text-xs font-semibold text-[#397d3a]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
