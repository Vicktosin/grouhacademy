import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  countR2Objects,
  getR2Object,
  isR2Configured,
  putR2Object,
  signedR2Url,
} from "@/lib/r2";
import { MEDIA_PREFIX, MAX_MEDIA_BYTES, mediaKey } from "@/lib/lab-media-shared";

// Where Practice Lab images (ad creatives) are kept: the private Cloudflare
// R2 bucket, never the database. R2 charges nothing for downloads, and
// images are viewed through short-lived links straight to R2, so neither
// this server nor the database sends their bytes.
//
// In local development without R2, images go to .lab-media/ (git-ignored)
// so the feature can be tried. Anywhere else without R2, uploads are off
// and interns describe their images in words instead.

/** Uploads one intern may keep in total (each is a few hundred KB at most). */
const MAX_IMAGES_PER_USER = 300;
const LOCAL_DIR = path.join(process.cwd(), ".lab-media");

const local = () => !isR2Configured() && process.env.NODE_ENV === "development";

export function isLabMediaEnabled() {
  return isR2Configured() || local();
}

const TYPES = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
} as const;

/** The image type from the file's first bytes (never trust the header alone). */
function sniff(bytes: Uint8Array): keyof typeof TYPES | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  return null;
}

export class MediaError extends Error {}

/** Checks and stores an uploaded image; returns its reference. */
export async function saveLabImage(userId: string, bytes: Uint8Array) {
  if (!isLabMediaEnabled()) throw new MediaError("Image uploads aren't set up yet. Describe your image instead.");
  if (!bytes.length || bytes.length > MAX_MEDIA_BYTES)
    throw new MediaError("Images must be under 600 KB. Try again; the page shrinks them for you.");
  const extension = sniff(bytes);
  if (!extension) throw new MediaError("Upload a JPG, PNG or WebP image.");

  const prefix = `lab-ads/${userId}/`;
  const used = local()
    ? (await readdir(path.join(LOCAL_DIR, prefix)).catch(() => [])).length
    : await countR2Objects(prefix, MAX_IMAGES_PER_USER + 1);
  if (used >= MAX_IMAGES_PER_USER)
    throw new MediaError("You've uploaded the most images allowed. Reuse one of your earlier images.");

  const key = `${prefix}${randomUUID()}.${extension}`;
  if (local()) {
    await mkdir(path.join(LOCAL_DIR, prefix), { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), bytes);
  } else {
    await putR2Object(key, bytes, TYPES[extension]);
  }
  return `${MEDIA_PREFIX}${key}`;
}

/** The image's bytes, for the AI to look at (null if it's gone). */
export async function readLabImage(ref: string) {
  const key = mediaKey(ref);
  if (!key || !isLabMediaEnabled()) return null;
  const type = TYPES[key.split(".").pop() as keyof typeof TYPES];
  if (local()) {
    const bytes = await readFile(path.join(LOCAL_DIR, key)).catch(() => null);
    return bytes ? { bytes: new Uint8Array(bytes), contentType: type } : null;
  }
  const object = await getR2Object(key);
  return object ? { bytes: object.bytes, contentType: type } : null;
}

/**
 * The response for viewing an image: a redirect to a short-lived R2 link
 * (the browser keeps it for half an hour), or the file in local development.
 */
export async function labImageResponse(key: string): Promise<Response> {
  if (local()) {
    const bytes = await readFile(path.join(LOCAL_DIR, key)).catch(() => null);
    if (!bytes) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[key.split(".").pop() as keyof typeof TYPES],
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }
  if (!isR2Configured()) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: await signedR2Url(key, 60 * 60),
      "Cache-Control": "private, max-age=1800",
    },
  });
}
