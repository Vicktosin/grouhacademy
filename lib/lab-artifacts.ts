import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// What mentors see of a Practice Lab task submission besides the text:
// screenshots of a web or React site (desktop and phone width) and, for
// WordPress, a compact snapshot of the whole site they can open and browse.
//
// Files go straight from the intern's browser to a private Supabase Storage
// bucket (a signed upload URL), so large snapshots never pass through this
// app's server. Only one set is kept per task submission: resubmitting
// deletes the old one. Without Supabase credentials (some local setups)
// they go to .lab-media/ through this app in development.

export const ARTIFACTS_BUCKET = "lab-submissions";
const LOCAL_DIR = path.join(process.cwd(), ".lab-media", ARTIFACTS_BUCKET);

export const ARTIFACT_TYPES = {
  screenshot: { extension: "webp", contentType: "image/webp", maxBytes: 3 * 1024 * 1024 },
  snapshot: { extension: "zip", contentType: "application/zip", maxBytes: 40 * 1024 * 1024 },
} as const;
export type ArtifactType = keyof typeof ARTIFACT_TYPES;

export type LabArtifacts = {
  /** Web and React: the site at desktop and phone width. */
  screenshots?: Array<{ key: string; label: "Desktop" | "Phone"; width: number; height: number }>;
  /** WordPress: the site to restore in Playground. */
  snapshot?: { key: string; bytes: number };
  /** Web and React: the code as submitted, for the live preview (set by the server only). */
  files?: Record<string, string>;
};

const hasSupabase = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const local = () => !hasSupabase() && process.env.NODE_ENV === "development";

export function areArtifactsEnabled() {
  return hasSupabase() || local();
}

let bucketReady: Promise<void> | null = null;

/** The private bucket, created the first time it's needed. */
function bucket() {
  const storage = createSupabaseAdminClient().storage;
  bucketReady ??= (async () => {
    const { data } = await storage.getBucket(ARTIFACTS_BUCKET);
    if (data) return;
    const { error } = await storage.createBucket(ARTIFACTS_BUCKET, {
      public: false,
      fileSizeLimit: ARTIFACT_TYPES.snapshot.maxBytes,
      allowedMimeTypes: Object.values(ARTIFACT_TYPES).map((type) => type.contentType),
    });
    if (error && !/already exists/i.test(error.message)) throw error;
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady.then(() => storage.from(ARTIFACTS_BUCKET));
}

const KEY = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(webp|zip)$/;

/** Whose artifact a key is (keys are "<user id>/<uuid>.<ext>"). */
export function artifactOwner(key: unknown): string | null {
  return typeof key === "string" ? (KEY.exec(key)?.[1] ?? null) : null;
}

/**
 * Where the intern's browser uploads one artifact: a signed Supabase URL,
 * or (local development without Supabase) this app's upload route.
 */
export async function createArtifactUpload(userId: string, type: ArtifactType) {
  const key = `${userId}/${randomUUID()}.${ARTIFACT_TYPES[type].extension}`;
  if (local()) return { key, uploadUrl: `/api/lab-artifacts?key=${encodeURIComponent(key)}`, method: "PUT" as const };
  const { data, error } = await (await bucket()).createSignedUploadUrl(key);
  if (error || !data) throw error ?? new Error("No upload URL.");
  return { key, uploadUrl: data.signedUrl, method: "PUT" as const };
}

/** Local development: stores an upload sent to this app. */
export async function saveLocalArtifact(key: string, bytes: Uint8Array) {
  if (!local()) throw new Error("Uploads go to storage directly.");
  await mkdir(path.dirname(path.join(LOCAL_DIR, key)), { recursive: true });
  await writeFile(path.join(LOCAL_DIR, key), bytes);
}

export async function readLocalArtifact(key: string) {
  if (!local() || !artifactOwner(key)) return null;
  return readFile(path.join(LOCAL_DIR, key)).catch(() => null);
}

/** Short-lived links for a reviewer's browser to load the artifacts. */
export async function artifactUrls(keys: string[]) {
  const urls = new Map<string, string>();
  if (!keys.length) return urls;
  if (local()) {
    for (const key of keys) urls.set(key, `/api/lab-artifacts?key=${encodeURIComponent(key)}`);
    return urls;
  }
  const { data } = await (await bucket()).createSignedUrls(keys, 60 * 60);
  for (const row of data ?? []) if (row.path && row.signedUrl) urls.set(row.path, row.signedUrl);
  return urls;
}

/**
 * The artifacts a submission says it has, keeping only ones this intern
 * uploaded (anything else is dropped, never trusted).
 */
export function parseArtifacts(userId: string, raw: unknown): LabArtifacts | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const result: LabArtifacts = {};
  if (Array.isArray(value.screenshots)) {
    const shots = value.screenshots
      .map((shot) => (shot && typeof shot === "object" ? (shot as Record<string, unknown>) : {}))
      .filter((shot) => artifactOwner(shot.key) === userId && String(shot.key).endsWith(".webp"))
      .slice(0, 2)
      .map((shot) => ({
        key: String(shot.key),
        label: shot.label === "Phone" ? ("Phone" as const) : ("Desktop" as const),
        width: Math.max(1, Math.min(4000, Number(shot.width) || 1)),
        height: Math.max(1, Math.min(10000, Number(shot.height) || 1)),
      }));
    if (shots.length) result.screenshots = shots;
  }
  const snapshot = value.snapshot && typeof value.snapshot === "object" ? (value.snapshot as Record<string, unknown>) : null;
  if (snapshot && artifactOwner(snapshot.key) === userId && String(snapshot.key).endsWith(".zip")) {
    result.snapshot = { key: String(snapshot.key), bytes: Math.max(0, Number(snapshot.bytes) || 0) };
  }
  return result.screenshots || result.snapshot ? result : null;
}

export function artifactKeys(artifacts: unknown): string[] {
  if (!artifacts || typeof artifacts !== "object") return [];
  const value = artifacts as LabArtifacts;
  return [
    ...(value.screenshots ?? []).map((shot) => shot.key),
    ...(value.snapshot ? [value.snapshot.key] : []),
  ].filter((key) => artifactOwner(key));
}

/** Deletes artifacts no longer needed (a replaced or unused submission). */
export async function deleteArtifacts(keys: string[]) {
  if (!keys.length || !areArtifactsEnabled()) return;
  try {
    if (local()) {
      await Promise.all(keys.map((key) => rm(path.join(LOCAL_DIR, key), { force: true })));
      return;
    }
    await (await bucket()).remove(keys);
  } catch (error) {
    console.error("[lab-artifacts] Couldn't delete old artifacts.", error);
  }
}
