import { FaceDetector, FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import type { Head } from "./layout";
import {
  checkCutout,
  evenGrey,
  fadeFrameEdges,
  findHead,
  luminance,
  refineMask,
  resizeBilinear,
  type Face,
  type CutoutProblem,
} from "./mask";

// Background removal for the graduation flyer, with MediaPipe (Apache-2.0):
// the Image Segmenter's selfie model finds the person and the Face
// Detector finds the face, to place and size the head. Runs in the flyer's
// Web Worker (./segmentation.worker), or on the page if workers can't.
// Everything is served from this site (public/mediapipe; see
// scripts/copy-mediapipe.ts): the photo never leaves the browser.

export const MEDIAPIPE_VERSION = "1.2.3";
const WASM_PATH = `/mediapipe/tasks-vision-${MEDIAPIPE_VERSION}`;
const SEGMENTER_MODEL = "/mediapipe/models/selfie_multiclass_256x256.tflite";
const FACE_MODEL = "/mediapipe/models/blaze_face_short_range.tflite";
/** The photo is worked on at most this big (long side). */
const WORK_SIZE = 1200;

type Models = { segmenter: ImageSegmenter; faces: FaceDetector };
let models: Promise<Models> | null = null;

function absolute(path: string) {
  return new URL(path, self.location.origin).href;
}

/**
 * MediaPipe loads its runtime with importScripts (classic worker), a
 * <script> tag (page) or import() (module worker); only a module worker
 * needs the ES-module build. The bundler may run our worker either way:
 * importScripts() with nothing to load is a no-op in a classic worker and
 * throws in a module worker.
 */
function inModuleWorker() {
  const load = (globalThis as { importScripts?: () => void }).importScripts;
  if (typeof load !== "function") return false;
  try {
    load();
    return false;
  } catch {
    return true;
  }
}

/** Loads the models once and keeps them (cached for the next photo). */
export function loadModels() {
  models ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(absolute(WASM_PATH), inModuleWorker());
    const [segmenter, faces] = await Promise.all([
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: absolute(SEGMENTER_MODEL), delegate: "CPU" },
        runningMode: "IMAGE",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: absolute(FACE_MODEL), delegate: "CPU" },
        runningMode: "IMAGE",
        // Low enough to also find smaller faces of people behind (to cut them
        // away); the graduate is the largest face anyway.
        minDetectionConfidence: 0.3,
      }),
    ]);
    return { segmenter, faces };
  })().catch((error) => {
    models = null;
    throw error;
  });
  return models;
}

function makeCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export type CutoutResult =
  | { ok: true; cutout: ImageBitmap; head: Head }
  | { ok: false; code: CutoutProblem };

/**
 * The person from the photo, background removed, in even greyscale, cropped
 * to them; and where their head is in it. Or why it can't be used.
 */
export async function processPhoto(photo: ImageBitmap): Promise<CutoutResult> {
  const { segmenter, faces } = await loadModels();
  const fit = Math.min(1, WORK_SIZE / Math.max(photo.width, photo.height));
  const w = Math.max(1, Math.round(photo.width * fit));
  const h = Math.max(1, Math.round(photo.height * fit));
  const canvas = makeCanvas(w, h);
  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!context) throw new Error("No 2D canvas.");
  context.drawImage(photo, 0, 0, w, h);
  const image = context.getImageData(0, 0, w, h);
  const n = w * h;

  // Person confidence: the multiclass model's mask 0 is background.
  const segmentation = segmenter.segment(image);
  const masks = segmentation.confidenceMasks ?? [];
  if (!masks.length) {
    segmentation.close();
    return { ok: false, code: "NO_PERSON" };
  }
  const first = masks[0];
  const raw = first.getAsFloat32Array();
  let confidence: Float32Array = new Float32Array(raw.length);
  if (masks.length > 1) for (let i = 0; i < raw.length; i++) confidence[i] = 1 - raw[i];
  else confidence.set(raw);
  confidence = resizeBilinear(confidence, first.width, first.height, w, h);
  // Multiclass model: 0 background, 1 hair, 2 body skin, 3 face skin,
  // 4 clothes, 5 other (accessories).
  const clothes = masks.length > 4
    ? resizeBilinear(masks[4].getAsFloat32Array(), masks[4].width, masks[4].height, w, h)
    : null;
  segmentation.close();

  // Every face: the largest one on a person is the graduate; the others
  // mark people to cut away if they touch them.
  const faceBoxes: Face[] = faces.detect(image).detections.flatMap((d) =>
    d.boundingBox
      ? [{
          x: d.boundingBox.originX,
          y: d.boundingBox.originY,
          width: d.boundingBox.width,
          height: d.boundingBox.height,
          score: d.categories[0]?.score ?? 0,
        }]
      : [],
  );

  const lum = luminance(image.data, n);
  const refined = refineMask(confidence, lum, w, h, faceBoxes, clothes);
  const face = refined?.face ?? null;
  const head = refined && face ? findHead(refined.person, w, h, face) : null;
  const problem = checkCutout(refined, face, head, w, h);
  if (problem || !refined || !head) return { ok: false, code: problem ?? "NO_PERSON" };

  // Crop to the person (plus the soft edge) and paint the cut-out.
  const grey = evenGrey(lum, refined.alpha, w, h);
  const alpha = fadeFrameEdges(refined.alpha, refined.person, w, h, head.height);
  const pad = Math.max(8, Math.round(Math.max(w, h) / 100));
  const x0 = Math.max(0, refined.box.x - pad);
  const y0 = Math.max(0, refined.box.y - pad);
  const x1 = Math.min(w, refined.box.x + refined.box.width + pad);
  const y1 = Math.min(h, refined.box.y + refined.box.height + pad);
  const cw = x1 - x0;
  const ch = y1 - y0;
  const out = new ImageData(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y + y0) * w + (x + x0);
      const o = (y * cw + x) * 4;
      const g = grey[i];
      out.data[o] = g;
      out.data[o + 1] = g;
      out.data[o + 2] = g;
      out.data[o + 3] = Math.round(alpha[i] * 255);
    }
  }
  const cutout = await createImageBitmap(out);
  return { ok: true, cutout, head: { x: head.x - x0, y: head.y - y0, height: head.height } };
}
