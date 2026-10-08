// Images interns upload in the Practice Lab (ad creatives). Safe in the
// browser: only what a stored reference looks like and where to view it.
//
// An image is stored as "lab-media:lab-ads/<owner user id>/<uuid>.<ext>":
// the bytes live in file storage (see lib/lab-media.ts), never in the
// database, and are viewed through /api/lab-media/<key>, which checks the
// viewer may see them. Each image also has a small thumbnail (?size=thumb)
// for lists and the AI.

export const MEDIA_PREFIX = "lab-media:";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^lab-ads/(${UUID})/${UUID}\\.(webp|jpg|png)$`);

/** The largest image and thumbnail accepted (the browser shrinks them well below). */
export const MAX_MEDIA_BYTES = 400 * 1024;
export const MAX_THUMB_BYTES = 100 * 1024;

export function mediaKey(ref: unknown): string | null {
  if (typeof ref !== "string" || !ref.startsWith(MEDIA_PREFIX)) return null;
  const key = ref.slice(MEDIA_PREFIX.length);
  return KEY.test(key) ? key : null;
}

export function isMediaRef(ref: unknown): ref is string {
  return mediaKey(ref) !== null;
}

/** The user who uploaded the image, from its key. */
export function mediaOwner(refOrKey: string): string | null {
  const key = refOrKey.startsWith(MEDIA_PREFIX) ? refOrKey.slice(MEDIA_PREFIX.length) : refOrKey;
  return KEY.exec(key)?.[1] ?? null;
}

/** Where the browser loads the image (or its small thumbnail) from. */
export function mediaSrc(ref: string, size: "full" | "thumb" = "full") {
  const key = mediaKey(ref);
  if (!key) return "";
  return `/api/lab-media/${key}${size === "thumb" ? "?size=thumb" : ""}`;
}

/** Draws the image at most `side` px on its longest side and encodes it under `max` bytes. */
async function encodeImage(bitmap: ImageBitmap, side: number, max: number, qualities: number[]) {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare images.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of qualities) {
    // WebP where the browser can make it, else JPEG.
    const webp = await encode("image/webp", quality);
    const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", quality);
    if (blob && blob.size <= max) return blob;
  }
  throw new Error("That image is too detailed to upload. Try a simpler one.");
}

/**
 * Shrinks an image in the browser before upload, to keep storage and
 * downloads small: a full version (at most 1080 px, usually about 100 KB)
 * and a thumbnail (512 px, about 25 KB).
 */
export async function shrinkImage(file: File): Promise<{ full: Blob; thumb: Blob }> {
  const bitmap = await createImageBitmap(file);
  try {
    const full = await encodeImage(bitmap, 1080, MAX_MEDIA_BYTES, [0.78, 0.68, 0.55]);
    const thumb = await encodeImage(bitmap, 512, MAX_THUMB_BYTES, [0.7, 0.55, 0.4]);
    // Both must be the same type (the server checks).
    if (full.type !== thumb.type) throw new Error("This browser can't prepare images.");
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}
