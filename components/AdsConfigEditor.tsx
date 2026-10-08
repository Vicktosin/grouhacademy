"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import AdsSimulator, { type SimRun } from "@/components/AdsSimulator";
import {
  BLANK_CAMPAIGN,
  GOAL_METRICS,
  INDUSTRY_PRESETS,
  INTERESTS,
  LOCATIONS,
  type AdsConfig,
  type Campaign,
  type Gender,
  type GoalMetric,
} from "@/lib/ads-sim/model";

// Admin settings for an Ad Campaign Simulator exercise (the client, the
// hidden "right answer" audience, market prices and goals), plus a test run
// to try the exercise as an intern would before publishing.

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]";

export default function AdsConfigEditor({
  config,
  onChange,
  mediaEnabled = false,
}: {
  config: AdsConfig;
  onChange: (config: AdsConfig) => void;
  /** Whether image uploads work (file storage is set up). */
  mediaEnabled?: boolean;
}) {
  const set = (patch: Partial<AdsConfig>) => onChange({ ...config, ...patch });
  const ideal = config.idealAudience;
  const setIdeal = (patch: Partial<AdsConfig["idealAudience"]>) =>
    set({ idealAudience: { ...ideal, ...patch } });
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  const preset = Object.entries(INDUSTRY_PRESETS).find(
    ([, value]) =>
      value.cpm === config.benchmarks.cpm &&
      value.ctr === config.benchmarks.ctr &&
      value.cvr === config.benchmarks.cvr,
  )?.[0];

  return (
    <div className="space-y-5">
      <Card
        title="The client"
        help="Who the intern is advertising for. Interns see all of this."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Business name">
            <input
              value={config.business.name}
              onChange={(e) =>
                set({ business: { ...config.business, name: e.target.value } })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Conversion counts as">
            <select
              value={config.conversionEvent}
              onChange={(e) =>
                set({ conversionEvent: e.target.value as "SALES" | "LEADS" })
              }
              className={inputClass}
            >
              <option value="SALES">A sale</option>
              <option value="LEADS">A lead (sign-up, enquiry)</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="About the business">
              <textarea
                rows={3}
                value={config.business.description}
                onChange={(e) =>
                  set({
                    business: {
                      ...config.business,
                      description: e.target.value,
                    },
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Product or offer">
            <input
              value={config.product.name}
              onChange={(e) =>
                set({ product: { ...config.product, name: e.target.value } })
              }
              className={inputClass}
            />
          </Field>
          <Field
            label={
              config.conversionEvent === "SALES"
                ? "Price per sale (₦)"
                : "Value of one lead (₦)"
            }
          >
            <input
              type="number"
              min={0}
              value={config.product.price}
              onChange={(e) =>
                set({
                  product: { ...config.product, price: Number(e.target.value) },
                })
              }
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Product details">
              <input
                value={config.product.description}
                onChange={(e) =>
                  set({
                    product: {
                      ...config.product,
                      description: e.target.value,
                    },
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="Ideal audience (hidden from interns)"
        help="The people most likely to buy. The closer an intern's targeting is to this, the better their results."
      >
        <div className="space-y-4">
          <div>
            <Small>Locations</Small>
            <Chips
              options={LOCATIONS.map((l) => ({ id: l.id, label: l.name }))}
              selected={ideal.locations}
              onToggle={(id) =>
                setIdeal({ locations: toggle(ideal.locations, id) })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Age from">
              <input
                type="number"
                min={13}
                max={65}
                value={ideal.ageMin}
                onChange={(e) => setIdeal({ ageMin: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Age to">
              <input
                type="number"
                min={13}
                max={65}
                value={ideal.ageMax}
                onChange={(e) => setIdeal({ ageMax: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Gender">
              <select
                value={ideal.gender}
                onChange={(e) => setIdeal({ gender: e.target.value as Gender })}
                className={inputClass}
              >
                <option value="ALL">Everyone</option>
                <option value="WOMEN">Women</option>
                <option value="MEN">Men</option>
              </select>
            </Field>
          </div>
          <div>
            <Small>Interests</Small>
            <Chips
              options={INTERESTS.map((i) => ({ id: i, label: i }))}
              selected={ideal.interests}
              onToggle={(id) =>
                setIdeal({ interests: toggle(ideal.interests, id) })
              }
            />
          </div>
        </div>
      </Card>

      <Card
        title="Market prices (hidden from interns)"
        help="Typical results for this industry with an average ad. Pick a preset or fine-tune."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Industry preset">
            <select
              value={preset ?? ""}
              onChange={(e) =>
                e.target.value &&
                set({ benchmarks: INDUSTRY_PRESETS[e.target.value] })
              }
              className={inputClass}
            >
              <option value="">Custom</option>
              {Object.keys(INDUSTRY_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cost per 1,000 views (₦)">
            <input
              type="number"
              min={50}
              value={config.benchmarks.cpm}
              onChange={(e) =>
                set({
                  benchmarks: {
                    ...config.benchmarks,
                    cpm: Number(e.target.value),
                  },
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Click-through rate (%)">
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={config.benchmarks.ctr}
              onChange={(e) =>
                set({
                  benchmarks: {
                    ...config.benchmarks,
                    ctr: Number(e.target.value),
                  },
                })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Clicks that convert (%)">
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={config.benchmarks.cvr}
              onChange={(e) =>
                set({
                  benchmarks: {
                    ...config.benchmarks,
                    cvr: Number(e.target.value),
                  },
                })
              }
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Goals and limits"
        help="What a successful campaign must achieve. Interns see the goals and get partial credit for getting close."
      >
        <ul className="space-y-2">
          {config.goals.map((goal, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={goal.metric}
                onChange={(e) =>
                  set({
                    goals: config.goals.map((g, i) =>
                      i === index
                        ? { ...g, metric: e.target.value as GoalMetric }
                        : g,
                    ),
                  })
                }
                className={`${inputClass} max-w-[240px]`}
              >
                {(Object.keys(GOAL_METRICS) as GoalMetric[]).map((metric) => (
                  <option key={metric} value={metric}>
                    {GOAL_METRICS[metric].label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                {GOAL_METRICS[goal.metric].op === "gte"
                  ? "at least"
                  : "at most"}
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={goal.value}
                onChange={(e) =>
                  set({
                    goals: config.goals.map((g, i) =>
                      i === index ? { ...g, value: Number(e.target.value) } : g,
                    ),
                  })
                }
                className={`${inputClass} max-w-[140px]`}
              />
              <span className="text-[10px] text-slate-400">
                {
                  {
                    count: "",
                    naira: "₦",
                    ratio: "× spend",
                    percent: "%",
                  }[GOAL_METRICS[goal.metric].unit]
                }
              </span>
              <button
                type="button"
                aria-label="Remove goal"
                onClick={() =>
                  set({ goals: config.goals.filter((_, i) => i !== index) })
                }
                className="rounded p-1.5 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            set({ goals: [...config.goals, { metric: "CLICKS", value: 500 }] })
          }
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]"
        >
          <Plus className="h-3 w-3" /> Add goal
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Total budget limit (₦)">
            <input
              type="number"
              min={1000}
              value={config.maxTotalBudget}
              onChange={(e) => set({ maxTotalBudget: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Runs allowed per intern">
            <input
              type="number"
              min={1}
              max={20}
              value={config.maxRuns}
              onChange={(e) => set({ maxRuns: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <TestRun config={config} mediaEnabled={mediaEnabled} />
    </div>
  );
}

/** Try the exercise as an intern; nothing is saved and runs are unlimited. */
function TestRun({ config, mediaEnabled }: { config: AdsConfig; mediaEnabled: boolean }) {
  const [campaign, setCampaign] = useState<Campaign>({
    ...BLANK_CAMPAIGN,
    name: "Test campaign",
  });
  const [runs, setRuns] = useState<SimRun[]>([]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[#1C1D52]">Test run</h2>
        <p className="text-[10px] leading-4 text-slate-500">
          Try the exercise with your current settings (no need to save first).
          Nothing here is stored, and runs are unlimited. A good plan should
          meet the goals; a careless one shouldn&apos;t.
        </p>
      </div>
      <AdsSimulator
        mediaEnabled={mediaEnabled}
        config={config}
        campaign={campaign}
        onCampaignChange={setCampaign}
        runs={runs}
        onRun={async (plan) => {
          const response = await fetch("/api/admin/internship/lab/test-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ config, campaign: plan }),
          }).catch(() => null);
          const body = await response?.json().catch(() => ({}));
          if (!response?.ok) return body?.error ?? "Unable to run.";
          setRuns((current) => [...current, body.run as SimRun]);
          return null;
        }}
      />
    </section>
  );
}

function Card({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]">
      <h2 className="text-sm font-bold text-[#1C1D52]">{title}</h2>
      <p className="mb-4 text-[10px] leading-4 text-slate-500">{help}</p>
      {children}
    </section>
  );
}

function Small({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
      {children}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <Small>{label}</Small>
      {children}
    </label>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onToggle(option.id)}
          className={`rounded-full border px-2.5 py-1 text-[11px] ${selected.includes(option.id) ? "border-[#5FBB46] bg-[#f4faf2] font-semibold text-[#1C1D52]" : "border-slate-200 text-slate-600"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
