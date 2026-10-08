// Images interns upload in the Practice Lab (ad creatives). Safe in the
// browser: only what a stored reference looks like and where to view it.
//
// An image is stored as "lab-media:lab-ads/<owner user id>/<uuid>.<ext>":
// the bytes live in file storage (see lib/lab-media.ts), never in the
// database, and are viewed through /api/lab-media/<key>, which checks the
// viewer may see them.

export const MEDIA_PREFIX = "lab-media:";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY = new RegExp(`^lab-ads/(${UUID})/${UUID}\\.(webp|jpg|png)$`);

/** The largest image accepted (the browser shrinks them well below this). */
export const MAX_MEDIA_BYTES = 600 * 1024;

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

/** Where the browser loads the image from. */
export function mediaSrc(ref: string) {
  const key = mediaKey(ref);
  return key ? `/api/lab-media/${key}` : "";
}

/**
 * Shrinks an image in the browser before upload: at most 1080 px on the
 * longest side, WebP (JPEG where WebP isn't supported), small enough to
 * upload quickly on mobile data and cheap to store.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare images.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  for (const quality of [0.82, 0.7, 0.55]) {
    const webp = await encode("image/webp", quality);
    const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg", quality);
    if (blob && blob.size <= MAX_MEDIA_BYTES) return blob;
  }
  throw new Error("That image is too detailed to upload. Try a smaller one.");
}
