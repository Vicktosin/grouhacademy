import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  TESTIMONIAL_MEDIA_BUCKET,
  baseContentType,
  mediaFolder,
  type MediaKind,
} from "@/lib/testimonial-input";

// Graduation flyers and voice notes in a public Supabase Storage bucket
// (created on first upload, so no manual setup). Only their URLs go in the
// database (InternTestimonial.flyerUrl / voiceNoteUrl).

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

let bucketReady: Promise<void> | null = null;

function ensureBucket() {
  bucketReady ??= (async () => {
    const client = createSupabaseAdminClient();
    const { data } = await client.storage.getBucket(TESTIMONIAL_MEDIA_BUCKET);
    if (data) return;
    const { error } = await client.storage.createBucket(TESTIMONIAL_MEDIA_BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export function isStorageConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Uploads a flyer or voice note for this intern; returns its public URL. */
export async function uploadTestimonialMedia(
  kind: MediaKind,
  userId: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const type = baseContentType(contentType);
  const extension = EXTENSIONS[type];
  if (!extension) throw new Error(`Unsupported file type: ${type}`);
  await ensureBucket();
  const storage = createSupabaseAdminClient().storage.from(TESTIMONIAL_MEDIA_BUCKET);
  const path = `${mediaFolder(kind, userId)}/${randomUUID()}.${extension}`;
  const { error } = await storage.upload(path, bytes, {
    contentType: type,
    // Each upload gets a new path, so browsers and the CDN may cache it.
    cacheControl: "31536000",
  });
  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}

/** The storage path of a file in the media bucket, from its public URL. */
export function mediaPathFromUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${TESTIMONIAL_MEDIA_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

/** Deletes files from the media bucket by their public URLs (best effort). */
export async function deleteTestimonialMedia(urls: (string | null | undefined)[]) {
  const paths = urls.map(mediaPathFromUrl).filter((path): path is string => Boolean(path));
  if (!paths.length || !isStorageConfigured()) return 0;
  const { data, error } = await createSupabaseAdminClient().storage.from(TESTIMONIAL_MEDIA_BUCKET).remove(paths);
  if (error) throw error;
  return data?.length ?? 0;
}

type StoredFile = { path: string; createdAt: Date | null };

/** Every file under flyers/ or voice-notes/ (one folder per intern). */
async function listMediaFiles(kind: MediaKind): Promise<StoredFile[]> {
  const storage = createSupabaseAdminClient().storage.from(TESTIMONIAL_MEDIA_BUCKET);
  const PAGE = 1000;
  async function list(prefix: string) {
    const entries: { name: string; id: string | null; created_at?: string | null }[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await storage.list(prefix, { limit: PAGE, offset });
      if (error) throw error;
      entries.push(...(data ?? []));
      if (!data || data.length < PAGE) return entries;
    }
  }
  const files: StoredFile[] = [];
  // Folders come back without an id.
  for (const folder of (await list(kind)).filter((entry) => !entry.id)) {
    for (const file of await list(`${kind}/${folder.name}`)) {
      if (!file.id) continue;
      files.push({
        path: `${kind}/${folder.name}/${file.name}`,
        createdAt: file.created_at ? new Date(file.created_at) : null,
      });
    }
  }
  return files;
}

/**
 * Deletes flyers and voice notes no testimonial points to any more (an
 * intern changed their photo or recorded again) once they're older than
 * `minAgeMs`, so a file uploaded moments before it's saved is never taken.
 * The flyer and voice note each intern currently has are always kept.
 */
export async function sweepUnusedTestimonialMedia(
  inUse: (string | null)[],
  { minAgeMs = 12 * 60 * 60 * 1000, now = new Date() }: { minAgeMs?: number; now?: Date } = {},
) {
  if (!isStorageConfigured()) return { checked: 0, deleted: 0 };
  const { data: bucket } = await createSupabaseAdminClient().storage.getBucket(TESTIMONIAL_MEDIA_BUCKET);
  if (!bucket) return { checked: 0, deleted: 0 };
  const keep = new Set(inUse.map(mediaPathFromUrl).filter(Boolean));
  const files = [...(await listMediaFiles("flyers")), ...(await listMediaFiles("voice-notes"))];
  const unused = files
    .filter((file) => !keep.has(file.path))
    .filter((file) => file.createdAt && now.getTime() - file.createdAt.getTime() >= minAgeMs)
    .map((file) => file.path);
  const storage = createSupabaseAdminClient().storage.from(TESTIMONIAL_MEDIA_BUCKET);
  let deleted = 0;
  for (let i = 0; i < unused.length; i += 100) {
    const { data, error } = await storage.remove(unused.slice(i, i + 100));
    if (error) throw error;
    deleted += data?.length ?? 0;
  }
  return { checked: files.length, deleted };
}
