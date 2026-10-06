import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Lesson videos uploaded to a private Cloudflare R2 bucket. The database
// stores "r2:<object key>" in a lesson's or module's videoUrl; the bucket is
// never public, so every play or download goes through /api/video, which
// checks access and then redirects to a short-lived signed link.

export const R2_VIDEO_PREFIX = "r2:";

/** A single upload request can't exceed 5 GB (S3/R2 limit). */
export const MAX_VIDEO_BYTES = 5 * 1024 ** 3;

let client: S3Client | null = null;

function config() {
  const {
    R2_ACCOUNT_ID: accountId,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET: bucket,
  } = process.env;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function isR2Configured() {
  return config() !== null;
}

function r2() {
  const settings = config();
  if (!settings) throw new Error("Cloudflare R2 is not configured.");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    // Otherwise the SDK signs a checksum of an empty body into upload URLs,
    // and R2 rejects the browser's real file as not matching it.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return { client, bucket: settings.bucket };
}

export function r2KeyFromVideoUrl(videoUrl: string | null | undefined) {
  return videoUrl?.startsWith(R2_VIDEO_PREFIX)
    ? videoUrl.slice(R2_VIDEO_PREFIX.length)
    : null;
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-(?=\.)/g, "")
    .replace(/^-|-$/g, "")
    .slice(-80);
  return cleaned || "video.mp4";
}

/**
 * A signed PUT the browser uploads the file to directly, so large videos
 * never pass through this server. The Content-Type header sent with the
 * upload must match `contentType`.
 */
export async function createVideoUpload(
  folder: "courses" | "resources",
  fileName: string,
  contentType: string,
) {
  const { client, bucket } = r2();
  const key = `videos/${folder}/${randomUUID()}/${safeFileName(fileName)}`;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 60 * 60 },
  );
  return { uploadUrl, videoUrl: `${R2_VIDEO_PREFIX}${key}` };
}

/**
 * A signed GET for playback or (with `download`) a file download that
 * starts straight away instead of opening the video.
 */
export async function signedVideoUrl(key: string, download: boolean) {
  const { client, bucket } = r2();
  const fileName = key.split("/").pop() ?? "video.mp4";
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(download
        ? { ResponseContentDisposition: `attachment; filename="${fileName}"` }
        : {}),
    }),
    // Playback keeps fetching byte ranges while the video plays, so it
    // needs longer than a download, which only has to start in time.
    { expiresIn: download ? 10 * 60 : 4 * 60 * 60 },
  );
}
