"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// Shown on app pages after someone arrives from the old domain (the
// redirect adds ?moved=1, see lib/domain-move.ts): the site has moved, they
// may need to sign in again, and if they had installed the app they can
// install it again here. Remembered in this browser until dismissed.

const FLAG = "grouh-moved-notice";

type InstallPrompt = Event & { prompt: () => Promise<void> };

function read() {
  try {
    return localStorage.getItem(FLAG);
  } catch {
    return null;
  }
}
function write(value: string) {
  try {
    localStorage.setItem(FLAG, value);
  } catch {
    // Private browsing: the notice just won't be remembered.
  }
}

export default function MovedNotice() {
  const [show, setShow] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("moved") === "1") {
      if (read() !== "dismissed") write("show");
      url.searchParams.delete("moved");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    const installed = window.matchMedia("(display-mode: standalone)").matches;
    // Running as the app installed from the new domain: nothing to say.
    if (installed && read() === "show") write("dismissed");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only state once
    setShow(read() === "show" && !installed);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;
  const dismiss = () => {
    write("dismissed");
    setShow(false);
  };
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg rounded-2xl bg-[#1C1D52] p-4 text-white shadow-2xl sm:bottom-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close"
        className="absolute right-2 top-2 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-bold">Grouh Academy is now SabiRole: welcome to sabirole.com</p>
      <p className="mt-1 text-xs leading-5 text-white/80">
        Your account and work are the same; you may need to sign in once more. If you installed
        the app before, install it again from here, then you can remove the old one.
        {!installPrompt && iPhone && " On iPhone: tap Share, then Add to Home Screen."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {installPrompt && (
          <button
            type="button"
            onClick={async () => {
              await installPrompt.prompt().catch(() => {});
              setInstallPrompt(null);
              dismiss();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#5FBB46] px-3 py-2 text-xs font-bold text-[#14204f]"
          >
            <Download className="h-3.5 w-3.5" /> Install app
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
