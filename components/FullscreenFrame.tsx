"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Full screen for the Practice Lab simulators: one click fills the whole
// screen with the simulator (the browser's own full screen where it's
// supported, e.g. on laptops and desktops; otherwise the page area), and
// Esc or the button brings it back. Simulators can read whether they're
// full screen (to use the extra height) and show their own toggle.

type Fullscreen = { full: boolean; toggle: () => void };

const FullscreenContext = createContext<Fullscreen>({ full: false, toggle: () => {} });

/** Whether the simulator is full screen, and a toggle for its own controls. */
export function useFullscreen() {
  return useContext(FullscreenContext);
}

export function FullscreenToggle({ className = "" }: { className?: string }) {
  const { full, toggle } = useFullscreen();
  return (
    <button
      type="button"
      onClick={toggle}
      title={full ? "Exit full screen (Esc)" : "Full screen"}
      aria-label={full ? "Exit full screen" : "Full screen"}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${className}`}
    >
      {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{full ? "Exit full screen" : "Full screen"}</span>
    </button>
  );
}

export default function FullscreenFrame({
  children,
  ownControls = false,
}: {
  children: React.ReactNode;
  /** The simulator shows its own toggle (with useFullscreen), so none is added. */
  ownControls?: boolean;
}) {
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const exit = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    if (full) return exit();
    setFull(true);
    // The browser's own full screen hides its toolbars too (desktops).
    const element = frame.current;
    if (element?.requestFullscreen && window.matchMedia("(min-width: 768px)").matches)
      void element.requestFullscreen().catch(() => {});
  }, [full, exit]);

  useEffect(() => {
    if (!full) return;
    // Esc closes; leaving the browser's full screen (its own Esc) does too.
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.fullscreenElement && exit();
    const onChange = () => !document.fullscreenElement && setFull(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onChange);
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onChange);
      document.documentElement.style.overflow = overflow;
    };
  }, [full, exit]);

  return (
    <FullscreenContext.Provider value={{ full, toggle }}>
      <div
        ref={frame}
        className={
          full
            ? `fixed inset-0 z-[70] overflow-auto ${ownControls ? "bg-[#F0F2F5]" : "bg-[#eef3fb] p-3 sm:p-4"}`
            : "space-y-2"
        }
        data-fullscreen={full ? "on" : "off"}
      >
        {!ownControls && (
          <div className={`flex justify-end ${full ? "sticky top-0 z-10 -mx-3 -mt-3 mb-3 bg-[#eef3fb]/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:-mt-4 sm:px-4" : ""}`}>
            <FullscreenToggle className="bg-white text-[#1C1D52] shadow-sm hover:bg-slate-50" />
          </div>
        )}
        <div className="space-y-4">{children}</div>
      </div>
    </FullscreenContext.Provider>
  );
}
