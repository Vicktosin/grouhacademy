import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPrisma } from "@/lib/prisma";
import { MEDIA_PREFIX, MAX_MEDIA_BYTES, MAX_THUMB_BYTES, mediaKey } from "@/lib/lab-media-shared";

// Where Practice Lab images (ad creatives) are kept: a private Supabase
// Storage bucket, never a database column. Built to stay small on the free
// plan (1 GB of files, 5 GB of egress a month shared with the database):
//
// - The browser shrinks every image before upload: a full version (about
//   100 KB) for the ad preview and a thumbnail (about 25 KB) that the AI and
//   the result lists use.
// - Images are served through /api/lab-media with "keep forever" caching
//   (each upload has a new name), so each viewer downloads an image once.
// - An intern keeps at most MAX_IMAGES_PER_USER images; when they reach it,
//   images no longer used in their campaigns or runs are deleted.
//
// Without Supabase credentials (some local setups) images go to
// .lab-media/ (git-ignored) in development, and uploads are off elsewhere.

export const LAB_MEDIA_BUCKET = "lab-media";
const MAX_IMAGES_PER_USER = 40;
const LOCAL_DIR = path.join(process.cwd(), ".lab-media");

const hasSupabase = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const local = () => !hasSupabase() && process.env.NODE_ENV === "development";

export function isLabMediaEnabled() {
  return hasSupabase() || local();
}

const TYPES = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
} as const;
type Extension = keyof typeof TYPES;

/** The image type from the file's first bytes (never trust the header alone). */
function sniff(bytes: Uint8Array): Extension | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  return null;
}

/** Where an image's thumbnail is kept. */
const thumbKey = (key: string) => `thumbs/${key}`;

let bucketReady: Promise<void> | null = null;

/** Creates the private bucket the first time it's needed. */
function bucket() {
  const storage = createSupabaseAdminClient().storage;
  bucketReady ??= (async () => {
    const { data } = await storage.getBucket(LAB_MEDIA_BUCKET);
    if (data) return;
    const { error } = await storage.createBucket(LAB_MEDIA_BUCKET, {
      public: false,
      fileSizeLimit: MAX_MEDIA_BYTES,
      allowedMimeTypes: Object.values(TYPES),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady.then(() => storage.from(LAB_MEDIA_BUCKET));
}

async function put(key: string, bytes: Uint8Array, contentType: string) {
  if (local()) {
    await mkdir(path.dirname(path.join(LOCAL_DIR, key)), { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), bytes);
    return;
  }
  const { error } = await (await bucket()).upload(key, bytes, {
    contentType,
    cacheControl: "31536000",
  });
  if (error) throw error;
}

async function get(key: string): Promise<Uint8Array | null> {
  if (local()) {
    const bytes = await readFile(path.join(LOCAL_DIR, key)).catch(() => null);
    return bytes ? new Uint8Array(bytes) : null;
  }
  const { data, error } = await (await bucket()).download(key);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** The names of a user's images (without thumbnails). */
async function listUserImages(userId: string): Promise<string[]> {
  const folder = `lab-ads/${userId}`;
  if (local()) return (await readdir(path.join(LOCAL_DIR, folder)).catch(() => [])).map((name) => `${folder}/${name}`);
  const { data } = await (await bucket()).list(folder, { limit: 1000 });
  return (data ?? []).map((file) => `${folder}/${file.name}`);
}

async function removeImages(keys: string[]) {
  if (!keys.length) return;
  const all = keys.flatMap((key) => [key, thumbKey(key)]);
  if (local()) {
    await Promise.all(all.map((key) => rm(path.join(LOCAL_DIR, key), { force: true })));
    return;
  }
  await (await bucket()).remove(all);
}

/** Image keys a user's ad exercises still use (drafts and stored runs). */
async function usedImages(userId: string) {
  const attempts = await getPrisma().labAttempt.findMany({
    where: { userId, scenario: { kind: "ADS" } },
    select: { files: true, runs: true },
  });
  const used = new Set<string>();
  const json = JSON.stringify(attempts);
  for (const match of json.matchAll(/lab-media:(lab-ads\/[\w/.-]+)/g)) used.add(match[1]);
  return used;
}

export class MediaError extends Error {}

/** Checks and stores an uploaded image and its thumbnail; returns its reference. */
export async function saveLabImage(userId: string, full: Uint8Array, thumb: Uint8Array) {
  if (!isLabMediaEnabled()) throw new MediaError("Image uploads aren't set up yet. Describe your image instead.");
  if (!full.length || full.length > MAX_MEDIA_BYTES || !thumb.length || thumb.length > MAX_THUMB_BYTES)
    throw new MediaError("That image is too big. Try again; the page shrinks images for you.");
  const extension = sniff(full);
  const thumbExtension = sniff(thumb);
  if (!extension || thumbExtension !== extension) throw new MediaError("Upload a JPG, PNG or WebP image.");

  // At the limit, first clear out images no longer used anywhere.
  let mine = await listUserImages(userId);
  if (mine.length >= MAX_IMAGES_PER_USER) {
    const used = await usedImages(userId);
    await removeImages(mine.filter((key) => !used.has(key)));
    mine = mine.filter((key) => used.has(key));
  }
  if (mine.length >= MAX_IMAGES_PER_USER)
    throw new MediaError(
      `You're using ${MAX_IMAGES_PER_USER} images already. Remove some from your ads, then try again.`,
    );

  const key = `lab-ads/${userId}/${randomUUID()}.${extension}`;
  await put(key, full, TYPES[extension]);
  await put(thumbKey(key), thumb, TYPES[extension]);
  return `${MEDIA_PREFIX}${key}`;
}

/** The thumbnail's bytes, for the AI to look at (null if it's gone). */
export async function readLabThumb(ref: string) {
  const key = mediaKey(ref);
  if (!key || !isLabMediaEnabled()) return null;
  const bytes = await get(thumbKey(key));
  return bytes ? { bytes, contentType: TYPES[key.split(".").pop() as Extension] } : null;
}

/**
 * The image (or its thumbnail) for the browser. Its name never changes, so
 * the browser keeps it: each viewer downloads it from storage only once.
 */
export async function labImageResponse(key: string, thumb: boolean): Promise<Response> {
  if (!isLabMediaEnabled()) return new Response("Not found", { status: 404 });
  const bytes = await get(thumb ? thumbKey(key) : key);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[key.split(".").pop() as Extension],
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
