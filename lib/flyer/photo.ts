import type { FaceDetector } from "@mediapipe/tasks-vision";

// The graduate's photo for the flyer: checked, decoded exactly as uploaded
// (upright, using the photo's EXIF orientation; no filters or colour
// changes), and their face found with MediaPipe's Face Detector
// (Apache-2.0) to centre it. Everything happens in the browser and is
// served from this site (public/mediapipe; scripts/copy-mediapipe.ts):
// the photo never leaves the device.

export type FlyerPhotoError = "UNSUPPORTED_TYPE" | "TOO_LARGE" | "READ_FAILED";

export const PHOTO_ERROR_MESSAGES: Record<FlyerPhotoError, string> = {
  UNSUPPORTED_TYPE: "That file type isn't supported. Please choose a JPG, PNG or WEBP photo.",
  TOO_LARGE: "That photo is larger than 10 MB. Please choose a smaller photo.",
  READ_FAILED: "We couldn't open that photo. It may be damaged. Please choose another photo.",
};

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp)$/i;
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Very large photos are scaled down to this (long side); colours are untouched. */
const MAX_SIDE = 4096;
/** Face detection works on a smaller copy. */
const DETECT_SIDE = 1024;
const DETECT_TIMEOUT_MS = 8_000;

export const MEDIAPIPE_VERSION = "1.2.3";
const WASM_PATH = `/mediapipe/tasks-vision-${MEDIAPIPE_VERSION}`;
const FACE_MODEL = "/mediapipe/models/blaze_face_short_range.tflite";

export type Photo = ImageBitmap;
export type PhotoResult =
  | { ok: true; photo: Photo; face: { x: number; y: number } | null }
  | { ok: false; code: FlyerPhotoError };

export function checkPhotoFile(file: { type: string; name: string; size: number }): FlyerPhotoError | null {
  const typeOk = file.type ? PHOTO_TYPES.includes(file.type) : PHOTO_EXTENSIONS.test(file.name);
  if (!typeOk) return "UNSUPPORTED_TYPE";
  if (file.size > PHOTO_MAX_BYTES) return "TOO_LARGE";
  return null;
}

async function decodeWithImage(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    // <img> applies the EXIF orientation (image-orientation: from-image).
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes the photo upright, at its own colours. */
async function decode(file: File): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await decodeWithImage(file);
  }
  const long = Math.max(bitmap.width, bitmap.height);
  if (long <= MAX_SIDE) return bitmap;
  const ratio = MAX_SIDE / long;
  const smaller = await createImageBitmap(bitmap, {
    resizeWidth: Math.round(bitmap.width * ratio),
    resizeHeight: Math.round(bitmap.height * ratio),
    resizeQuality: "high",
  });
  bitmap.close();
  return smaller;
}

let detector: Promise<FaceDetector> | null = null;

/** Loads the face detector once (call when the flyer pop-up opens). */
export function warmUp() {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(new URL(WASM_PATH, location.origin).href);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: new URL(FACE_MODEL, location.origin).href, delegate: "CPU" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    });
  })().catch((error) => {
    detector = null;
    throw error;
  });
  return detector.catch(() => null);
}

/** The centre of the largest face, in photo pixels; null if none or on any failure. */
async function findFace(photo: ImageBitmap): Promise<{ x: number; y: number } | null> {
  const ratio = Math.min(1, DETECT_SIDE / Math.max(photo.width, photo.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(photo.width * ratio);
  canvas.height = Math.round(photo.height * ratio);
  canvas.getContext("2d")?.drawImage(photo, 0, 0, canvas.width, canvas.height);
  const faces = await warmUp();
  if (!faces) return null;
  const box = faces
    .detect(canvas)
    .detections.map((d) => d.boundingBox)
    .filter((b): b is NonNullable<typeof b> => Boolean(b))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!box) return null;
  return { x: (box.originX + box.width / 2) / ratio, y: (box.originY + box.height / 2) / ratio };
}

/** Checks, decodes and finds the face in the graduate's photo. */
export async function loadPhoto(file: File): Promise<PhotoResult> {
  const problem = checkPhotoFile(file);
  if (problem) return { ok: false, code: problem };
  let photo: ImageBitmap;
  try {
    photo = await decode(file);
  } catch {
    return { ok: false, code: "READ_FAILED" };
  }
  if (!photo.width || !photo.height) return { ok: false, code: "READ_FAILED" };
  const face = await Promise.race([
    findFace(photo).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), DETECT_TIMEOUT_MS)),
  ]);
  return { ok: true, photo, face };
}
