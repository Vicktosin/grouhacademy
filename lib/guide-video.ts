import { driveId, parseUrl, youtubeId } from "@/lib/video-embed";

// The demo videos at the top of the Office Life and Practice Lab "How it
// works" guides: a YouTube or Google Drive link an admin pastes in.

/** The embeddable player for a saved link, or null (no link, or not YouTube/Drive). */
export function guideVideoEmbed(raw: string | null | undefined) {
  const url = raw ? parseUrl(raw) : null;
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  const youtube = youtubeId(url);
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&playsinline=1`;
  const drive = driveId(url);
  if (drive) {
    // Older link-shared files only open with their resource key.
    const key = url.searchParams.get("resourcekey");
    return `https://drive.google.com/file/d/${drive}/preview${key ? `?resourcekey=${encodeURIComponent(key)}` : ""}`;
  }
  return null;
}

/** An admin's input: empty clears the video; anything else must be YouTube or Drive. */
export function parseGuideVideoLink(raw: unknown): { url: string | null } | { error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { url: null };
  if (value.length > 500) return { error: "That link is too long." };
  if (!guideVideoEmbed(value)) return { error: "Paste a YouTube link or a Google Drive file link." };
  return { url: value };
}
