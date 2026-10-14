"use client";

import { Eye, Pencil, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  ACHIEVEMENT_RARITIES,
  ACHIEVEMENT_TRIGGERS,
  BADGE_EMOJI,
  OFFICE_LIFE_STEP_KINDS,
  STEP_KIND_LABELS,
  TRIGGER_LABELS,
  badgeEmoji,
  type AchievementConditions as Conditions,
  type OfficeLifeStepKind,
} from "@/lib/achievements-shared";

type Trigger = (typeof ACHIEVEMENT_TRIGGERS)[number];
type Rarity = (typeof ACHIEVEMENT_RARITIES)[number];
type Definition = {
  id: string;
  title: string;
  description: string;
  congratulatoryMessage: string;
  category: string;
  trigger: Trigger;
  conditions: Conditions;
  programId: string | null;
  levelId: string | null;
  isRepeatable: boolean;
  rarity: Rarity;
  icon: string;
  isActive: boolean;
  program: { id: string; name: string } | null;
  level: { id: string; name: string } | null;
  stats: { unlocks: number; shares: number; clicks: number; registrations: number };
};
type Option = { id: string; name: string };
type Editor = Omit<Definition, "id" | "program" | "level" | "stats"> & { id?: string };


const emptyEditor: Editor = {
  title: "",
  description: "",
  congratulatoryMessage: "",
  category: "Progress",
  trigger: "TASK_ACCEPTED",
  conditions: {},
  programId: null,
  levelId: null,
  isRepeatable: false,
  rarity: "COMMON",
  icon: "award",
  isActive: true,
};

function conditionsFor(trigger: Trigger, conditions: Conditions) {
  switch (trigger) {
    case "TASK_ACCEPTED":
    case "PERFECT_SCORE":
      return conditions.taskTitleContains
        ? { taskTitleContains: conditions.taskTitleContains }
        : {};
    case "SCORE_THRESHOLD":
      return {
        minPercent: conditions.minPercent ?? 90,
        ...(conditions.taskTitleContains ? { taskTitleContains: conditions.taskTitleContains } : {}),
      };
    case "WEEK_COMPLETE":
      return conditions.weekNumber ? { weekNumber: conditions.weekNumber } : {};
    case "TASK_COUNT":
      return { minCount: conditions.minCount ?? 5 };
    case "TASK_SUBMITTED":
      return conditions.minCount === undefined ? {} : { minCount: conditions.minCount };
    case "OFFICE_LIFE_COMPLETE":
      return conditions.minScore === undefined ? {} : { minScore: conditions.minScore };
    case "OFFICE_LIFE_STEP":
      return {
        ...(conditions.stepKind ? { stepKind: conditions.stepKind } : {}),
        ...(conditions.minScore === undefined ? {} : { minScore: conditions.minScore }),
      };
    case "PRACTICE_LAB_COMPLETE":
      return conditions.minPercent === undefined ? {} : { minPercent: conditions.minPercent };
    case "GROUP_LEADERSHIP":
    case "OFFICE_LIFE_CLOCK_IN":
    case "LEVEL_UP":
      return {};
  }
}

async function fetchAchievements() {
  const response = await fetch("/api/admin/internship/achievements", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load achievements.");
  return data as { definitions: unknown[]; programs: unknown[]; levels: unknown[] };
}

export default function AchievementManager() {
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [levels, setLevels] = useState<Option[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedUnlocks, setSelectedUnlocks] = useState<Array<{
    id: string;
    titleSnapshot: string;
    unlockedAt: string;
    user: { name: string | null; email: string };
    share: { _count: { clicks: number; attributions: number } } | null;
  }> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const data = await fetchAchievements();
      setDefinitions(data.definitions as Definition[]);
      setPrograms(data.programs as Option[]);
      setLevels(data.levels as Option[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load achievements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchAchievements()
      .then((data) => {
        if (cancelled) return;
        setDefinitions(data.definitions as Definition[]);
        setPrograms(data.programs as Option[]);
        setLevels(data.levels as Option[]);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load achievements.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(definition?: Definition) {
    setNotice("");
    setError("");
    setSelectedUnlocks(null);
    setEditor(definition ? {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      congratulatoryMessage: definition.congratulatoryMessage,
      category: definition.category,
      trigger: definition.trigger,
      conditions: definition.conditions ?? {},
      programId: definition.programId,
      levelId: definition.levelId,
      isRepeatable: definition.isRepeatable,
      rarity: definition.rarity,
      icon: definition.icon,
      isActive: definition.isActive,
    } : { ...emptyEditor });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...editor,
        conditions: conditionsFor(editor.trigger, editor.conditions),
      };
      const response = await fetch(
        editor.id
          ? `/api/admin/internship/achievements/${editor.id}`
          : "/api/admin/internship/achievements",
        {
          method: editor.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save achievement.");
      setEditor(null);
      setNotice("Achievement saved. Previously earned awards remain unchanged.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save achievement.");
    } finally {
      setSaving(false);
    }
  }

  async function viewUnlocks(id: string) {
    setError("");
    try {
      const response = await fetch(`/api/admin/internship/achievements/${id}/unlocks`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load award history.");
      setSelectedUnlocks(data.unlocks);
      setEditor(null);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Unable to load award history.");
    }
  }

  const inputClass = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#1C1D52] outline-none focus:border-[#5FBB46] focus:ring-2 focus:ring-[#5FBB46]/20";
  const labelClass = "block text-xs font-semibold text-slate-700";

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5FBB46]">Internship operations</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1C1D52] sm:text-3xl">Achievements</h1>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            Configure server-verified achievement rules and review awards and referral performance. Rules use supported event types and structured conditions, never executable expressions.
          </p>
        </div>
        <button type="button" onClick={() => edit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1D52] px-4 py-3 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> New achievement
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">{notice}</p>}

      {editor && (
        <form onSubmit={save} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-[#1C1D52]">{editor.id ? "Edit achievement" : "Create achievement"}</h2>
            <button type="button" onClick={() => setEditor(null)} aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Achievement title<input required maxLength={100} value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} placeholder="Wizard of {track}" className={inputClass} /><span className="mt-1 block font-normal text-slate-500">{"{track}"} and {"{level}"} become the intern&apos;s track and level, e.g. “Wizard of {"{track}"}” → “Wizard of Digital Marketing”.</span></label>
            <label className={labelClass}>Category / field<input required maxLength={80} value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} placeholder="Digital Marketing, Front-End Development..." className={inputClass} /></label>
            <label className={labelClass}>Description<textarea required maxLength={500} rows={2} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Congratulatory message<textarea required maxLength={240} rows={2} value={editor.congratulatoryMessage} onChange={(event) => setEditor({ ...editor, congratulatoryMessage: event.target.value })} className={inputClass} /></label>
            <label className={labelClass}>Trigger<select value={editor.trigger} onChange={(event) => setEditor({ ...editor, trigger: event.target.value as Trigger, conditions: {} })} className={inputClass}>{ACHIEVEMENT_TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{TRIGGER_LABELS[trigger]}</option>)}</select></label>
            <label className={labelClass}>Rarity<select value={editor.rarity} onChange={(event) => setEditor({ ...editor, rarity: event.target.value as Rarity })} className={inputClass}>{ACHIEVEMENT_RARITIES.map((rarity) => <option key={rarity}>{rarity}</option>)}</select></label>
            <label className={labelClass}>Internship track (optional)<select value={editor.programId ?? ""} onChange={(event) => setEditor({ ...editor, programId: event.target.value || null })} className={inputClass}><option value="">All tracks</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
            <label className={labelClass}>Internship level (optional)<select value={editor.levelId ?? ""} onChange={(event) => setEditor({ ...editor, levelId: event.target.value || null })} className={inputClass}><option value="">All levels</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
            {(editor.trigger === "TASK_ACCEPTED" || editor.trigger === "PERFECT_SCORE" || editor.trigger === "SCORE_THRESHOLD") && <label className={labelClass}>Task title contains (optional)<input maxLength={100} value={editor.conditions.taskTitleContains ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, taskTitleContains: event.target.value || undefined } })} placeholder="Meta Ads campaign" className={inputClass} /></label>}
            {editor.trigger === "SCORE_THRESHOLD" && <label className={labelClass}>Minimum score (%)<input required type="number" min={1} max={100} value={editor.conditions.minPercent ?? 90} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, minPercent: Number(event.target.value) } })} className={inputClass} /></label>}
            {editor.trigger === "WEEK_COMPLETE" && <label className={labelClass}>Week number (optional)<input type="number" min={1} max={52} value={editor.conditions.weekNumber ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, weekNumber: event.target.value ? Number(event.target.value) : undefined } })} className={inputClass} /></label>}
            {editor.trigger === "TASK_SUBMITTED" && <label className={labelClass}>Tasks submitted (optional)<input type="number" min={1} max={1000} value={editor.conditions.minCount ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, minCount: event.target.value === "" ? undefined : Number(event.target.value) } })} placeholder="1 = first submission" className={inputClass} /><span className="mt-1 block font-normal text-slate-500">With “Repeat” on, it fires every time this many more are submitted (5, 10, 15…).</span></label>}
            {editor.trigger === "TASK_COUNT" && <label className={labelClass}>Minimum accepted tasks<input required type="number" min={1} max={1000} value={editor.conditions.minCount ?? 5} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, minCount: Number(event.target.value) } })} className={inputClass} /></label>}
            {editor.trigger === "OFFICE_LIFE_STEP" && <label className={labelClass}>Office Life step<select value={editor.conditions.stepKind ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, stepKind: (event.target.value || undefined) as OfficeLifeStepKind | undefined } })} className={inputClass}><option value="">Any step</option>{OFFICE_LIFE_STEP_KINDS.map((kind) => <option key={kind} value={kind}>{STEP_KIND_LABELS[kind]}</option>)}</select></label>}
            {editor.trigger === "PRACTICE_LAB_COMPLETE" && <label className={labelClass}>Minimum lab score % (optional)<input type="number" min={1} max={100} value={editor.conditions.minPercent ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, minPercent: event.target.value === "" ? undefined : Number(event.target.value) } })} className={inputClass} /></label>}
            {(editor.trigger === "OFFICE_LIFE_COMPLETE" || editor.trigger === "OFFICE_LIFE_STEP") && <label className={labelClass}>Minimum Office Life score (optional)<input type="number" min={0} max={100} value={editor.conditions.minScore ?? ""} onChange={(event) => setEditor({ ...editor, conditions: { ...editor.conditions, minScore: event.target.value === "" ? undefined : Number(event.target.value) } })} className={inputClass} /></label>}
            <label className={labelClass}>Badge<select value={editor.icon} onChange={(event) => setEditor({ ...editor, icon: event.target.value })} className={inputClass}>{Object.entries(BADGE_EMOJI).map(([key, emoji]) => <option key={key} value={key}>{emoji} {key}</option>)}{!(editor.icon in BADGE_EMOJI) && <option value={editor.icon}>🏅 {editor.icon}</option>}</select></label>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-slate-700">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editor.isRepeatable} onChange={(event) => setEditor({ ...editor, isRepeatable: event.target.checked })} /> Repeat for each qualifying accomplishment</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={editor.isActive} onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })} /> Active</label>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Preview</p>
            <p className="mt-2 text-lg font-black text-[#1C1D52]">{editor.title || "Achievement title"}</p>
            <p className="mt-1 text-xs text-slate-600">{editor.description || "The accomplishment shown on the award card."}</p>
            <p className="mt-2 text-xs text-[#36752b]">{editor.congratulatoryMessage || "A message shown when the intern unlocks this award."}</p>
            <p className="mt-2 text-[10px] text-slate-500">{TRIGGER_LABELS[editor.trigger]} · {editor.category} · {editor.rarity}</p>
          </div>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#5FBB46] px-4 py-3 text-sm font-bold text-[#14204f] disabled:opacity-60"><Save className="h-4 w-4" />{saving ? "Saving…" : "Save achievement"}</button>
        </form>
      )}

      {selectedUnlocks && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-[#1C1D52]">Award history</h2>
            <button type="button" onClick={() => setSelectedUnlocks(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          {selectedUnlocks.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2">Intern</th><th>Awarded</th><th>Referral clicks</th><th>Registrations</th></tr></thead><tbody>{selectedUnlocks.map((unlock) => <tr key={unlock.id} className="border-t border-slate-100"><td className="py-3"><span className="font-semibold text-[#1C1D52]">{unlock.user.name || "Intern"}</span><span className="ml-2 text-slate-500">{unlock.user.email}</span></td><td>{new Date(unlock.unlockedAt).toLocaleString()}</td><td>{unlock.share?._count.clicks ?? 0}</td><td>{unlock.share?._count.attributions ?? 0}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No interns have unlocked this achievement yet.</p>}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-[#1C1D52]">Configured achievements</h2>
        </div>
        {loading ? <p className="p-6 text-sm text-slate-500">Loading achievements…</p> : definitions.length ? (
          <div className="divide-y divide-slate-100">
            {definitions.map((definition) => (
              <article key={definition.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5FBB46]/15 text-2xl" aria-hidden="true">{badgeEmoji(definition.icon)}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#1C1D52]">{definition.title}</h3><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${definition.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{definition.isActive ? "Active" : "Inactive"}</span></div>
                    <p className="mt-1 text-xs text-slate-600">{definition.description}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{TRIGGER_LABELS[definition.trigger]} · {definition.category} · {definition.program?.name ?? "All tracks"} · {definition.level?.name ?? "All levels"}</p>
                    <p className="mt-2 text-[10px] font-semibold text-slate-500">Unlocks {definition.stats.unlocks} · Shares {definition.stats.shares} · Unique clicks {definition.stats.clicks} · Sign-ups {definition.stats.registrations}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => void viewUnlocks(definition.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#1C1D52]"><Eye className="h-4 w-4" /> Awards</button>
                  <button type="button" onClick={() => edit(definition)} className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-semibold text-white"><Pencil className="h-4 w-4" /> Edit</button>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="p-6 text-sm text-slate-500">No achievement rules yet. Add a definition to start recognizing verified intern outcomes.</p>}
      </section>
    </div>
  );
}
