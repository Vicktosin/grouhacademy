"use client";

import { Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import ContentSimulator from "@/components/ContentSimulator";
import {
  blankWork,
  CONTENT_MODES,
  DEFAULT_CONTENT_CONFIGS,
  ERROR_KINDS,
  newId,
  normalize,
  publicContentConfig,
  RULE_TYPES,
  type ContentConfig,
  type ContentMode,
  type ContentPiece,
  type ContentRun,
  type ContentWork,
  type ErrorKind,
  type RuleType,
} from "@/lib/content-sim/model";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52]";
const card = "rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]";

/** Admin settings for an AI content exercise. */
export default function ContentConfigEditor({
  config,
  onChange,
}: {
  config: ContentConfig;
  onChange: (config: ContentConfig) => void;
}) {
  const set = (patch: Partial<ContentConfig>) => onChange({ ...config, ...patch });
  const setPiece = (index: number, patch: Partial<ContentPiece>) =>
    set({ pieces: config.pieces.map((piece, i) => (i === index ? { ...piece, ...patch } : piece)) });

  return (
    <>
      <section className={`${card} space-y-4`}>
        <div className="grid gap-4 md:grid-cols-3">
          <Labelled label="Type of exercise">
            <select
              value={config.mode}
              onChange={(e) => {
                const mode = e.target.value as ContentMode;
                if (window.confirm(`Switch to ${CONTENT_MODES[mode].label}? This loads its example settings in place of these.`))
                  onChange(DEFAULT_CONTENT_CONFIGS[mode]);
              }}
              className={`${input} bg-white`}
            >
              {(Object.keys(CONTENT_MODES) as ContentMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {CONTENT_MODES[mode].label}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Runs each intern gets">
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxRuns}
              onChange={(e) => set({ maxRuns: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
              className={input}
            />
          </Labelled>
          <p className="self-end text-xs text-slate-500">
            {CONTENT_MODES[config.mode].help} Each run uses {config.mode === "PROMPT" ? "one AI call per piece, plus one to judge" : "one AI call"}.
          </p>
        </div>
      </section>

      <section className={`${card} space-y-4`}>
        <h2 className="text-sm font-bold text-[#1C1D52]">The client</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Labelled label="Client name">
            <input value={config.client.name} onChange={(e) => set({ client: { ...config.client, name: e.target.value } })} className={input} />
          </Labelled>
          <Labelled label="Audience">
            <input
              value={config.client.audience}
              onChange={(e) => set({ client: { ...config.client, audience: e.target.value } })}
              className={input}
            />
          </Labelled>
          <div className="md:col-span-2">
            <Labelled label="About the client (products, prices, contact details: the facts interns can use)">
              <textarea
                value={config.client.about}
                rows={4}
                onChange={(e) => set({ client: { ...config.client, about: e.target.value } })}
                className={input}
              />
            </Labelled>
          </div>
          <div className="md:col-span-2">
            <Labelled label="Brand voice">
              <input
                value={config.client.voice}
                onChange={(e) => set({ client: { ...config.client, voice: e.target.value } })}
                className={input}
              />
            </Labelled>
          </div>
        </div>
      </section>

      {config.mode === "FACTCHECK" ? (
        <FactCheckSettings config={config} set={set} />
      ) : (
        <>
          <section className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#1C1D52]">What to write</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {config.mode === "PROMPT"
                    ? "Interns write a prompt for each piece; the AI's output is checked by these rules."
                    : "Interns write each piece; it's checked by these rules as they type."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  set({ pieces: [...config.pieces, { id: newId(), label: `Piece ${config.pieces.length + 1}`, instructions: "", rules: [] }] })
                }
                className="inline-flex items-center gap-1 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add piece
              </button>
            </div>
            {config.pieces.map((piece, index) => (
              <div key={piece.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Labelled label="Name">
                      <input value={piece.label} onChange={(e) => setPiece(index, { label: e.target.value })} className={input} />
                    </Labelled>
                  </div>
                  <button
                    type="button"
                    onClick={() => set({ pieces: config.pieces.filter((_, i) => i !== index) })}
                    className="rounded-lg p-2.5 text-red-600 hover:bg-red-50"
                    aria-label="Remove piece"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Labelled label="What it must do (interns see this)">
                  <textarea
                    value={piece.instructions}
                    rows={3}
                    onChange={(e) => setPiece(index, { instructions: e.target.value })}
                    className={input}
                  />
                </Labelled>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Automatic rules</p>
                  {piece.rules.map((rule, ruleIndex) => (
                    <div key={rule.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f8fbff] p-2">
                      <select
                        value={rule.type}
                        onChange={(e) =>
                          setPiece(index, {
                            rules: piece.rules.map((r, i) => (i === ruleIndex ? { ...r, type: e.target.value as RuleType, params: {} } : r)),
                          })
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-[#1C1D52]"
                      >
                        {(Object.keys(RULE_TYPES) as RuleType[]).map((type) => (
                          <option key={type} value={type}>
                            {RULE_TYPES[type].label}
                          </option>
                        ))}
                      </select>
                      {RULE_TYPES[rule.type].fields.map((field) => (
                        <label key={field.key} className="min-w-32 flex-1 space-y-0.5">
                          <span className="text-[10px] text-slate-500">{field.label}</span>
                          <input
                            value={rule.params[field.key] ?? ""}
                            placeholder={field.placeholder}
                            onChange={(e) =>
                              setPiece(index, {
                                rules: piece.rules.map((r, i) =>
                                  i === ruleIndex ? { ...r, params: { ...r.params, [field.key]: e.target.value } } : r,
                                ),
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-[#1C1D52]"
                          />
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPiece(index, { rules: piece.rules.filter((_, i) => i !== ruleIndex) })}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        aria-label="Remove rule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPiece(index, { rules: [...piece.rules, { id: newId(), type: "words", params: {} }] })}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add rule
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className={`${card} space-y-2`}>
            <h2 className="text-sm font-bold text-[#1C1D52]">What the AI judge scores (0-10 each, every piece)</h2>
            {config.rubric.map((criterion, index) => (
              <div key={index} className="flex gap-2">
                <input
                  value={criterion}
                  onChange={(e) => set({ rubric: config.rubric.map((c, i) => (i === index ? e.target.value : c)) })}
                  className={input}
                />
                <button
                  type="button"
                  onClick={() => set({ rubric: config.rubric.filter((_, i) => i !== index) })}
                  className="rounded-lg p-2.5 text-red-600 hover:bg-red-50"
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {config.rubric.length < 8 && (
              <button
                type="button"
                onClick={() => set({ rubric: [...config.rubric, ""] })}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add criterion
              </button>
            )}
          </section>
        </>
      )}

      <TryIt config={config} />
    </>
  );
}

function FactCheckSettings({ config, set }: { config: ContentConfig; set: (patch: Partial<ContentConfig>) => void }) {
  const draft = normalize(config.draft);
  return (
    <section className={`${card} space-y-4`}>
      <h2 className="text-sm font-bold text-[#1C1D52]">The draft and its errors</h2>
      <Labelled label="The client's notes (the facts interns check against)">
        <textarea value={config.reference} rows={6} onChange={(e) => set({ reference: e.target.value })} className={input} />
      </Labelled>
      <Labelled label="The AI-written draft, errors included">
        <textarea value={config.draft} rows={10} onChange={(e) => set({ draft: e.target.value })} className={input} />
      </Labelled>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
          Planted errors (hidden from interns; an error counts as fixed when its words are no longer in their draft)
        </p>
        {config.errors.map((error, index) => {
          const found = error.find.trim() && draft.includes(normalize(error.find));
          const update = (patch: Partial<typeof error>) =>
            set({ errors: config.errors.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
          return (
            <div key={error.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-48 flex-[2] space-y-0.5">
                  <span className="text-[10px] text-slate-500">The wrong words, exactly as in the draft</span>
                  <input value={error.find} onChange={(e) => update({ find: e.target.value })} className={input} />
                </label>
                <label className="min-w-40 flex-1 space-y-0.5">
                  <span className="text-[10px] text-slate-500">Kind</span>
                  <select
                    value={error.kind}
                    onChange={(e) => update({ kind: e.target.value as ErrorKind })}
                    className={`${input} bg-white`}
                  >
                    {(Object.keys(ERROR_KINDS) as ErrorKind[]).map((kind) => (
                      <option key={kind} value={kind}>
                        {ERROR_KINDS[kind]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => set({ errors: config.errors.filter((_, i) => i !== index) })}
                  className="rounded-lg p-2.5 text-red-600 hover:bg-red-50"
                  aria-label="Remove error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className={`text-[11px] ${found ? "text-[#397d3a]" : "text-red-600"}`}>
                {found ? "✓ Found in the draft" : "✗ Not found in the draft word for word"}
              </p>
              <label className="block space-y-0.5">
                <span className="text-[10px] text-slate-500">Why it&apos;s wrong and what&apos;s right (shown once they fix it)</span>
                <input value={error.why} onChange={(e) => update({ why: e.target.value })} className={input} />
              </label>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => set({ errors: [...config.errors, { id: newId(), find: "", kind: "FACT", why: "" }] })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add error
        </button>
      </div>
    </section>
  );
}

/** Try the exercise as an intern would, with the settings as edited. Nothing is saved. */
function TryIt({ config }: { config: ContentConfig }) {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState<ContentWork | null>(null);
  const [runs, setRuns] = useState<ContentRun[]>([]);
  const current = work ?? blankWork(config);
  return (
    <section className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#1C1D52]">Try it</h2>
          <p className="mt-1 text-xs text-slate-500">Do the exercise as an intern would. Test runs use the AI but aren&apos;t saved.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setWork(null);
            setRuns([]);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-2 text-xs font-bold text-[#14204f]"
        >
          <Play className="h-3.5 w-3.5" /> {open ? "Start again" : "Try it"}
        </button>
      </div>
      {open && (
        <ContentSimulator
          config={{ ...publicContentConfig(config), maxRuns: 99 }}
          work={current}
          onWorkChange={setWork}
          runs={runs}
          aiEnabled
          runLabel="Test runs aren't counted"
          onRun={async (next) => {
            const response = await fetch("/api/admin/internship/lab/test-run", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "CONTENT", config, work: next }),
            }).catch(() => null);
            const body = await response?.json().catch(() => ({}));
            if (!response?.ok) return body?.error ?? "Unable to run.";
            setRuns((existing) => [...existing, body.run]);
            return null;
          }}
        />
      )}
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
