"use client";

import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { php } from "@codemirror/lang-php";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FilePlus2,
  FileCode2,
  Folder,
  Gauge,
  Globe,
  LayoutDashboard,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Send,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  blueprintFor,
  checksScript,
  pageHtmlPasses,
  parseChecksOutput,
  parseSummary,
  safeContentPath,
  SUMMARY_SCRIPT,
  WP_CONTENT,
  type WpCheckResult,
  type WpConfig,
  type WpSiteSummary,
} from "@/lib/wp-sim/model";
import { deleteSite, loadSite, saveSite } from "@/lib/wp-sim/site-store";

// The WordPress workspace: a real WordPress site running in the browser
// (WordPress Playground), a file editor for themes and plugins, the
// exercise's checks and submitting. The site is saved in this browser
// between visits (see lib/wp-sim/site-store). Used by interns and, without
// saving, by admins trying an exercise.

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="p-4 text-xs text-slate-400">Loading editor…</div>,
});

type Client = Awaited<ReturnType<(typeof import("@wp-playground/client"))["startPlaygroundWeb"]>>;
type Status = "starting" | "ready" | "error";
export type WpSubmission = {
  results: WpCheckResult[];
  summary: WpSiteSummary | null;
  /** Files the intern created or edited in the editor (path → contents). */
  files: Record<string, string>;
};

const REMOTE_URL = "https://playground.wordpress.net/remote.html";
/** Save the site this often while the page is open. */
const AUTOSAVE_MS = 3 * 60 * 1000;
const MAX_SUBMITTED_FILE_CHARS = 30_000;

function languageFor(path: string) {
  if (path.endsWith(".css")) return [css()];
  if (path.endsWith(".js") || path.endsWith(".json")) return [javascript()];
  return [php()];
}

export default function WordPressLab({
  config,
  storageKey,
  onSubmit,
  submitLabel = "Submit",
}: {
  config: WpConfig;
  /** Where the site is saved in this browser; null = start fresh each time. */
  storageKey: string | null;
  onSubmit?: (submission: WpSubmission) => Promise<void> | void;
  submitLabel?: string;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const client = useRef<Client | null>(null);
  const booted = useRef(false);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState(config.landingPage);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [results, setResults] = useState<WpCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restarts, setRestarts] = useState(0);
  // The same client as client.current, for rendering.
  const [liveClient, setLiveClient] = useState<Client | null>(null);
  // Files the intern created or saved in the editor, remembered with the
  // site so mentors see them after a reload too.
  const edited = useRef(new Set<string>());
  const filesKey = storageKey ? `grouh-wordpress-lab-files:${storageKey}` : null;
  const rememberFile = useCallback(
    (path: string) => {
      edited.current.add(path);
      if (!filesKey) return;
      try {
        localStorage.setItem(filesKey, JSON.stringify([...edited.current]));
      } catch {
        // Private browsing: forgotten on reload.
      }
    },
    [filesKey],
  );
  useEffect(() => {
    if (!filesKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(filesKey) ?? "[]") as unknown;
      if (Array.isArray(saved)) saved.forEach((path) => typeof path === "string" && edited.current.add(path));
    } catch {
      // Nothing remembered.
    }
  }, [filesKey]);
  // One save at a time (they share a temporary file inside WordPress).
  const saving_ = useRef<Promise<void> | null>(null);
  // Whether the workspace is still on screen (boot results are ignored after).
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Boot WordPress (from the saved site if there is one).
  useEffect(() => {
    if (booted.current || !iframe.current) return;
    booted.current = true;
    (async () => {
      setStatus("starting");
      setError(null);
      try {
        const playground = await import("@wp-playground/client");
        const saved = storageKey ? await loadSite(storageKey) : undefined;
        const started = await playground.startPlaygroundWeb({
          iframe: iframe.current!,
          remoteUrl: REMOTE_URL,
          blueprint: blueprintFor(config, !saved) as Parameters<typeof playground.startPlaygroundWeb>[0]["blueprint"],
        });
        if (!alive.current) return;
        if (saved) {
          await playground.importWordPressFiles(started, {
            wordPressFilesZip: new File([saved.zip as BlobPart], "site.zip"),
          });
          await playground.login(started, { username: "admin", password: "password" });
          await started.goTo(config.landingPage);
          setSavedAt(saved.savedAt);
        }
        await started.onNavigation((url) => {
          try {
            const parsed = new URL(url);
            setAddress(parsed.pathname.replace(/^\/scope:[^/]+/, "") + parsed.search);
          } catch {
            // Not a URL; leave the address as it was.
          }
        });
        client.current = started;
        // The client is a callable proxy: React would call it as an updater.
        setLiveClient(() => started);
        setStatus("ready");
      } catch (bootError) {
        if (!alive.current) return;
        console.error("WordPress failed to start:", bootError);
        // A setup step failing (a plugin that needs a newer PHP, a theme
        // that doesn't exist) is the exercise's fault, not the connection's.
        const message = bootError instanceof Error ? bootError.message : String(bootError);
        setError(
          /blueprint step/i.test(message)
            ? `This exercise's site couldn't be set up: ${message.replace(/^.*?blueprint step #\d+:\s*/i, "")} Please tell your mentor.`
            : "WordPress couldn't start. Check your internet connection and reload the page. (It needs to download about 30 MB the first time.)",
        );
        setStatus("error");
      }
    })();
    // Booting once per workspace (React may run this twice in development).
    // Restarting (reset) re-runs this with a fresh iframe via `restarts`.
  }, [config, storageKey, restarts]);

  const save = useCallback(async () => {
    if (!client.current || !storageKey) return;
    // Already saving: wait for it, then save again so the latest work is in.
    while (saving_.current) await saving_.current;
    const wp = client.current;
    const run = (async () => {
      setSaving(true);
      try {
        const { zipWpContent } = await import("@wp-playground/client");
        await saveSite(storageKey, await zipWpContent(wp));
        setSavedAt(new Date().toISOString());
      } catch (saveError) {
        console.error("Couldn't save the site:", saveError);
      } finally {
        setSaving(false);
      }
    })();
    saving_.current = run;
    await run;
    saving_.current = null;
  }, [storageKey]);

  // Save every few minutes, and when the page is hidden (switching apps).
  useEffect(() => {
    if (status !== "ready" || !storageKey) return;
    const timer = window.setInterval(() => void save(), AUTOSAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [status, storageKey, save]);

  const runChecks = useCallback(async (): Promise<WpCheckResult[]> => {
    const wp = client.current;
    if (!wp) return [];
    const response = await wp.run({ code: checksScript(config.checks) });
    const phpResults = parseChecksOutput(response.text, config.checks);
    const pageResults = await Promise.all(
      config.checks
        .filter((check) => check.type === "page_html")
        .map(async (check) => {
          try {
            const page = await wp.request({ url: check.params.path || "/" });
            const passed = page.httpStatusCode < 400 && pageHtmlPasses(page.text, check.params.contains ?? "");
            return { label: check.label, passed, detail: `Status ${page.httpStatusCode}` };
          } catch {
            return { label: check.label, passed: false, detail: "The page couldn't be loaded." };
          }
        }),
    );
    // In the exercise's order.
    const byLabel = new Map([...phpResults, ...pageResults].map((r) => [r.label, r]));
    return config.checks.map((check) => byLabel.get(check.label)!).filter(Boolean);
  }, [config.checks]);

  const check = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      setResults(await runChecks());
    } catch (runError) {
      console.error("The checks couldn't run:", runError);
      setCheckError("The checks couldn't run just now. Try again, or reload the page if it keeps happening.");
    } finally {
      setChecking(false);
    }
    // A natural moment to save: they've just done some work.
    void save();
  };

  const submit = async () => {
    const wp = client.current;
    if (!wp || !onSubmit) return;
    setSubmitting(true);
    setCheckError(null);
    try {
      const latest = await runChecks();
      setResults(latest);
      const summary = parseSummary((await wp.run({ code: SUMMARY_SCRIPT })).text);
      const files: Record<string, string> = {};
      for (const path of edited.current) {
        try {
          files[path] = (await wp.readFileAsText(`${WP_CONTENT}/${path}`)).slice(0, MAX_SUBMITTED_FILE_CHARS);
        } catch {
          // Deleted since.
        }
      }
      await save();
      await onSubmit({ results: latest, summary, files });
    } catch (submitError) {
      console.error("Couldn't submit:", submitError);
      setCheckError("Your site couldn't be checked for submitting. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = async () => {
    if (!window.confirm("Start over with a fresh site? Everything you've built here will be deleted.")) return;
    if (storageKey) await deleteSite(storageKey);
    client.current = null;
    setLiveClient(null);
    booted.current = false;
    edited.current.clear();
    if (filesKey)
      try {
        localStorage.removeItem(filesKey);
      } catch {
        // Nothing to forget.
      }
    setResults(null);
    setSavedAt(null);
    setRestarts((n) => n + 1);
  };

  const download = async () => {
    if (!client.current) return;
    const { zipWpContent } = await import("@wp-playground/client");
    const zip = await zipWpContent(client.current);
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-wordpress-site.zip";
    link.click();
    URL.revokeObjectURL(url);
  };

  const passed = results?.filter((r) => r.passed).length ?? 0;
  const ready = status === "ready";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button type="button" disabled={!ready} onClick={() => void client.current?.goTo("/wp-admin/")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D52] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </button>
        <button type="button" disabled={!ready} onClick={() => void client.current?.goTo("/")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#1C1D52] hover:bg-slate-100 disabled:opacity-50">
          <Globe className="h-3.5 w-3.5" /> View site
        </button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const path = address.startsWith("/") ? address : `/${address}`;
            void client.current?.goTo(path);
          }}
          className="flex min-w-[180px] flex-1"
        >
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            aria-label="Page address"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-[#1C1D52]"
          />
        </form>
        <button type="button" disabled={!ready} onClick={() => setShowFiles((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${showFiles ? "bg-[#e8f7eb] text-[#397d3a]" : "text-[#1C1D52] hover:bg-slate-100"}`}>
          <FileCode2 className="h-3.5 w-3.5" /> Code editor
        </button>
      </div>

      <div className={`grid gap-3 ${showFiles ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
          <iframe
            key={restarts}
            ref={iframe}
            title="Your WordPress site"
            className="h-[620px] w-full bg-white"
          />
          {status !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center">
              {status === "starting" ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-[#5FBB46]" />
                  <p className="text-sm font-semibold text-[#1C1D52]">Starting your WordPress site…</p>
                  <p className="max-w-sm text-xs text-slate-500">
                    The first time takes up to a minute (it downloads WordPress, about 30 MB). After that it&apos;s much faster.
                    Works best on a laptop or desktop.
                  </p>
                </>
              ) : (
                <p className="max-w-sm text-sm text-red-600">{error}</p>
              )}
            </div>
          )}
        </div>
        {showFiles && liveClient && (
          <FileEditor client={liveClient} onSaved={rememberFile} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void check()} disabled={!ready || checking || !config.checks.length} className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {checking ? "Checking…" : "Check my site"}
        </button>
        {onSubmit && (
          <button type="button" onClick={() => void submit()} disabled={!ready || submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Submitting…" : submitLabel}
          </button>
        )}
        {storageKey && (
          <button type="button" onClick={() => void save()} disabled={!ready || saving} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        )}
        <button type="button" onClick={() => void download()} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Download site
        </button>
        <button type="button" onClick={() => void reset()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100">
          <RotateCcw className="h-3.5 w-3.5" /> Reset site
        </button>
        <span className="ml-auto text-[10px] text-slate-400">
          {storageKey
            ? savedAt
              ? `Saved in this browser ${new Date(savedAt).toLocaleTimeString()}`
              : "Your site is saved in this browser automatically"
            : "Test site: not saved"}
        </span>
      </div>

      {checkError && <p className="rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{checkError}</p>}

      {results && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-[#1C1D52]">
            <Gauge className="h-4 w-4 text-[#5FBB46]" /> {passed} of {results.length} checks passed
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {results.map((result) => (
              <li key={result.label} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${result.passed ? "bg-[#e8f7eb] text-[#397d3a]" : "bg-red-50 text-red-700"}`}>
                {result.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>
                  {result.label}
                  {result.detail && <span className="block text-[10px] opacity-75">{result.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <ExternalLink className="h-3 w-3" /> A real WordPress site running in your browser (WordPress Playground). Log in: admin / password.
      </p>
    </div>
  );
}

/** Browse wp-content/themes and wp-content/plugins and edit files. */
function FileEditor({ client, onSaved }: { client: Client; onSaved: (path: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [contents, setContents] = useState("");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const extensions = useMemo(() => (open ? languageFor(open) : [php()]), [open]);

  const openFile = async (path: string) => {
    if (dirty && !window.confirm("Discard your unsaved changes to this file?")) return;
    try {
      setContents(await client.readFileAsText(`${WP_CONTENT}/${path}`));
      setOpen(path);
      setDirty(false);
      setMessage(null);
    } catch {
      setMessage("That file couldn't be opened.");
    }
  };

  const save = async () => {
    if (!open) return;
    await client.writeFile(`${WP_CONTENT}/${open}`, contents);
    onSaved(open);
    setDirty(false);
    setMessage("Saved. Reload the page in WordPress to see the change.");
  };

  const create = async () => {
    const answer = window.prompt("New file, inside wp-content (e.g. plugins/my-plugin/my-plugin.php):", "plugins/my-plugin/my-plugin.php");
    const path = answer ? safeContentPath(answer) : null;
    if (!path) return;
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = `${WP_CONTENT}/${parts.slice(0, i).join("/")}`;
      if (!(await client.fileExists(dir))) await client.mkdir(dir);
    }
    if (!(await client.fileExists(`${WP_CONTENT}/${path}`))) {
      const starter = path.endsWith(".php") ? "<?php\n" : "";
      await client.writeFile(`${WP_CONTENT}/${path}`, starter);
      onSaved(path);
    }
    setTick((n) => n + 1);
    await openFile(path);
  };

  return (
    <div className="flex h-[620px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="w-48 shrink-0 overflow-y-auto border-r border-slate-200 bg-[#f8fbff] p-2 text-[11px]">
        <button type="button" onClick={() => void create()} className="mb-2 inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[#1C1D52] hover:bg-white">
          <FilePlus2 className="h-3.5 w-3.5" /> New file
        </button>
        {["themes", "plugins"].map((root) => (
          <Folder_ key={`${root}-${tick}`} client={client} path={root} name={root} openPath={open} onOpen={openFile} />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-[11px]">
          <span className="truncate font-mono text-slate-600">{open ? `wp-content/${open}` : "Open a file on the left, or create one"}</span>
          {open && (
            <button type="button" onClick={() => void save()} disabled={!dirty} className="ml-auto inline-flex items-center gap-1 rounded-md bg-[#1C1D52] px-2.5 py-1 font-semibold text-white disabled:opacity-40">
              <Save className="h-3 w-3" /> Save file
            </button>
          )}
        </div>
        {message && <p className="border-b border-slate-100 bg-sky-50 px-3 py-1.5 text-[10px] text-sky-800">{message}</p>}
        <div className="min-h-0 flex-1 overflow-auto text-[12px]">
          {open && (
            <CodeMirror
              key={open}
              value={contents}
              height="100%"
              extensions={extensions}
              basicSetup={{ tabSize: 4 }}
              onChange={(value) => {
                setContents(value);
                setDirty(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** One folder in the file tree, loaded when opened. */
function Folder_({
  client,
  path,
  name,
  openPath,
  onOpen,
}: {
  client: Client;
  path: string;
  name: string;
  openPath: string | null;
  onOpen: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<Array<{ name: string; dir: boolean }> | null>(null);

  const toggle = async () => {
    if (!expanded && !entries) {
      const names = await client.listFiles(`${WP_CONTENT}/${path}`).catch(() => [] as string[]);
      const list = await Promise.all(
        names.map(async (entry) => ({ name: entry, dir: await client.isDir(`${WP_CONTENT}/${path}/${entry}`) })),
      );
      setEntries(list.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    }
    setExpanded((v) => !v);
  };

  return (
    <div>
      <button type="button" onClick={() => void toggle()} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[#1C1D52] hover:bg-white">
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Folder className="h-3 w-3 shrink-0 text-amber-500" />
        <span className="truncate">{name}</span>
      </button>
      {expanded && entries && (
        <div className="pl-3">
          {entries.map((entry) =>
            entry.dir ? (
              <Folder_ key={entry.name} client={client} path={`${path}/${entry.name}`} name={entry.name} openPath={openPath} onOpen={onOpen} />
            ) : (
              <button
                key={entry.name}
                type="button"
                onClick={() => onOpen(`${path}/${entry.name}`)}
                className={`block w-full truncate rounded px-1 py-0.5 pl-5 text-left ${openPath === `${path}/${entry.name}` ? "bg-white font-semibold text-[#1C1D52]" : "text-slate-600 hover:bg-white"}`}
              >
                {entry.name}
              </button>
            ),
          )}
          {!entries.length && <p className="pl-5 text-slate-400">(empty)</p>}
        </div>
      )}
    </div>
  );
}
