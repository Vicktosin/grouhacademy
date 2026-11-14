import type { Head } from "./layout";
import type { CutoutProblem } from "./mask";

// The page side of the flyer's background removal. The models load lazily
// (warmUp, when the flyer pop-up opens) in a Web Worker and stay loaded for
// the next photo. If workers can't run them, it runs on the page instead.

export type FlyerPhotoError =
  | CutoutProblem
  | "UNSUPPORTED_TYPE"
  | "TOO_LARGE"
  | "READ_FAILED"
  | "FAILED"
  | "TIMEOUT";

export type PhotoResult = { ok: true; cutout: ImageBitmap; head: Head } | { ok: false; code: FlyerPhotoError };

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Background removal itself (after the models have loaded). */
const PROCESS_TIMEOUT_MS = 15_000;
/** First download of the models on a slow connection. */
const LOAD_TIMEOUT_MS = 120_000;

let worker: Worker | null = null;
let ready: Promise<boolean> | null = null;
let nextId = 1;
const waiting = new Map<number, (result: PhotoResult) => void>();
let useMainThread = typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined";

function startWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./segmentation.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const message = event.data;
    if (message?.type === "result" || message?.type === "error") {
      const resolve = waiting.get(message.id);
      waiting.delete(message.id);
      resolve?.(message.type === "result" ? message.result : { ok: false, code: "FAILED" });
    }
  };
  worker.onerror = () => {
    for (const resolve of waiting.values()) resolve({ ok: false, code: "FAILED" });
    waiting.clear();
    stopWorker();
  };
  return worker;
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  ready = null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** Starts loading the models (call when the flyer pop-up opens). */
export function warmUp(): Promise<boolean> {
  if (ready) return ready;
  if (useMainThread) {
    ready = import("./segment-core")
      .then((core) => core.loadModels())
      .then(() => true)
      .catch(() => {
        ready = null;
        return false;
      });
    return ready;
  }
  const w = startWorker();
  ready = new Promise<boolean>((resolve) => {
    const listen = (event: MessageEvent) => {
      if (event.data?.type !== "ready" && event.data?.type !== "load-failed") return;
      w.removeEventListener("message", listen);
      if (event.data.type === "ready") return resolve(true);
      // The worker couldn't load them: try on the page next time.
      stopWorker();
      useMainThread = true;
      resolve(false);
    };
    w.addEventListener("message", listen);
    w.postMessage({ type: "warm" });
  });
  return ready;
}

/** Checks the file, then removes its background. Never returns the original. */
export async function cutOutPerson(file: File): Promise<PhotoResult> {
  if (!PHOTO_TYPES.includes(file.type)) return { ok: false, code: "UNSUPPORTED_TYPE" };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, code: "TOO_LARGE" };
  let photo: ImageBitmap;
  try {
    // Phones store photos sideways with an EXIF rotation: apply it.
    photo = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { ok: false, code: "READ_FAILED" };
  }

  const loaded = await withTimeout(warmUp(), LOAD_TIMEOUT_MS, false);
  if (!loaded && !useMainThread) {
    photo.close();
    return { ok: false, code: "TIMEOUT" };
  }

  if (useMainThread) {
    try {
      const core = await import("./segment-core");
      if (!loaded) await withTimeout(core.loadModels(), LOAD_TIMEOUT_MS, null);
      return await withTimeout<PhotoResult>(core.processPhoto(photo), PROCESS_TIMEOUT_MS, { ok: false, code: "TIMEOUT" });
    } catch (error) {
      console.error("Flyer background removal failed:", error);
      return { ok: false, code: "FAILED" };
    } finally {
      photo.close();
    }
  }

  const id = nextId++;
  const w = startWorker();
  const result = new Promise<PhotoResult>((resolve) => waiting.set(id, resolve));
  w.postMessage({ type: "process", id, photo }, [photo]);
  const outcome = await withTimeout<PhotoResult | null>(result, PROCESS_TIMEOUT_MS, null);
  if (outcome) return outcome;
  // Stuck: start a fresh worker next time.
  waiting.delete(id);
  stopWorker();
  return { ok: false, code: "TIMEOUT" };
}

/** What to tell the graduate for each problem. */
export const PHOTO_ERROR_MESSAGES: Record<FlyerPhotoError, string> = {
  NO_PERSON:
    "We couldn't find you clearly in this photo. Please upload a clear photo of yourself from the waist up.",
  TOO_SMALL:
    "You're a bit too far away in this photo. Please upload a closer photo of yourself from the waist up.",
  CUT_OFF:
    "Part of your head is cut off in this photo. Please upload a photo with your whole head and shoulders in it.",
  UNSUPPORTED_TYPE: "Please choose a JPG, PNG or WEBP photo.",
  TOO_LARGE: "That photo is larger than 10 MB. Please choose a smaller one.",
  READ_FAILED: "We couldn't open that photo. Please try a different one.",
  FAILED: "Something went wrong while preparing your flyer. Please try again.",
  TIMEOUT: "Preparing your flyer took too long. Please try again.",
};
