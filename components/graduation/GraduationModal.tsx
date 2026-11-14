"use client";

import { ArrowLeft, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ExperienceForm from "./ExperienceForm";
import FlyerStep from "./FlyerStep";
import {
  OPEN_GRADUATION_EVENT,
  markGraduationSettled,
  useGraduation,
} from "./graduation-data";

// The graduation pop-up, on every internship page (InternshipShell). It
// opens by itself, first thing, once every time a graduate (an intern with
// an internship certificate) logs in; the level-complete congratulations
// waits for it. Never for anyone who hasn't completed.
// "My graduation flyer" (dashboard, testimonial page) and the admin preview
// banner open it any time. Step 1 is the flyer; after they download or share
// it, step 2 asks about their experience.

const SHOWN_KEY = "sabirole-graduation-shown";

/** This login: the user and when they signed in (changes every login). */
async function currentLogin() {
  try {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    const user = data.session?.user;
    return user ? `${user.id}:${user.last_sign_in_at ?? ""}` : null;
  } catch {
    return null;
  }
}

function shownFor(login: string) {
  try {
    return window.localStorage.getItem(SHOWN_KEY) === login;
  } catch {
    return false;
  }
}

function rememberShown(login: string) {
  try {
    window.localStorage.setItem(SHOWN_KEY, login);
  } catch {
    // Without storage it may open again on the next page.
  }
}

export default function GraduationModal({ enabled }: { enabled: boolean }) {
  const { data, loaded } = useGraduation(enabled);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"flyer" | "experience">("flyer");
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const autoChecked = useRef(false);

  // Open by itself, once per login, for a graduate.
  useEffect(() => {
    if (!enabled) return markGraduationSettled();
    if (!loaded || autoChecked.current) return;
    autoChecked.current = true;
    if (!data?.graduated) return markGraduationSettled();
    void currentLogin().then((login) => {
      if (login && shownFor(login)) return markGraduationSettled();
      if (login) rememberShown(login);
      setOpen(true);
    });
  }, [enabled, loaded, data]);

  // Opened on request.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const wanted = (event as CustomEvent<{ step?: "flyer" | "experience" }>).detail?.step;
      returnFocus.current = document.activeElement as HTMLElement | null;
      setStep(wanted ?? "flyer");
      setOpen(true);
    };
    window.addEventListener(OPEN_GRADUATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GRADUATION_EVENT, onOpen);
  }, []);

  // Focus inside, trap Tab, Esc closes.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, [href], input, textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]):not([tabindex="-1"]), textarea, [role="radio"], canvas[tabindex]',
      )].filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  function close() {
    setOpen(false);
    markGraduationSettled();
    returnFocus.current?.focus?.();
  }

  if (!open || !data) return null;
  // Never for anyone who hasn't completed (the preview intern counts).
  if (!data.graduated) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-[#11132f]/75 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="graduation-title"
        className="relative max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:rounded-3xl sm:px-7"
      >
        <div className="mb-2 flex items-center justify-between">
          {step === "experience" ? (
            <button type="button" onClick={() => setStep("flyer")} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> My flyer
            </button>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400">Step 1 of 2</span>
          )}
          <button type="button" onClick={close} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {data.isPreview && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
            Preview: interns see this once they&apos;ve earned their internship certificate.
          </p>
        )}
        {step === "flyer" ? (
          <FlyerStep data={data} onShared={() => setStep("experience")} />
        ) : (
          <ExperienceForm data={data} onDone={close} />
        )}
        {step === "flyer" && (
          <button
            type="button"
            onClick={() => setStep("experience")}
            className="mt-4 block w-full text-center text-xs font-semibold text-slate-500 underline"
          >
            Skip to sharing your experience
          </button>
        )}
      </div>
    </div>
  );
}
