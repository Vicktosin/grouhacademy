"use client";

import { ArrowLeft, Check, ClipboardList, Clock, Lock, Mail, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FullscreenToggle } from "@/components/FullscreenFrame";
import MailApp from "./MailApp";
import MeetApp from "./MeetApp";
import ReportsApp from "./ReportsApp";
import type { Act, DayData, StepView } from "./shared";
import { checkForAchievements } from "@/lib/achievement-events";

// A Office Life workday: clock in, then work through the day's steps in
// order using Mail, Meet and Reports, as at a real job.

type App = "mail" | "meet" | "reports";

const appFor = (step: StepView | undefined): App =>
  !step ? "mail" : step.kind === "meeting" ? "meet" : step.kind === "report" || step.kind === "work" ? "reports" : "mail";

const ICON = { inbox: Mail, email: Mail, meeting: Video, report: ClipboardList, work: ClipboardList } as const;

export default function OfficeLifeDesk({ initial, onBack }: { initial: DayData; onBack: () => void }) {
  const [day, setDay] = useState(initial);
  const [app, setApp] = useState<App>(() => appFor(initial.steps.find((step) => step.available)));
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const current = day.steps.find((step) => step.available);
  const doneCount = day.steps.filter((step) => step.done).length;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const act: Act = useCallback(
    async (body) => {
      const response = await fetch(`/api/internship/office-life/${day.day}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (!response?.ok) return data?.error ?? "That didn't go through. Check your connection and try again.";
      const next = data as DayData;
      // When the work moves to a new step, open the app it needs.
      const before = day.steps.find((step) => step.available)?.id;
      const after = next.steps.find((step) => step.available);
      if (after && after.id !== before) setApp(appFor(after));
      setDay(next);
      checkForAchievements();
      return null;
    },
    [day],
  );

  const clock = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

  return (
    <div className="overflow-hidden rounded-2xl border border-[#DADCE0] bg-white shadow-[0_8px_24px_rgba(28,29,82,0.09)]" style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
      <header className="flex flex-wrap items-center gap-3 border-b border-[#E8EAED] bg-white px-4 py-2.5">
        <button type="button" onClick={onBack} aria-label="All workdays" className="rounded-full p-2 text-[#5F6368] hover:bg-[#F1F3F4]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0B57D0] text-[14px] font-black text-white">B</span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[14px] font-medium text-[#202124]">{day.company.name}</p>
          <p className="truncate text-[12px] text-[#5F6368]">
            {day.department} · Workday {day.day}: {day.title}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[13px] text-[#3C4043]">
          <Clock className="h-4 w-4 text-[#5F6368]" /> {clock}
          {day.clockedInAt && <span className="hidden text-[#5F6368] sm:inline">· in since {new Date(day.clockedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</span>}
          <FullscreenToggle className="bg-[#F1F3F4] text-[#3C4043] hover:bg-[#E8EAED]" />
        </div>
      </header>

      {!day.clockedInAt ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 bg-[#F8F9FA] p-8 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5F6368]">Workday {day.day}</p>
          <p className="text-[26px] text-[#202124]">{day.title}</p>
          <p className="max-w-lg text-[14px] text-[#5F6368]">{day.summary}</p>
          {day.dueAt && <p className="text-[13px] text-[#5F6368]">Finish by {new Date(day.dueAt).toLocaleString("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })} (Lagos time) to be on time.</p>}
          <button
            type="button"
            onClick={() => void act({ action: "clock-in" })}
            className="mt-3 rounded-full bg-[#0B57D0] px-8 py-3 text-[15px] font-medium text-white hover:bg-[#0842A0]"
          >
            Clock in and start work
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-[#E8EAED] bg-[#F8F9FA] p-4 lg:border-b-0 lg:border-r">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5F6368]">Today · {doneCount}/{day.steps.length}</p>
            <ol className="mt-3 space-y-1.5">
              {day.steps.map((step) => {
                const Icon = ICON[step.kind];
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={!step.available && !step.done}
                      onClick={() => setApp(appFor(step))}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] ${step.available ? "bg-[#D3E3FD] font-medium text-[#041E49]" : step.done ? "text-[#3C4043] hover:bg-[#F1F3F4]" : "text-[#9AA0A6]"}`}
                    >
                      <span className="mt-0.5">
                        {step.done ? <Check className="h-4 w-4 text-[#137333]" /> : step.available ? <Icon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        {step.title}
                        {step.available && <span className="block text-[11px] font-normal text-[#0B57D0]">Now</span>}
                        {step.feedback && <span className="block text-[11px] font-normal text-[#5F6368]">{step.feedback.score}/100</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {day.completedAt && (
              <div className="mt-4 rounded-lg bg-[#E6F4EA] p-3 text-[13px] text-[#137333]">
                <p className="font-semibold">Workday complete</p>
                <p>Score: {day.score}/100</p>
              </div>
            )}
          </aside>

          <div className="flex min-w-0 flex-col">
            <nav className="flex border-b border-[#E8EAED] bg-white" role="tablist">
              {(
                [
                  ["mail", "Mail", Mail],
                  ["meet", "Meet", Video],
                  ["reports", "Reports", ClipboardList],
                ] as const
              ).map(([key, label, Icon]) => {
                const due = current && appFor(current) === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={app === key}
                    onClick={() => setApp(key)}
                    className={`relative -mb-px inline-flex flex-1 items-center justify-center gap-2 border-b-[3px] px-4 py-3 text-[14px] font-medium sm:flex-none sm:px-6 ${app === key ? "border-[#0B57D0] text-[#0B57D0]" : "border-transparent text-[#5F6368] hover:bg-[#F8F9FA]"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                    {due && <span className="h-2 w-2 rounded-full bg-[#EA4335]" aria-label="needs you" />}
                  </button>
                );
              })}
            </nav>
            <div className="min-h-0 flex-1">
              {app === "mail" && <MailApp day={day} act={act} onSent={setToast} />}
              {app === "meet" && <MeetApp day={day} act={act} onDone={setToast} />}
              {app === "reports" && <ReportsApp day={day} act={act} onSent={setToast} />}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-lg bg-[#323232] px-5 py-3 text-[14px] text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
