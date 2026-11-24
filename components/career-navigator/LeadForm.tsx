"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { useState, type FormEvent } from "react";
import type { SkillId } from "@/lib/career-navigator";

const input =
  "mt-1.5 block w-full rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-base text-white outline-none focus:border-[#7BE05E]";

/** Optional: people who want guidance leave their name and WhatsApp number. */
export default function LeadForm({ skill, buttonClass }: { skill: SkillId; buttonClass: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/career-navigator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), consent: form.get("consent") === "on", skill }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "That didn't go through. Please try again.");
      setState("sent");
      sendGAEvent("event", "generate_lead", { location: "career_navigator_form", skill });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That didn't go through. Please try again.");
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <p role="status" className="text-lg font-semibold text-[#7BE05E]">
        Got it. We&apos;ll message you on WhatsApp.
      </p>
    );
  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Your name
        <input name="name" required maxLength={80} autoComplete="name" className={input} />
      </label>
      <label className="text-sm font-semibold">
        WhatsApp number
        <input name="phone" type="tel" required maxLength={22} autoComplete="tel" placeholder="0801 234 5678" className={input} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <label className="flex items-start gap-3 text-sm leading-6 text-white/80 sm:col-span-2">
        <input name="consent" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-[#7BE05E]" />
        Sabirole may keep my name, number and result, and message me on WhatsApp about learning this skill.
      </label>
      {error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={state === "sending"} className={`${buttonClass} justify-self-start disabled:opacity-60`}>
        {state === "sending" ? "Sending…" : "Send me guidance"}
      </button>
    </form>
  );
}
