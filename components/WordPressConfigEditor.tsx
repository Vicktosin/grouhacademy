"use client";

import { Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import WordPressLab from "@/components/WordPressLab";
import {
  CHECK_TYPES,
  newCheckId,
  PHP_VERSIONS,
  safeContentPath,
  type WpCheck,
  type WpCheckType,
  type WpConfig,
} from "@/lib/wp-sim/model";

const input = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-[#1C1D52]";
const code = "w-full rounded-lg border border-slate-200 bg-[#101426] px-3 py-2.5 font-mono text-[11px] leading-5 text-white/90";
const card = "rounded-2xl bg-white p-5 shadow-[0_7px_20px_rgba(28,29,82,0.08)]";

/** Admin settings for a WordPress exercise: the starting site and the checks. */
export default function WordPressConfigEditor({
  config,
  onChange,
}: {
  config: WpConfig;
  onChange: (config: WpConfig) => void;
}) {
  const set = (patch: Partial<WpConfig>) => onChange({ ...config, ...patch });
  const setCheck = (index: number, patch: Partial<WpCheck>) =>
    set({ checks: config.checks.map((check, i) => (i === index ? { ...check, ...patch } : check)) });
  // The test site is built from the settings as they were when it started.
  const [testSite, setTestSite] = useState<{ config: WpConfig; run: number } | null>(null);

  return (
    <>
      <section className={`${card} space-y-4`}>
        <div>
          <h2 className="text-sm font-bold text-[#1C1D52]">The starting site</h2>
          <p className="mt-1 text-xs text-slate-500">
            Every intern gets a real WordPress site in their browser, set up like this. It&apos;s saved in their browser,
            so it costs no storage here.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Labelled label="WordPress version">
            <input
              value={config.wpVersion}
              onChange={(e) => set({ wpVersion: e.target.value })}
              placeholder="latest, or e.g. 6.8"
              className={input}
            />
          </Labelled>
          <Labelled label="PHP version">
            <select value={config.phpVersion} onChange={(e) => set({ phpVersion: e.target.value })} className={`${input} bg-white`}>
              {PHP_VERSIONS.map((version) => (
                <option key={version} value={version}>
                  PHP {version}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Opens on">
            <input
              value={config.landingPage}
              onChange={(e) => set({ landingPage: e.target.value })}
              placeholder="/wp-admin/"
              className={input}
            />
          </Labelled>
          <Labelled label="Theme from wordpress.org (slug, optional)">
            <input
              value={config.theme}
              onChange={(e) => set({ theme: e.target.value })}
              placeholder="e.g. astra (empty: WordPress's default)"
              className={input}
            />
          </Labelled>
          <div className="md:col-span-2">
            <Labelled label="Plugins from wordpress.org (slugs, comma separated)">
              <input
                value={config.plugins.join(", ")}
                onChange={(e) =>
                  set({
                    plugins: e.target.value
                      .split(",")
                      .map((slug) => slug.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g. woocommerce, contact-form-7"
                className={input}
              />
            </Labelled>
          </div>
        </div>
        <Labelled label="Setup PHP (runs once on a fresh site, WordPress loaded; optional)">
          <textarea
            value={config.setupPhp}
            rows={6}
            onChange={(e) => set({ setupPhp: e.target.value })}
            placeholder={`<?php\nrequire '/wordpress/wp-load.php';\nwp_insert_post(['post_title' => 'Welcome', 'post_status' => 'publish']);`}
            className={code}
            spellCheck={false}
          />
        </Labelled>
        <StarterFiles files={config.files} onChange={(files) => set({ files })} />
      </section>

      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">Checks</h2>
            <p className="mt-1 text-xs text-slate-500">
              They run inside the intern&apos;s site, so they see what WordPress sees. Interns see each label.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              set({
                checks: [...config.checks, { id: newCheckId(), label: CHECK_TYPES.option.label, type: "option", params: {} }],
              })
            }
            className="inline-flex items-center gap-1 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add check
          </button>
        </div>
        {config.checks.length === 0 && <p className="text-xs text-slate-500">No checks yet.</p>}
        <ol className="space-y-3">
          {config.checks.map((check, index) => (
            <li key={check.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
                <Labelled label={`Check ${index + 1}: what interns see`}>
                  <input value={check.label} onChange={(e) => setCheck(index, { label: e.target.value })} className={input} />
                </Labelled>
                <Labelled label="Type">
                  <select
                    value={check.type}
                    onChange={(e) => {
                      const type = e.target.value as WpCheckType;
                      // A label still at the old type's default follows the new type.
                      const label = check.label === CHECK_TYPES[check.type].label ? CHECK_TYPES[type].label : check.label;
                      setCheck(index, { type, label, params: {} });
                    }}
                    className={`${input} bg-white`}
                  >
                    {(Object.keys(CHECK_TYPES) as WpCheckType[]).map((type) => (
                      <option key={type} value={type}>
                        {CHECK_TYPES[type].label}
                      </option>
                    ))}
                  </select>
                </Labelled>
                <button
                  type="button"
                  onClick={() => set({ checks: config.checks.filter((_, i) => i !== index) })}
                  className="self-end rounded-lg p-2.5 text-red-600 hover:bg-red-50"
                  aria-label="Remove check"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {CHECK_TYPES[check.type].fields.map((field) => (
                  <div key={field.key} className={field.multiline ? "md:col-span-2" : ""}>
                    <Labelled label={field.label}>
                      {field.multiline ? (
                        <textarea
                          value={check.params[field.key] ?? ""}
                          rows={4}
                          onChange={(e) => setCheck(index, { params: { ...check.params, [field.key]: e.target.value } })}
                          placeholder={field.placeholder}
                          className={code}
                          spellCheck={false}
                        />
                      ) : (
                        <input
                          value={check.params[field.key] ?? ""}
                          onChange={(e) => setCheck(index, { params: { ...check.params, [field.key]: e.target.value } })}
                          placeholder={field.placeholder}
                          className={input}
                        />
                      )}
                    </Labelled>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${card} space-y-3`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1C1D52]">Try it</h2>
            <p className="mt-1 text-xs text-slate-500">
              Start a test site exactly as interns will get it, do the exercise, and run the checks. Check changes apply
              straight away; restart for changes to the starting site. Nothing is saved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTestSite((current) => ({ config, run: (current?.run ?? 0) + 1 }))}
            className="inline-flex items-center gap-1 rounded-lg bg-[#5FBB46] px-3 py-2 text-xs font-bold text-[#14204f]"
          >
            {testSite ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {testSite ? "Restart with these settings" : "Start a test site"}
          </button>
        </div>
        {testSite && (
          <WordPressLab
            key={testSite.run}
            // The site as it started, with the checks as they are now.
            config={{ ...testSite.config, checks: config.checks }}
            storageKey={null}
          />
        )}
      </section>
    </>
  );
}

/** Theme and plugin files written into wp-content before the intern starts. */
function StarterFiles({ files, onChange }: { files: Record<string, string>; onChange: (files: Record<string, string>) => void }) {
  const entries = Object.entries(files);
  const rename = (from: string, to: string) =>
    onChange(Object.fromEntries(entries.map(([path, contents]) => [path === from ? to : path, contents])));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Starter files in wp-content (optional)</p>
        <button
          type="button"
          onClick={() => {
            const path = safeContentPath(window.prompt("Path inside wp-content, e.g. themes/my-theme/style.css") ?? "");
            if (path && !(path in files)) onChange({ ...files, [path]: "" });
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add file
        </button>
      </div>
      {entries.map(([path, contents]) => (
        <div key={path} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">wp-content/</span>
            <input
              defaultValue={path}
              onBlur={(e) => {
                const next = safeContentPath(e.target.value);
                if (next && next !== path && !(next in files)) rename(path, next);
                else e.target.value = path;
              }}
              className="flex-1 rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-[#1C1D52]"
            />
            <button
              type="button"
              onClick={() => onChange(Object.fromEntries(entries.filter(([p]) => p !== path)))}
              className="rounded p-1 text-red-600 hover:bg-red-50"
              aria-label={`Remove ${path}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={contents}
            rows={6}
            onChange={(e) => onChange({ ...files, [path]: e.target.value })}
            className={code}
            spellCheck={false}
          />
        </div>
      ))}
    </div>
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
