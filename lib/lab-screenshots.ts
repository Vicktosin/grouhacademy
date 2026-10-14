import { buildPreview, type LabFiles, type LabKindKey } from "@/lib/lab-shared";

// Screenshots of an intern's web or React site for their task submission:
// the code runs in hidden copies of the sandboxed preview (app/lab-preview)
// at desktop and phone width, and each draws itself into a WebP image. In
// the browser only.

export type Screenshot = { label: "Desktop" | "Phone"; blob: Blob; width: number; height: number };

const SIZES = [
  // Width and height of the window, image scale, tallest page captured.
  { label: "Desktop" as const, width: 1280, height: 800, scale: 1, maxHeight: 2400 },
  { label: "Phone" as const, width: 390, height: 844, scale: 1.5, maxHeight: 2400 },
];

/** Give up on one screenshot after this long (the submission goes on without it). */
const TIMEOUT_MS = 25_000;
/** After the page says it's drawn, let images and web fonts arrive. */
const SETTLE_MS = 1200;

function capture(kind: LabKindKey, files: LabFiles, size: (typeof SIZES)[number]): Promise<Screenshot | null> {
  const built = buildPreview(kind, files);
  if ("error" in built) return Promise.resolve(null);
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.src = "/lab-preview";
    // As in the workspace, but without pop-ups (an alert() would stall it).
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // On screen but invisible: browsers pause frames outside the viewport,
    // which would hold the page's "drawn" signal back.
    Object.assign(frame.style, {
      position: "fixed",
      left: "0",
      top: "0",
      opacity: "0",
      zIndex: "-1",
      width: `${size.width}px`,
      height: `${size.height}px`,
      border: "0",
      pointerEvents: "none",
    });
    let settled = false;
    let drawTimer: number | undefined;
    const finish = (shot: Screenshot | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearTimeout(drawTimer);
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve(shot);
    };
    const timer = window.setTimeout(() => finish(null), TIMEOUT_MS);
    const shoot = () => {
      window.clearTimeout(drawTimer);
      window.setTimeout(
        () =>
          frame.contentWindow?.postMessage(
            { __lab: true, type: "screenshot", scale: size.scale, maxHeight: size.maxHeight, quality: 0.72 },
            "*",
          ),
        SETTLE_MS,
      );
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { __lab?: boolean; type?: string; blob?: Blob; width?: number; height?: number; error?: string };
      if (!data?.__lab) return;
      if (data.type === "ready") {
        frame.contentWindow?.postMessage({ __lab: true, type: "render", ...built.payload }, "*");
        // React pages say when they're drawn; plain pages do it themselves.
        drawTimer = window.setTimeout(shoot, 6000);
      } else if (data.type === "rendered") {
        shoot();
      } else if (data.type === "screenshot") {
        if (data.error || !(data.blob instanceof Blob)) {
          console.warn("Screenshot failed:", data.error);
          finish(null);
        } else {
          finish({
            label: size.label,
            blob: data.blob,
            width: Math.round((data.width ?? size.width) * size.scale),
            height: Math.round((data.height ?? size.height) * size.scale),
          });
        }
      }
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(frame);
  });
}

/** Desktop and phone screenshots of the site (any that fail are left out). */
export async function captureLabScreenshots(kind: LabKindKey, files: LabFiles): Promise<Screenshot[]> {
  const shots = await Promise.all(SIZES.map((size) => capture(kind, files, size)));
  return shots.filter((shot): shot is Screenshot => shot !== null);
}
