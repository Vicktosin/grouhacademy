"use client";

import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import { Download, ImagePlus, LoaderCircle, RotateCcw, Share2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FLYER_HEIGHT,
  FLYER_WIDTH,
  MAX_ZOOM,
  PHOTO_CIRCLE,
  SHARE_CAPTION,
  coverScale,
  defaultPlacement,
  flyerFileName,
  shareLinks,
  zoomPlacement,
  type Placement,
} from "@/lib/flyer/layout";
import { PHOTO_ERROR_MESSAGES, loadPhoto, warmUp, type FlyerPhotoError } from "@/lib/flyer/photo";
import { drawFlyer, loadFlyerAssets } from "@/lib/flyer/render";
import { updateGraduation, type GraduationData } from "./graduation-data";

// Step 1 of the graduation pop-up: the graduate uploads a photo and their
// own flyer is drawn in the browser (lib/flyer/render): the template, their
// photo exactly as uploaded in the circle (their face centred when it's
// found, lib/flyer/photo), and their name. They can move and zoom the
// photo, then download and share it. The finished flyer (never the photo)
// is saved so admins can see it.

type Phase =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "error"; code: FlyerPhotoError | "ASSETS" }
  | { kind: "ready" };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function FlyerStep({
  data,
  onShared,
}: {
  data: GraduationData;
  /** After a download or share: move on to the experience step. */
  onShared: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [links, setLinks] = useState<{ name: string; href: string }[] | null>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<ImageBitmap | null>(null);
  const templateRef = useRef<HTMLImageElement | null>(null);
  const baseRef = useRef<Placement | null>(null);
  // The flyer saved for this placement (re-saved after changes).
  const savedRef = useRef<{ placement: Placement | null; url: string } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Load the face detector as soon as the pop-up opens.
  useEffect(() => {
    void warmUp();
    return () => photoRef.current?.close();
  }, []);

  // Before a photo: their own flyer with a silhouette and their name.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    void loadFlyerAssets(data.studentName)
      .then((template) => {
        const canvas = document.createElement("canvas");
        canvas.width = FLYER_WIDTH;
        canvas.height = FLYER_HEIGHT;
        const context = canvas.getContext("2d");
        if (!context) return;
        drawFlyer(context, { template, photo: null, placement: null, name: data.studentName });
        canvas.toBlob((blob) => {
          if (!blob || cancelled) return;
          url = URL.createObjectURL(blob);
          setPreview(url);
        }, "image/png");
      })
      .catch(() => null);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data.studentName]);

  // Redraw whenever the photo's position or size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const photo = photoRef.current;
    const template = templateRef.current;
    if (phase.kind !== "ready" || !canvas || !photo || !template || !placement) return;
    const frame = requestAnimationFrame(() => {
      const context = canvas.getContext("2d");
      if (context) drawFlyer(context, { template, photo, placement, name: data.studentName });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, placement, data.studentName]);

  const process = useCallback(
    async (file: File) => {
      setPhase({ kind: "working" });
      setLinks(null);
      setNotice(null);
      const [result, template] = await Promise.all([
        loadPhoto(file),
        loadFlyerAssets(data.studentName).catch(() => null),
      ]);
      if (!result.ok) return setPhase({ kind: "error", code: result.code });
      if (!template) {
        result.photo.close();
        return setPhase({ kind: "error", code: "ASSETS" });
      }
      templateRef.current = template;
      photoRef.current?.close();
      photoRef.current = result.photo;
      const base = defaultPlacement(result.photo.width, result.photo.height, result.face);
      baseRef.current = base;
      savedRef.current = null;
      setSize({ width: result.photo.width, height: result.photo.height });
      setPlacement(base);
      setPhase({ kind: "ready" });
    },
    [data.studentName],
  );

  /** Changes the placement, keeping the circle covered. */
  function zoomBy(p: Placement, factor: number, around: { x: number; y: number }) {
    return size ? zoomPlacement(p, factor, around, size.width, size.height) : p;
  }

  function choose() {
    fileRef.current?.click();
  }

  // ── Drag and zoom (mouse, touch, pinch, wheel) ──────────────────────────
  function toFlyer(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FLYER_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FLYER_HEIGHT,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, toFlyer(event));
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !placement || !size) return;
    const point = toFlyer(event);
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId);
    if (others.length === 0) {
      // Moving by 1 = zooming by 1 (which keeps the circle covered).
      setPlacement(
        zoomBy({ ...placement, x: placement.x + point.x - previous.x, y: placement.y + point.y - previous.y }, 1, point),
      );
    } else {
      // Pinch: zoom by the change in distance, around the midpoint.
      const other = others[0][1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(point.x - other.x, point.y - other.y);
      if (before > 4) setPlacement(zoomBy(placement, after / before, { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }));
    }
    pointers.current.set(event.pointerId, point);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
  }

  // The zoom slider: 1 = just covering the circle.
  const zoomLevel = placement && size ? placement.scale / coverScale(size.width, size.height) : 1;
  function setZoom(level: number) {
    if (placement) setPlacement(zoomBy(placement, level / zoomLevel, PHOTO_CIRCLE));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase.kind !== "ready") return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const around = toFlyer(event);
      setPlacement((p) => (p && size ? zoomPlacement(p, Math.exp(-event.deltaY / 500), around, size.width, size.height) : p));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [phase.kind, size]);

  // ── Download, share, save ───────────────────────────────────────────────
  async function flyerBlob(): Promise<Blob | null> {
    if (phase.kind === "ready" && canvasRef.current)
      return new Promise((resolve) => canvasRef.current!.toBlob(resolve, "image/png"));
    if (data.flyerUrl) return fetch(data.flyerUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    return null;
  }

  /** Saves the flyer for admins (once per placement). Returns its URL. */
  async function save(blob: Blob): Promise<string | null> {
    if (phase.kind !== "ready") return data.flyerUrl;
    if (savedRef.current && savedRef.current.placement === placement) return savedRef.current.url;
    const body = new FormData();
    body.append("file", new File([blob], flyerFileName(data.studentName), { type: "image/png" }));
    const response = await fetch("/api/internship/testimonial/flyer", { method: "POST", body }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || typeof result?.url !== "string") return null;
    savedRef.current = { placement, url: result.url };
    updateGraduation({ flyerUrl: result.url });
    return result.url;
  }

  async function download() {
    setBusy("download");
    setNotice(null);
    const blob = await flyerBlob();
    if (!blob) {
      setBusy(null);
      return setNotice("We couldn't prepare the image. Please try again.");
    }
    downloadBlob(blob, flyerFileName(data.studentName));
    await save(blob);
    setBusy(null);
    onShared();
  }

  async function share() {
    setBusy("share");
    setNotice(null);
    const blob = await flyerBlob();
    if (!blob) {
      setBusy(null);
      return setNotice("We couldn't prepare the image. Please try again.");
    }
    const file = new File([blob], flyerFileName(data.studentName), { type: "image/png" });
    const url = await save(blob);
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: SHARE_CAPTION });
        setBusy(null);
        return onShared();
      } catch (error) {
        setBusy(null);
        // Closing the share sheet isn't an error.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    // No file sharing here: download it, and offer share links.
    downloadBlob(blob, flyerFileName(data.studentName));
    setLinks(shareLinks(url));
    setBusy(null);
  }

  const working = phase.kind === "working";
  const ready = phase.kind === "ready";
  const showSaved = !ready && !working && phase.kind !== "error" && data.flyerUrl;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0B7D54]">Graduation is here 🎓</p>
      <h2 id="graduation-title" className="mt-1 text-xl font-bold leading-snug text-[#1C1D52]">
        {ready || showSaved ? "Your graduation flyer" : "See yourself on your graduation flyer"}
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {ready
          ? "Drag to move your photo, and pinch or use the slider to zoom. Then download it or share it with your friends."
          : "Upload your photo and we'll make your own Sabirole graduation flyer to share with your friends."}
      </p>

      <div className="relative mx-auto mt-4 w-full max-w-[340px] overflow-hidden rounded-xl bg-[#EAF4EE] shadow-[0_10px_30px_rgba(28,29,82,0.18)] sm:max-w-[360px]">
        {ready ? (
          <canvas
            ref={canvasRef}
            width={FLYER_WIDTH}
            height={FLYER_HEIGHT}
            role="img"
            aria-label={`Your graduation flyer with your photo and the name ${data.studentName}. Drag to move the photo.`}
            className="block h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={showSaved ? data.flyerUrl! : (preview ?? "/flyer-sample.png")}
            alt={
              showSaved
                ? `Your saved graduation flyer with the name ${data.studentName}`
                : `Your graduation flyer, waiting for your photo: a person silhouette in a green circle with confetti and a graduation cap, the words I just completed my internship program with Sabirole, and the name ${data.studentName}`
            }
            width={FLYER_WIDTH}
            height={FLYER_HEIGHT}
            className={`block h-auto w-full ${working ? "opacity-40" : ""}`}
          />
        )}
        {working && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/40 text-center" role="status">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#0B7D54]" aria-hidden="true" />
            <p className="text-sm font-bold text-[#1C1D52]">Preparing your flyer...</p>
          </div>
        )}
        {!ready && !showSaved && !working && (
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#1C1D52]">Preview</span>
        )}
      </div>

      {ready && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-[11px] font-semibold text-[#1C1D52]">
            Zoom
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoomLevel}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="flex-1 accent-[#0B7D54]"
              aria-label="Zoom photo"
            />
          </label>
          <button
            type="button"
            onClick={() => baseRef.current && setPlacement(baseRef.current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-[#1C1D52]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset position
          </button>
        </div>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {phase.code === "ASSETS"
            ? "We couldn't load the flyer design. Please check your connection and try again."
            : PHOTO_ERROR_MESSAGES[phase.code]}
        </div>
      )}

      {notice && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{notice}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void process(file);
        }}
      />

      {ready || showSaved ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void share()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B7D54] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === "share" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" aria-hidden="true" />} Share
            </button>
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#12306B] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === "download" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" aria-hidden="true" />} Download
            </button>
          </div>
          <button
            type="button"
            onClick={choose}
            disabled={busy !== null}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-[#1C1D52]"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Change photo
          </button>
          {links && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] text-slate-600">Your flyer was downloaded. Share it on:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#12306B] shadow-sm">
                    {link.name}
                  </a>
                ))}
              </div>
              <button type="button" onClick={onShared} className="mt-3 text-xs font-bold text-[#0B7D54] underline">
                Next: share your experience
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={choose}
            disabled={working}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B7D54] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {phase.kind === "error" ? "Choose another photo" : "Upload your photo"}
          </button>
          <p className="mt-2 text-center text-[11px] leading-4 text-slate-500">
            Tip: Use a clear photo of you from the waist up, facing the camera.
          </p>
        </>
      )}
    </div>
  );
}
