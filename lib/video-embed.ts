// Turns whatever video link an instructor pastes into something a browser
// can actually play. YouTube and Vimeo refuse to load their normal pages
// inside another site, so their links must become embed URLs.

export type LessonMedia =
  /** YouTube embed; supports the player's custom controls (JS API). */
  | { kind: "youtube"; src: string }
  /** Google Drive preview player; the file can also be downloaded. */
  | { kind: "drive"; src: string; downloadUrl: string }
  /** Another embeddable player (e.g. Vimeo). */
  | { kind: "embed"; src: string }
  /**
   * A video file the browser plays itself (MP4, WebM, …). Uploaded videos
   * also have a download link that starts the download in place.
   */
  | { kind: "file"; src: string; downloadUrl?: string };

const UPLOADED_PREFIX = "r2:";
const VIDEO_API = "/api/video?";

/**
 * The player-facing link for a lesson's or module's saved videoUrl. Uploaded
 * videos (stored as "r2:<key>") are served through /api/video, which checks
 * access; pasted links are returned unchanged.
 */
export function lessonVideoSrc(
  videoUrl: string | null,
  source: "course" | "resource",
  type: "lesson" | "module",
  id: string,
) {
  if (!videoUrl?.startsWith(UPLOADED_PREFIX)) return videoUrl;
  return `${VIDEO_API}${new URLSearchParams({ source, type, id })}`;
}

/** True for a videoUrl that refers to an uploaded file. */
export function isUploadedVideo(videoUrl: string) {
  return videoUrl.startsWith(UPLOADED_PREFIX);
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIDEO_FILE = /\.(mp4|webm|ogg|ogv|mov|m4v)$/i;

function parseUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    // Links pasted without a scheme ("youtube.com/watch?v=…") would
    // otherwise be treated as pages on this site.
    return new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`,
    );
  } catch {
    return null;
  }
}

/** "1m30s", "90s" or "90" → seconds. */
function startSeconds(value: string | null) {
  if (!value) return 0;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value);
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function youtubeId(url: URL) {
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  if (host === "youtu.be") id = parts[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v") ?? undefined;
    else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

const DRIVE_ID = /^[A-Za-z0-9_-]{20,}$/;

function driveId(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "drive.google.com" && host !== "docs.google.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // ".../file/d/<id>/view" share links, or "open?id=" / "uc?id=" links.
  const fileIndex = parts.indexOf("file");
  const id =
    fileIndex !== -1 && parts[fileIndex + 1] === "d"
      ? parts[fileIndex + 2]
      : url.searchParams.get("id");
  return id && DRIVE_ID.test(id) ? id : null;
}

export function resolveLessonMedia(
  raw: string | null | undefined,
  origin?: string,
): LessonMedia | null {
  if (!raw) return null;
  if (raw.startsWith(VIDEO_API))
    return { kind: "file", src: raw, downloadUrl: `${raw}&download=1` };
  const url = parseUrl(raw);
  if (!url || !/^https?:$/.test(url.protocol)) return null;

  const id = youtubeId(url);
  if (id) {
    const params = new URLSearchParams({
      autoplay: "1",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      iv_load_policy: "3",
      fs: "0",
      disablekb: "1",
      playsinline: "1",
      enablejsapi: "1",
    });
    const start = startSeconds(
      url.searchParams.get("t") ?? url.searchParams.get("start"),
    );
    if (start) params.set("start", String(start));
    if (origin) params.set("origin", origin);
    return {
      kind: "youtube",
      src: `https://www.youtube.com/embed/${id}?${params}`,
    };
  }

  // Drive's "/view" page refuses to load inside other sites; "/preview"
  // is its embeddable player.
  const fileId = driveId(url);
  if (fileId) {
    // Older link-shared files only open with their resource key.
    const resourceKey = url.searchParams.get("resourcekey");
    const keyParam = resourceKey
      ? `resourcekey=${encodeURIComponent(resourceKey)}`
      : "";
    return {
      kind: "drive",
      src: `https://drive.google.com/file/d/${fileId}/preview${keyParam ? `?${keyParam}` : ""}`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}${keyParam ? `&${keyParam}` : ""}`,
    };
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "vimeo.com") {
    const vimeoId = url.pathname.split("/").filter(Boolean)[0];
    if (vimeoId && /^\d+$/.test(vimeoId))
      return {
        kind: "embed",
        src: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
      };
  }
  if (host === "player.vimeo.com")
    return { kind: "embed", src: url.toString() };

  if (VIDEO_FILE.test(url.pathname))
    return { kind: "file", src: url.toString() };

  // Anything else: try it as an embed.
  return { kind: "embed", src: url.toString() };
}
