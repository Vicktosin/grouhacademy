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
