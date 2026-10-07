import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Images (avatars, thumbnails) belong in Supabase Storage, not in database
// columns: a base64 "data:" image is hundreds of KB, and every query that
// selects the column sends it again, which burns through database egress.
// Write paths pass incoming values through storeImage(), so a data: image is
// uploaded and only its public URL is saved.

export const IMAGE_BUCKET = "images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

let bucketReady: Promise<void> | null = null;

/** Creates the public image bucket if it does not exist yet. */
function ensureImageBucket() {
  bucketReady ??= (async () => {
    const client = createSupabaseAdminClient();
    const { data } = await client.storage.getBucket(IMAGE_BUCKET);
    if (data) return;
    const { error } = await client.storage.createBucket(IMAGE_BUCKET, {
      public: true,
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export function isDataImage(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/[\w.+-]+;base64,/.test(value);
}

/** Uploads a base64 data: image and returns its public URL. */
export async function uploadDataImage(dataUrl: string, folder: string) {
  const match = /^data:(image\/[\w.+-]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Not a base64 image.");
  const contentType = match[1].toLowerCase();
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error("Use a JPG, PNG, WebP, GIF or SVG image.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new Error("Images must be 5 MB or smaller.");

  await ensureImageBucket();
  const storage = createSupabaseAdminClient().storage.from(IMAGE_BUCKET);
  const path = `${folder}/${randomUUID()}.${extension}`;
  const { error } = await storage.upload(path, bytes, {
    contentType,
    // Each upload gets a new path, so browsers and the CDN may cache it.
    cacheControl: "31536000",
  });
  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}

/**
 * Returns the value to save for an image field: a data: image is uploaded
 * and replaced by its URL; anything else (a URL, null, undefined) passes
 * through unchanged.
 */
export async function storeImage<T>(value: T, folder: string) {
  return isDataImage(value) ? uploadDataImage(value, folder) : value;
}
