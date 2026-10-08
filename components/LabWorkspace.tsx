"use client";

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import {
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  XCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildPreview,
  LAB_FILES,
  type LabCheck,
  type LabCheckResult,
  type LabFiles,
  type LabKindKey,
} from "@/lib/lab-shared";

// The Practice Lab workspace: file tabs and a code editor, a live preview
// running in the sandboxed /lab-preview page, a console, and the exercise's
// checks. Used by interns and by admins building exercises.

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-slate-400">
      Loading editor…
    </div>
  ),
});

/** Rerun the preview this long after typing stops. */
const AUTO_RUN_MS = 900;
/** Run checks anyway if the preview never reports it has drawn. */
const RENDER_TIMEOUT_MS = 8000;
/** Give up on a check run after this long (plus a little per check). */
const CHECKS_TIMEOUT_MS = 20000;

type ConsoleLine = { level: string; text: string };

function languageFor(fileName: string) {
  if (fileName.endsWith(".html")) return [html()];
  if (fileName.endsWith(".css")) return [css()];
  return [javascript({ jsx: fileName.endsWith(".jsx") })];
}

export default function LabWorkspace({
  kind,
  files,
  onFilesChange,
  checks,
  onChecksResult,
  checksLabel = "Run checks",
  extraActions,
  readOnly = false,
  onSubmit,
  submitLabel = "Submit",
}: {
  kind: LabKindKey;
  files: LabFiles;
  onFilesChange?: (files: LabFiles) => void;
  checks: LabCheck[];
  /** Called with the results each time the checks finish. */
  onChecksResult?: (results: LabCheckResult[]) => void;
  checksLabel?: string;
  /** Buttons shown next to Run. */
  extraActions?: React.ReactNode;
  readOnly?: boolean;
  /**
   * Shows a submit button that reruns the checks on the current code and
   * then hands their results over, so a stale run is never submitted.
   */
  onSubmit?: (results: LabCheckResult[]) => Promise<void> | void;
  submitLabel?: string;
}) {
  const fileNames = LAB_FILES[kind];
  const [activeFile, setActiveFile] = useState(fileNames[0]);
  const [runId, setRunId] = useState(0);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [results, setResults] = useState<LabCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Submit once the run that's starting now has its check results.
  const submitAfterChecks = useRef(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // What the current run should do once the preview has drawn.
  const wantChecks = useRef(false);
  const renderTimer = useRef<number | undefined>(undefined);
  // Whether the current run's preview page has loaded and said hello.
  const previewReady = useRef(false);
  // Latest files/checks for the message handler and editor callbacks.
  const filesRef = useRef(files);
  const checksRef = useRef(checks);
  useLayoutEffect(() => {
    filesRef.current = files;
    checksRef.current = checks;
  }, [files, checks]);

  const run = useCallback((withChecks: boolean) => {
    wantChecks.current = withChecks;
    previewReady.current = false;
    setConsoleLines([]);
    if (withChecks) {
      setChecking(true);
      setResults(null);
    }
    setRunId((id) => id + 1);
  }, []);

  const sendChecks = useCallback(() => {
    window.clearTimeout(renderTimer.current);
    if (!wantChecks.current) return;
    wantChecks.current = false;
    iframeRef.current?.contentWindow?.postMessage(
      { __lab: true, type: "check", checks: checksRef.current },
      "*",
    );
  }, []);

  const finishSubmit = useCallback(
    async (latest: LabCheckResult[]) => {
      if (!submitAfterChecks.current || !onSubmit) return;
      submitAfterChecks.current = false;
      try {
        await onSubmit(latest);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit],
  );

  /** Ends a check run that can't complete, failing every check with why. */
  const failChecks = useCallback(
    (reason: string) => {
      wantChecks.current = false;
      const failed = checksRef.current.map((check) => ({
        label: check.label,
        passed: false,
        error: reason,
      }));
      setConsoleLines((lines) => [...lines, { level: "error", text: reason }]);
      setResults(failed);
      setChecking(false);
      onChecksResult?.(failed);
      void finishSubmit(failed);
    },
    [onChecksResult, finishSubmit],
  );

  // Never leave a check run spinning: the preview may be blocked or offline,
  // or the code may hang.
  useEffect(() => {
    if (!checking) return;
    const timer = window.setTimeout(
      () =>
        failChecks(
          previewReady.current
            ? "The checks didn't finish. Look for errors in the console, then try again."
            : "The preview didn't load. Check your internet connection, then try again.",
        ),
      CHECKS_TIMEOUT_MS + checks.length * 3000,
    );
    return () => window.clearTimeout(timer);
  }, [checking, runId, checks.length, failChecks]);

  const submit = () => {
    if (!onSubmit) return;
    setSubmitting(true);
    if (checks.length === 0) {
      submitAfterChecks.current = true;
      void finishSubmit([]);
      return;
    }
    submitAfterChecks.current = true;
    run(true);
  };

  // Messages from the sandboxed preview (identified by its window, since a
  // sandboxed frame's origin is "null").
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        __lab?: boolean;
        type?: string;
        level?: string;
        text?: string;
        results?: LabCheckResult[];
      };
      if (!data?.__lab) return;
      if (data.type === "ready") {
        previewReady.current = true;
        const built = buildPreview(kind, filesRef.current);
        if ("error" in built) {
          setConsoleLines([{ level: "error", text: built.error }]);
          if (wantChecks.current) {
            wantChecks.current = false;
            const failed = checksRef.current.map((check) => ({
              label: check.label,
              passed: false,
              error: "The code didn't compile.",
            }));
            setResults(failed);
            setChecking(false);
            onChecksResult?.(failed);
            finishSubmit(failed);
          }
          return;
        }
        event.source?.postMessage(
          { __lab: true, type: "render", ...built.payload },
          { targetOrigin: "*" },
        );
        renderTimer.current = window.setTimeout(sendChecks, RENDER_TIMEOUT_MS);
      } else if (data.type === "rendered") {
        sendChecks();
      } else if (data.type === "console" && data.text !== undefined) {
        setConsoleLines((lines) =>
          [...lines, { level: data.level ?? "log", text: data.text! }].slice(
            -200,
          ),
        );
      } else if (data.type === "checks" && data.results) {
        setResults(data.results);
        setChecking(false);
        onChecksResult?.(data.results);
        finishSubmit(data.results);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind, onChecksResult, sendChecks, finishSubmit]);

  // Live preview: rerun shortly after the code stops changing.
  useEffect(() => {
    const timer = window.setTimeout(() => run(false), AUTO_RUN_MS);
    return () => window.clearTimeout(timer);
  }, [files, run]);

  const extensions = useMemo(() => languageFor(activeFile), [activeFile]);
  const passed = results?.filter((result) => result.passed).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-h-[460px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 bg-[#f8fbff] px-2 pt-2">
            {fileNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setActiveFile(name)}
                className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  activeFile === name
                    ? "border border-b-0 border-slate-200 bg-white text-[#1C1D52]"
                    : "text-slate-500 hover:text-[#1C1D52]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto text-[13px]">
            <CodeMirror
              key={activeFile}
              value={files[activeFile] ?? ""}
              height="100%"
              minHeight="420px"
              extensions={extensions}
              readOnly={readOnly}
              basicSetup={{ tabSize: 2 }}
              onChange={(value) =>
                onFilesChange?.({ ...filesRef.current, [activeFile]: value })
              }
            />
          </div>
        </div>

        <div className="flex min-h-[460px] flex-col gap-3">
          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fbff] px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                Preview
              </span>
              <button
                type="button"
                onClick={() => run(false)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#1C1D52]"
              >
                <RotateCcw className="h-3 w-3" /> Reload
              </button>
            </div>
            <iframe
              key={runId}
              ref={iframeRef}
              src="/lab-preview"
              title="Preview"
              // No allow-same-origin: the code can't reach this site.
              sandbox="allow-scripts allow-modals"
              className="h-[300px] w-full bg-white lg:h-[calc(100%-37px)]"
            />
          </div>
          <div className="h-32 overflow-y-auto rounded-xl bg-[#101426] p-3 font-mono text-[11px] leading-5">
            <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
              <Terminal className="h-3 w-3" /> Console
            </p>
            {consoleLines.length === 0 ? (
              <p className="text-white/30">
                console.log output and errors appear here.
              </p>
            ) : (
              consoleLines.map((line, index) => (
                <p
                  key={index}
                  className={
                    line.level === "error"
                      ? "text-red-300"
                      : line.level === "warn"
                        ? "text-amber-200"
                        : "text-white/80"
                  }
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run(true)}
          disabled={checking || checks.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1C1D52] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {checking ? "Checking…" : checksLabel}
        </button>
        {onSubmit && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || checking || readOnly}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5FBB46] px-4 py-2.5 text-xs font-bold text-[#14204f] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {submitting ? "Submitting…" : submitLabel}
          </button>
        )}
        {extraActions}
        {results && (
          <span className="text-xs font-semibold text-[#1C1D52]">
            {passed} of {results.length} checks passed
          </span>
        )}
      </div>

      {results && results.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {results.map((result, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                result.passed
                  ? "bg-[#e8f7eb] text-[#397d3a]"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {result.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {result.label}
                {result.error && (
                  <span className="block text-[10px] opacity-75">
                    {result.error}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
