"use client";

import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ClipboardList, Plus, RotateCcw, Save, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Cast, PersonId, Step, Workday } from "@/lib/office-life/story";
import type { OfficeLifeContent } from "@/lib/office-life/content";

type Track = { id: string; name: string };
type Level = { id: string; name: string; rank: number };
type LabScenario = { id: string; title: string; kind: string; level: string };
type ContentResponse = { id: string; name: string; level: Level; customized: boolean; content: OfficeLifeContent; labScenarios: LabScenario[] };
const PEOPLE: PersonId[] = ["ceo", "manager", "supporter", "challenger", "client"];
const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#1C1D52]";

const newStep = (kind: Step["kind"]): Step => {
  const id = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (kind === "inbox") return { id, kind, title: "Read the email", from: "manager", subject: "A note from your manager", body: "Write the message interns will receive." };
  if (kind === "meeting") return { id, kind, title: "Team meeting", agenda: "Discuss today's work", participants: ["manager"], lines: [{ speaker: "manager", text: "Thanks for joining." }, { you: "Share your update." }], rubric: "Clear, relevant and professional contribution." };
  if (kind === "email") return { id, kind, title: "Reply to the client", task: "Write a clear, professional reply.", to: ["client"], cc: [], rubric: "Responds clearly and professionally." };
  if (kind === "report") return { id, kind, title: "Daily report", task: "Complete your report.", fields: ["What I completed", "What is in progress", "What I will do next"], rubric: "Specific, honest and actionable." };
  return { id, kind, title: "Practice Lab task", task: "Complete the linked Practice Lab work and report what you built.", rubric: "Describes the work and explains the decisions.", labScenarioId: null };
};

export default function OfficeLifeBuilder() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [trackId, setTrackId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [labScenarios, setLabScenarios] = useState<LabScenario[]>([]);
  const [content, setContent] = useState<OfficeLifeContent | null>(null);
  const [customized, setCustomized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [section, setSection] = useState<"workplace" | "workdays">("workdays");

  const loadContent = useCallback(async (id: string, selectedLevelId: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ programId: id });
      if (selectedLevelId) query.set("levelId", selectedLevelId);
      const response = await fetch(`/api/admin/internship/office-life?${query}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to load Office Life content.");
      const result = body as ContentResponse;
      setTrackId(result.id);
      setLevelId(result.level.id);
      setContent(result.content);
      setLabScenarios(result.labScenarios);
      setCustomized(result.customized);
      setDirty(false);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to load content.", error: true });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/internship/office-life", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Unable to load tracks.");
        const list = body.tracks as Track[];
        const availableLevels = body.levels as Level[];
        setTracks(list);
        setLevels(availableLevels);
        if (list[0] && availableLevels[0]) void loadContent(list[0].id, availableLevels[0].id);
      })
      .catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : "Unable to load tracks.", error: true }));
  }, [loadContent]);

  const change = (patch: Partial<OfficeLifeContent>) => {
    setContent((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
    setMessage(null);
  };
  const changeCast = (id: PersonId, patch: Partial<Cast[PersonId]>) => {
    if (!content) return;
    change({ cast: { ...content.cast, [id]: { ...content.cast[id], ...patch } } });
  };
  const changeDay = (index: number, patch: Partial<Workday>) => {
    if (!content) return;
    change({ workdays: content.workdays.map((day, i) => i === index ? { ...day, ...patch } : day) });
  };
  const changeStep = (dayIndex: number, stepIndex: number, patch: Partial<Step>) => {
    if (!content) return;
    change({ workdays: content.workdays.map((day, i) => i !== dayIndex ? day : {
      ...day,
      steps: day.steps.map((step, j) => j === stepIndex ? { ...step, ...patch } as Step : step),
    }) });
  };
  const moveStep = (dayIndex: number, stepIndex: number, by: number) => {
    if (!content) return;
    const steps = [...content.workdays[dayIndex].steps];
    const [step] = steps.splice(stepIndex, 1);
    steps.splice(stepIndex + by, 0, step);
    changeDay(dayIndex, { steps });
  };

  async function save() {
    if (!content || !trackId) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/internship/office-life", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: trackId, levelId, content }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to save content.");
      setCustomized(true);
      setDirty(false);
      setMessage({ text: "Office Life content saved. New workdays use this version when interns clock in.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to save content.", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefaults() {
    if (!trackId || !window.confirm("Restore the generated Office Life content for this track?")) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ programId: trackId, levelId });
      const response = await fetch(`/api/admin/internship/office-life?${params}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Unable to restore defaults.");
      await loadContent(trackId, levelId);
      setMessage({ text: "Generated defaults are active. Workdays already in progress keep their saved version.", error: false });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to restore defaults.", error: true });
      setBusy(false);
    }
  }

  function addDay() {
    if (!content || content.workdays.length >= 30) return;
    const day = Math.max(0, ...content.workdays.map((item) => item.day)) + 1;
    change({ workdays: [...content.workdays, { day, title: `Workday ${day}`, summary: "Describe the goal for this workday.", opensWeek: Math.min(day, 52), opensDay: 1, opensTime: "09:00", dueWeek: Math.min(day, 52), dueDay: 7, dueTime: "23:59", steps: [newStep("inbox"), newStep("report")] }] });
  }

  if (!tracks.length && !message) return <p className="p-6 text-sm text-slate-500">Loading tracks…</p>;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <Link href="/admin/internship" className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1D52]"><ArrowLeft className="h-4 w-4" /> Internship admin</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Office Life</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">Manage the workplace, cast and scripted workdays interns experience. Voice lines are read as written; prompts are the intern&apos;s turns. Existing in-progress workdays keep their original version.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {customized && <button type="button" onClick={() => void restoreDefaults()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Restore defaults</button>}
          <button type="button" onClick={() => void save()} disabled={busy || !content || !dirty} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}</button>
        </div>
      </header>

      {message && <p className={`rounded-lg px-4 py-3 text-xs font-semibold ${message.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`} role="status">{message.text}</p>}

      <section className="grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_1fr] sm:items-end">
        <Field label="Track"><select value={trackId} onChange={(event) => void loadContent(event.target.value, levelId)} className={inputClass} disabled={busy}>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></Field>
        <Field label="Level"><select value={levelId} onChange={(event) => void loadContent(trackId, event.target.value)} className={inputClass} disabled={busy}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></Field>
        <p className="pb-2 text-xs text-slate-500">{customized ? "Customized content" : "Using generated defaults"} · This plan is for the selected level.</p>
      </section>

      {content && <>
        <nav className="flex gap-1 border-b border-slate-200" aria-label="Office Life content sections">
          {([ ["workdays", "Workdays", ClipboardList], ["workplace", "Workplace & team", UsersRound] ] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" onClick={() => setSection(key)} aria-current={section === key ? "page" : undefined} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${section === key ? "border-[#1C1D52] text-[#1C1D52]" : "border-transparent text-slate-500 hover:text-[#1C1D52]"}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </nav>

        {section === "workplace" ? (
          <section className="space-y-6">
            <header><h2 className="text-lg font-semibold text-[#1C1D52]">Workplace and team</h2><p className="mt-1 text-sm text-slate-500">Company details, client, and the people interns meet.</p></header>
            <div className="space-y-3 border-b border-slate-200 pb-6">
              <h3 className="text-sm font-semibold text-[#1C1D52]">Company and project</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Company name"><input className={inputClass} value={content.company.name} onChange={(e) => change({ company: { ...content.company, name: e.target.value } })} /></Field>
                <Field label="Company email domain"><input className={inputClass} value={content.company.domain} onChange={(e) => change({ company: { ...content.company, domain: e.target.value } })} /></Field>
                <Field label="Department"><input className={inputClass} value={content.department} onChange={(e) => change({ department: e.target.value })} /></Field>
                <Field label="Client company"><input className={inputClass} value={content.clientCompany} onChange={(e) => change({ clientCompany: e.target.value })} /></Field>
                <Field label="Client business"><input className={inputClass} value={content.clientBusiness} onChange={(e) => change({ clientBusiness: e.target.value })} /></Field>
                <Field label="Project"><input className={inputClass} value={content.project} onChange={(e) => change({ project: e.target.value })} /></Field>
                <Field label="Practice Lab tool"><input className={inputClass} value={content.labTool} onChange={(e) => change({ labTool: e.target.value })} /></Field>
                <div className="md:col-span-2 xl:col-span-3"><Field label="Company description"><textarea className={inputClass} rows={2} value={content.company.about} onChange={(e) => change({ company: { ...content.company, about: e.target.value } })} /></Field></div>
              </div>
            </div>
            <div className="space-y-3">
              <div><h3 className="text-sm font-semibold text-[#1C1D52]">People</h3><p className="mt-1 text-xs text-slate-500">Expand a person to edit their profile and meeting voice.</p></div>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {PEOPLE.map((id) => <PersonEditor key={id} personId={id} person={content.cast[id]} onChange={(patch) => changeCast(id, patch)} />)}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-[#1C1D52]">Workdays</h2><p className="mt-1 text-sm text-slate-500">Interns complete each workday in order. Expand a day, then open a task to edit it.</p></div>
              <button type="button" onClick={addDay} disabled={content.workdays.length >= 30} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#1C1D52] hover:bg-slate-50 disabled:opacity-40"><Plus className="h-4 w-4" /> Add workday</button>
            </header>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {content.workdays.map((day, dayIndex) => <WorkdayEditor key={`${day.day}-${dayIndex}`} day={day} index={dayIndex} labScenarios={labScenarios} onChange={(patch) => changeDay(dayIndex, patch)} onDelete={() => change({ workdays: content.workdays.filter((_, i) => i !== dayIndex) })} onStepChange={(stepIndex, patch) => changeStep(dayIndex, stepIndex, patch)} onStepDelete={(stepIndex) => changeDay(dayIndex, { steps: day.steps.filter((_, i) => i !== stepIndex) })} onStepAdd={(kind) => changeDay(dayIndex, { steps: [...day.steps, newStep(kind)] })} onStepMove={(stepIndex, by) => moveStep(dayIndex, stepIndex, by)} />)}
            </div>
          </section>
        )}
      </>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>{children}</label>;
}

function PersonEditor({ personId, person, onChange }: { personId: PersonId; person: Cast[PersonId]; onChange: (patch: Partial<Cast[PersonId]>) => void }) {
  return <details className="group py-3">
    <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-medium text-[#1C1D52] [&::-webkit-details-marker]:hidden">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold uppercase text-slate-600">{person.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</span>
      <span className="min-w-0 flex-1"><span className="block truncate">{person.name}</span><span className="block text-xs font-normal text-slate-500">{person.role} · {personId === "ceo" ? "CEO" : personId}</span></span>
      <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="mt-3 grid gap-3 pl-11 sm:grid-cols-2 xl:grid-cols-4">
      <Field label="Name"><input className={inputClass} value={person.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
      <Field label="Role"><input className={inputClass} value={person.role} onChange={(e) => onChange({ role: e.target.value })} /></Field>
      <Field label="Email"><input className={inputClass} value={person.email} onChange={(e) => onChange({ email: e.target.value })} /></Field>
      <Field label="Meeting voice"><select className={inputClass} value={person.voice} onChange={(e) => onChange({ voice: e.target.value as "female" | "male" })}><option value="female">Higher voice</option><option value="male">Lower voice</option></select></Field>
    </div>
  </details>;
}

function WorkdayEditor({ day, index, labScenarios, onChange, onDelete, onStepChange, onStepDelete, onStepAdd, onStepMove }: {
  day: Workday;
  index: number;
  labScenarios: LabScenario[];
  onChange: (patch: Partial<Workday>) => void;
  onDelete: () => void;
  onStepChange: (index: number, patch: Partial<Step>) => void;
  onStepDelete: (index: number) => void;
  onStepAdd: (kind: Step["kind"]) => void;
  onStepMove: (index: number, by: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  return <article className="py-1">
    <details open={index === 0} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1C1D52] text-xs font-bold text-white">{day.day}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#1C1D52]">{day.title || `Workday ${index + 1}`}</span><span className="mt-0.5 block text-xs text-slate-500">Week {day.opensWeek}, day {day.opensDay} · {day.steps.length} {day.steps.length === 1 ? "step" : "steps"}</span></span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 pb-5 pl-0 sm:pl-11">
        <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto] sm:items-end">
          <Field label="Workday number"><input type="number" min={1} max={30} className={inputClass} value={day.day} onChange={(e) => onChange({ day: Number(e.target.value) })} /></Field>
          <Field label="Workday title"><input className={inputClass} value={day.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <button type="button" onClick={onDelete} aria-label="Delete workday" title="Delete workday" className="mb-0.5 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /><span className="sm:hidden">Delete workday</span></button>
          <div className="sm:col-span-3"><Field label="Workday summary"><textarea className={inputClass} rows={2} value={day.summary} onChange={(e) => onChange({ summary: e.target.value })} /></Field></div>
          <div className="sm:col-span-3">
            <p className="mb-2 text-xs font-semibold text-[#1C1D52]">Availability · times are West Africa Time</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScheduleFields label="Opens" week={day.opensWeek} day={day.opensDay} time={day.opensTime} onChange={(patch) => onChange({ opensWeek: patch.week, opensDay: patch.day, opensTime: patch.time })} />
              <ScheduleFields label="Due" week={day.dueWeek} day={day.dueDay} time={day.dueTime} onChange={(patch) => onChange({ dueWeek: patch.week, dueDay: patch.day, dueTime: patch.time })} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Day 1 is the cohort start date. Select any day in a cohort week, matching Internship Task scheduling.</p>
          </div>
        </div>
        <ol className="divide-y divide-slate-200 border-y border-slate-200">
          {day.steps.map((step, stepIndex) => <li key={step.id} className="py-2">
            <details className="group/step">
              <summary className="flex cursor-pointer list-none items-center gap-2 py-2 [&::-webkit-details-marker]:hidden">
                <span className="w-8 text-[11px] font-semibold tabular-nums text-slate-400">{String(stepIndex + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#1C1D52]">{step.title || "Untitled step"}</span><span className="block text-[11px] capitalize text-slate-500">{step.kind === "work" ? "Practice Lab task" : step.kind === "meeting" && step.meetingType === "interview" ? "Interview" : step.kind}</span></span>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open/step:rotate-180" />
              </summary>
              <div className="space-y-3 pb-3 pl-10">
                <div className="flex items-center justify-end gap-1">
                  <IconButton label="Move step up" disabled={stepIndex === 0} onClick={() => onStepMove(stepIndex, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                  <IconButton label="Move step down" disabled={stepIndex === day.steps.length - 1} onClick={() => onStepMove(stepIndex, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                  <IconButton label="Delete step" danger onClick={() => onStepDelete(stepIndex)}><Trash2 className="h-4 w-4" /></IconButton>
                </div>
                <StepEditor step={step} labScenarios={labScenarios} onChange={(patch) => onStepChange(stepIndex, patch)} />
              </div>
            </details>
          </li>)}
        </ol>
        {adding ? <div className="flex flex-wrap gap-2">{(["inbox", "meeting", "email", "report", "work"] as const).map((kind) => <button key={kind} type="button" onClick={() => { onStepAdd(kind); setAdding(false); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium capitalize text-[#1C1D52] hover:bg-slate-50">{kind === "work" ? "Practice Lab task" : `Add ${kind}`}</button>)}<button type="button" onClick={() => setAdding(false)} className="px-2 text-xs text-slate-500">Cancel</button></div> : <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1D52]"><Plus className="h-4 w-4" /> Add task or activity</button>}
      </div>
    </details>
  </article>;
}

const WEEK_DAYS = ["Day 1 · Cohort start", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

function ScheduleFields({ label, week, day, time, onChange }: { label: string; week: number; day: number; time: string; onChange: (point: { week: number; day: number; time: string }) => void }) {
  return <fieldset className="grid grid-cols-[1fr_1fr_110px] gap-2 rounded-lg bg-slate-50 p-3">
    <legend className="px-1 text-[10px] font-bold uppercase text-slate-500">{label}</legend>
    <Field label="Week"><input type="number" min={1} max={52} className={inputClass} value={week} onChange={(event) => onChange({ week: Number(event.target.value), day, time })} /></Field>
    <Field label="Day"><select className={inputClass} value={day} onChange={(event) => onChange({ week, day: Number(event.target.value), time })}>{WEEK_DAYS.map((name, index) => <option key={index + 1} value={index + 1}>{name}</option>)}</select></Field>
    <Field label="Time"><input type="time" className={inputClass} value={time} onChange={(event) => onChange({ week, day, time: event.target.value })} /></Field>
  </fieldset>;
}

function StepEditor({ step, labScenarios, onChange }: { step: Step; labScenarios: LabScenario[]; onChange: (patch: Partial<Step>) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">
    <Field label="Step title"><input className={inputClass} value={step.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
    {step.kind === "inbox" && <>
      <Field label="Sender"><select className={inputClass} value={step.from} onChange={(e) => onChange({ from: e.target.value as PersonId })}>{PEOPLE.map((id) => <option key={id} value={id}>{id}</option>)}</select></Field>
      <Field label="Email subject"><input className={inputClass} value={step.subject} onChange={(e) => onChange({ subject: e.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Email message"><textarea className={inputClass} rows={5} value={step.body} onChange={(e) => onChange({ body: e.target.value })} /></Field></div>
    </>}
    {step.kind === "meeting" && <>
      <Field label="Session type"><select className={inputClass} value={step.meetingType ?? "meeting"} onChange={(e) => onChange({ meetingType: e.target.value as "meeting" | "interview" })}><option value="meeting">Meeting</option><option value="interview">Job interview</option></select></Field>
      <Field label="Meeting agenda"><textarea className={inputClass} rows={2} value={step.agenda} onChange={(e) => onChange({ agenda: e.target.value })} /></Field>
      <div className="md:col-span-2"><PeoplePicker label="Participants" value={step.participants} onChange={(participants) => onChange({ participants, lines: step.lines.filter((line) => "you" in line || participants.includes(line.speaker)) })} /></div>
      <div className="md:col-span-2 space-y-2">
        <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase text-slate-500">Call script and intern turns</p><button type="button" onClick={() => onChange({ lines: [...step.lines, { you: "Your turn: ..." }] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1D52]"><Plus className="h-3.5 w-3.5" /> Add turn</button></div>
        {step.lines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-2 md:grid-cols-[150px_1fr_auto]">
          {"you" in line ? <><span className="self-center text-xs font-semibold text-emerald-800">Intern speaks</span><textarea className={inputClass} rows={2} value={line.you} onChange={(e) => onChange({ lines: step.lines.map((item, i) => i === index ? { you: e.target.value } : item) })} /></> : <><select className={inputClass} value={line.speaker} onChange={(e) => onChange({ lines: step.lines.map((item, i) => i === index ? { speaker: e.target.value as PersonId, text: line.text } : item) })}>{step.participants.map((id) => <option key={id} value={id}>{id}</option>)}</select><textarea className={inputClass} rows={2} value={line.text} onChange={(e) => onChange({ lines: step.lines.map((item, i) => i === index ? { speaker: line.speaker, text: e.target.value } : item) })} /></>}
          <button type="button" aria-label="Delete dialogue line" onClick={() => onChange({ lines: step.lines.filter((_, i) => i !== index) })} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
        </div>)}
        <p className="text-[11px] text-slate-500">Character lines are spoken as written, then the next line plays after the intern completes each prompt.</p>
      </div>
      <div className="md:col-span-2"><Field label="What good performance looks like"><textarea className={inputClass} rows={3} value={step.rubric} onChange={(e) => onChange({ rubric: e.target.value })} /></Field></div>
    </>}
    {step.kind === "email" && <>
      <Field label="Task instructions"><textarea className={inputClass} rows={3} value={step.task} onChange={(e) => onChange({ task: e.target.value })} /></Field>
      <PeoplePicker label="Required To recipients" value={step.to} onChange={(to) => onChange({ to })} />
      <PeoplePicker label="Cc recipients" value={step.cc} onChange={(cc) => onChange({ cc })} />
      <div className="md:col-span-2"><Field label="What good performance looks like"><textarea className={inputClass} rows={3} value={step.rubric} onChange={(e) => onChange({ rubric: e.target.value })} /></Field></div>
    </>}
    {step.kind === "report" && <>
      <Field label="Task instructions"><textarea className={inputClass} rows={3} value={step.task} onChange={(e) => onChange({ task: e.target.value })} /></Field>
      <Field label="Report fields"><div className="space-y-2">{step.fields.map((field, index) => <div key={index} className="flex gap-2"><input className={inputClass} value={field} onChange={(e) => onChange({ fields: step.fields.map((item, i) => i === index ? e.target.value : item) })} /><button type="button" aria-label="Remove report field" disabled={step.fields.length <= 1} onClick={() => onChange({ fields: step.fields.filter((_, i) => i !== index) })} className="rounded p-2 text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" onClick={() => onChange({ fields: [...step.fields, "New report field"] })} className="inline-flex items-center gap-1 text-xs font-semibold text-[#1C1D52]"><Plus className="h-3.5 w-3.5" /> Add field</button></div></Field>
      <div className="md:col-span-2"><Field label="What good performance looks like"><textarea className={inputClass} rows={3} value={step.rubric} onChange={(e) => onChange({ rubric: e.target.value })} /></Field></div>
    </>}
    {step.kind === "work" && <>
      <Field label="Practice Lab task instructions"><textarea className={inputClass} rows={3} value={step.task} onChange={(e) => onChange({ task: e.target.value })} /></Field>
      <Field label="Linked Practice Lab exercise"><select className={inputClass} value={step.labScenarioId ?? ""} onChange={(e) => onChange({ labScenarioId: e.target.value || null })}><option value="">No linked exercise</option>{labScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title} · {scenario.level} · {scenario.kind}</option>)}</select></Field>
      <p className="text-[11px] text-slate-500 md:col-span-2">Only published exercises from this track at this level or below are available. The intern can open the linked exercise before submitting this activity.</p>
      <Field label="What good performance looks like"><textarea className={inputClass} rows={3} value={step.rubric} onChange={(e) => onChange({ rubric: e.target.value })} /></Field>
    </>}
  </div>;
}

function PeoplePicker({ label, value, onChange }: { label: string; value: PersonId[]; onChange: (value: PersonId[]) => void }) {
  return <fieldset><legend className="mb-1.5 text-[10px] font-bold uppercase text-slate-500">{label}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{PEOPLE.map((id) => <label key={id} className="flex items-center gap-1.5 text-xs capitalize text-[#1C1D52]"><input type="checkbox" checked={value.includes(id)} onChange={(e) => onChange(e.target.checked ? [...value, id] : value.filter((item) => item !== id))} className="accent-[#1C1D52]" />{id}</label>)}</div></fieldset>;
}

function IconButton({ label, disabled, danger, onClick, children }: { label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={`rounded p-1.5 disabled:opacity-30 ${danger ? "text-red-600 hover:bg-red-50" : "text-slate-500 hover:bg-slate-100"}`}>{children}</button>;
}