"use client";

import { Home, LayoutDashboard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { blueprintFor, type WpConfig } from "@/lib/wp-sim/model";

// A mentor's view of an intern's submitted WordPress site: a fresh
// WordPress (in WordPress Playground, in this browser) with the intern's
// snapshot restored into it (lib/wp-sim/snapshot), signed in as admin.
// Changes made here aren't saved anywhere.

const REMOTE_URL = "https://playground.wordpress.net/remote.html";

type Client = Awaited<ReturnType<(typeof import("@wp-playground/client"))["startPlaygroundWeb"]>>;

export default function WordPressSnapshotViewer({ config, url }: { config: WpConfig; url: string }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const client = useRef<Client | null>(null);
  const started = useRef(false);
  const [status, setStatus] = useState<"starting" | "ready" | "error">("starting");
  const [step, setStep] = useState("Starting WordPress…");

  useEffect(() => {
    if (started.current || !iframe.current) return;
    started.current = true;
    (async () => {
      try {
        const playground = await import("@wp-playground/client");
        const [wp, zip] = await Promise.all([
          playground.startPlaygroundWeb({
            iframe: iframe.current!,
            remoteUrl: REMOTE_URL,
            blueprint: blueprintFor(config, false) as Parameters<typeof playground.startPlaygroundWeb>[0]["blueprint"],
          }),
          fetch(url).then((response) => {
            if (!response.ok) throw new Error(`Snapshot ${response.status}`);
            return response.blob();
          }),
        ]);
        setStep("Restoring the intern's site…");
        await playground.importWordPressFiles(wp, { wordPressFilesZip: new File([zip], "site.zip") });
        // Sign in to the restored site. Playground's own auto-login has
        // already run once in this browser (for the fresh site), so it won't
        // again; the login form works the same as for a person. Every
        // Playground site's admin is admin / password.
        await wp.request({ url: "/wp-login.php" });
        await wp.request({
          url: "/wp-login.php",
          method: "POST",
          body: { log: "admin", pwd: "password", rememberme: "forever", testcookie: "1", "wp-submit": "Log In" },
        });
        await wp.goTo(config.landingPage || "/");
        client.current = wp;
        setStatus("ready");
      } catch (error) {
        console.error("The site couldn't be opened:", error);
        setStatus("error");
      }
    })();
  }, [config, url]);

  const go = (path: string) => void client.current?.goTo(path);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[#f8fbff] px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Their WordPress site</span>
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={status !== "ready"} onClick={() => go("/")} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1C1D52] hover:bg-white disabled:opacity-40">
            <Home className="h-3.5 w-3.5" /> Site
          </button>
          <button type="button" disabled={status !== "ready"} onClick={() => go("/wp-admin/")} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#1C1D52] hover:bg-white disabled:opacity-40">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </button>
        </div>
      </div>
      <div className="relative">
        <iframe ref={iframe} title="The intern's WordPress site" className="h-[70vh] min-h-[480px] w-full bg-white" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-sm text-slate-600">
            {status === "starting" ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-[#1C1D52]" />
                <p>{step}</p>
                <p className="text-xs text-slate-400">The first time takes a little while (WordPress downloads about 30 MB).</p>
              </>
            ) : (
              <p>The site couldn&apos;t be opened. Check your connection and reload the page.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
