"use client";

import { CheckCircle2, Circle, Rocket, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STARTER_STEPS } from "@/lib/intern-guide";
import { getFlag, ONBOARDING_CHANGED, setFlag } from "@/lib/intern-onboarding";

// The dashboard's getting-started list: first things to do, each linking to
// the right page and ticking itself once done. Gone when everything's done
// or the intern hides it.

export default function GettingStarted({ passedFirstTask }: { passedFirstTask: boolean }) {
  const [done, setDone] = useState<Record<string, boolean> | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const read = () => {
      setDone(
        Object.fromEntries(
          STARTER_STEPS.map((step) => [
            step.key,
            Boolean(getFlag(step.key === "welcome" ? "welcome" : `visited:${step.section}`)),
          ]),
        ),
      );
      setHidden(Boolean(getFlag("checklist-hidden")));
    };
    read();
    window.addEventListener(ONBOARDING_CHANGED, read);
    return () => window.removeEventListener(ONBOARDING_CHANGED, read);
  }, []);

  if (!done || hidden) return null;
  const steps = [
    ...STARTER_STEPS.map((step) => ({ ...step, done: done[step.key] })),
    {
      key: "first-task",
      label: "Complete your first task with your group and get it accepted",
      href: "/internship/dashboard/tasks",
      done: passedFirstTask,
    },
  ];
  const count = steps.filter((step) => step.done).length;
  if (count === steps.length) return null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(28,29,82,0.09)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#1C1D52]">
            <Rocket className="h-4 w-4 text-[#5FBB46]" /> Getting started
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {count} of {steps.length} done. Each step takes you to the right page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFlag("checklist-hidden");
            setHidden(true);
          }}
          aria-label="Hide getting started"
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#5FBB46]" style={{ width: `${(count / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs hover:bg-[#f8fbff] ${step.done ? "text-slate-400 line-through" : "font-semibold text-[#1C1D52]"}`}
            >
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5FBB46]" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300" />
              )}
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
