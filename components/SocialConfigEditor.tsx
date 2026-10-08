"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import SocialSimulator from "@/components/SocialSimulator";
import {
  AUDIENCE_TYPES,
  PLATFORMS,
  publicSocialConfig,
  SOCIAL_GOAL_METRICS,
  type AudienceType,
  type Platform,
  type SocialConfig,
  type SocialGoalMetric,
  type SocialPlan,
} from "@/lib/social-sim/model";
import type { SocialRun } from "@/lib/practice-lab";

// Admin settings for a Social Media Simulator exercise (brand, audience,
// platforms, hidden peak hours and benchmarks, goals), plus a test run.

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-[#1C1D52]";

export default function SocialConfigEditor({
  config,
  onChange,
}: {
  config: SocialConfig;
  onChange: (config: SocialConfig) => void;
}) {
  const set = (patch: Partial<SocialConfig>) => onChange({ ...config, ...patch });
  const number = (value: string) => Number(value);

  return (
    <div className="space-y-5">
      <Card title="The brand" help="Who the intern is posting for. Interns see all of this.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brand name">
            <input value={config.brand.name} onChange={(e) => set({ brand: { ...config.brand, name: e.target.value } })} className={inputClass} />
          </Field>
          <Field label="Brand voice">
            <input value={config.brand.voice} onChange={(e) => set({ brand: { ...config.brand, voice: e.target.value } })} placeholder="e.g. Warm, playful, light Pidgin" className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <Field label="About the brand">
              <textarea rows={3} value={config.brand.description} onChange={(e) => set({ brand: { ...config.brand, description: e.target.value } })} className={inputClass} />
            </Field>
          </div>
          <Field label="Focus this week (product, launch or campaign)">
            <input value={config.product.name} onChange={(e) => set({ product: { ...config.product, name: e.target.value } })} className={inputClass} />
          </Field>
          <Field label="Details">
            <input value={config.product.description} onChange={(e) => set({ product: { ...config.product, description: e.target.value } })} className={inputClass} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Audience (as interns see it)">
              <textarea rows={2} value={config.audience.description} onChange={(e) => set({ audience: { ...config.audience, description: e.target.value } })} className={inputClass} />
            </Field>
          </div>
          <Field label="Followers">
            <input type="number" min={50} value={config.followers} onChange={(e) => set({ followers: number(e.target.value) })} className={inputClass} />
          </Field>
        </div>
        <div className="mt-4">
          <Small>Platforms in this brief</Small>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(PLATFORMS) as Platform[]).map((platform) => (
              <label key={platform} className="inline-flex items-center gap-1.5 text-xs text-[#1C1D52]">
                <input
                  type="checkbox"
                  className="accent-[#5FBB46]"
                  checked={config.platforms.includes(platform)}
                  onChange={() =>
                    set({
                      platforms: config.platforms.includes(platform)
                        ? config.platforms.filter((p) => p !== platform)
                        : [...config.platforms, platform],
                    })
                  }
                />
                {PLATFORMS[platform].label}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Hidden from interns"
        help="The audience type decides when followers are online (peak hours). The benchmarks are what an average post achieves on this account."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Audience type (peak hours)">
            <select value={config.audience.type} onChange={(e) => set({ audience: { ...config.audience, type: e.target.value as AudienceType } })} className={inputClass}>
              {(Object.keys(AUDIENCE_TYPES) as AudienceType[]).map((type) => (
                <option key={type} value={type}>{AUDIENCE_TYPES[type].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Followers reached per post">
            <select value={config.benchmarks.reachRate} onChange={(e) => set({ benchmarks: { ...config.benchmarks, reachRate: number(e.target.value) } })} className={inputClass}>
              {[0.05, 0.1, 0.15, 0.18, 0.25, 0.35].map((rate) => (
                <option key={rate} value={rate}>{Math.round(rate * 100)}%</option>
              ))}
            </select>
          </Field>
          <Field label="Engagement rate (%)">
            <input type="number" min={0.1} step={0.1} value={config.benchmarks.engagementRate} onChange={(e) => set({ benchmarks: { ...config.benchmarks, engagementRate: number(e.target.value) } })} className={inputClass} />
          </Field>
          <Field label="Link click rate (%)">
            <input type="number" min={0} step={0.1} value={config.benchmarks.clickRate} onChange={(e) => set({ benchmarks: { ...config.benchmarks, clickRate: number(e.target.value) } })} className={inputClass} />
          </Field>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Peak hours for “{AUDIENCE_TYPES[config.audience.type].label}” (WAT): weekdays{" "}
          {AUDIENCE_TYPES[config.audience.type].weekday.map(([a, b]) => `${hour(a)}–${hour(b)}`).join(", ")}; weekends{" "}
          {AUDIENCE_TYPES[config.audience.type].weekend.map(([a, b]) => `${hour(a)}–${hour(b)}`).join(", ")}.
        </p>
      </Card>

      <Card title="Goals and limits" help="What a good week achieves. Interns see the goals. Reply quality is scored from their replies to comments.">
        <ul className="space-y-2">
          {config.goals.map((goal, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <select
                value={goal.metric}
                onChange={(e) => set({ goals: config.goals.map((g, i) => (i === index ? { ...g, metric: e.target.value as SocialGoalMetric } : g)) })}
                className={`${inputClass} max-w-[220px]`}
              >
                {(Object.keys(SOCIAL_GOAL_METRICS) as SocialGoalMetric[]).map((metric) => (
                  <option key={metric} value={metric}>{SOCIAL_GOAL_METRICS[metric].label}</option>
                ))}
              </select>
              <span className="text-xs text-slate-500">at least</span>
              <input
                type="number"
                min={0}
                step="any"
                value={goal.value}
                onChange={(e) => set({ goals: config.goals.map((g, i) => (i === index ? { ...g, value: number(e.target.value) } : g)) })}
                className={`${inputClass} max-w-[120px]`}
              />
              <span className="text-[10px] text-slate-400">
                {{ count: "", percent: "%", score: "/ 100" }[SOCIAL_GOAL_METRICS[goal.metric].unit]}
              </span>
              <button type="button" aria-label="Remove goal" onClick={() => set({ goals: config.goals.filter((_, i) => i !== index) })} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => set({ goals: [...config.goals, { metric: "SAVES_SHARES", value: 100 }] })} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1C1D52]">
          <Plus className="h-3 w-3" /> Add goal
        </button>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Fewest posts">
            <input type="number" min={1} max={21} value={config.minPosts} onChange={(e) => set({ minPosts: number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Most posts">
            <input type="number" min={1} max={30} value={config.maxPosts} onChange={(e) => set({ maxPosts: number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Comments per week">
            <input type="number" min={2} max={12} value={config.commentsPerRun} onChange={(e) => set({ commentsPerRun: number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="Runs per intern">
            <input type="number" min={1} max={20} value={config.maxRuns} onChange={(e) => set({ maxRuns: number(e.target.value) })} className={inputClass} />
          </Field>
        </div>
      </Card>

      <TestRun config={config} />
    </div>
  );
}

function hour(value: number) {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Try the exercise as an intern; nothing is saved and runs are unlimited. */
function TestRun({ config }: { config: SocialConfig }) {
  const [plan, setPlan] = useState<SocialPlan>({ posts: [] });
  const [runs, setRuns] = useState<SocialRun[]>([]);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/admin/internship/lab/test-run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "SOCIAL", config, ...body }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    return response?.ok ? { run: result.run as SocialRun } : { error: (result?.error as string) ?? "Unable to run." };
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[#1C1D52]">Test run</h2>
        <p className="text-[10px] leading-4 text-slate-500">
          Try the exercise with your current settings (no need to save first). Nothing here is stored, and runs are unlimited.
        </p>
      </div>
      <SocialSimulator
        config={publicSocialConfig(config)}
        plan={plan}
        onPlanChange={setPlan}
        runs={runs}
        onRun={async (week) => {
          const result = await post({ plan: week });
          if (!result.run) return result.error ?? "Unable to run.";
          setRuns((current) => [...current, result.run]);
          return null;
        }}
        onReply={async (runIndex, replies) => {
          const result = await post({ run: runs[runIndex], replies });
          if (!result.run) return result.error ?? "Unable to run.";
          setRuns((current) => current.map((run, index) => (index === runIndex ? result.run : run)));
          return null;
        }}
      />
    </section>
  );
}

function Card({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
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
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{children}</span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Small>{label}</Small>
      {children}
    </label>
  );
}
