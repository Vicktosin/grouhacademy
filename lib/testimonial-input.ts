// Testimonial rules, pure so they can be tested (tests/testimonials.test.ts).
//
// A graduate shares their experience one of three ways: a video (uploaded to
// the cohort's Google Drive folder; we keep the link they paste), a voice
// note, or writing. Voice notes and graduation flyers are uploaded by their
// own routes to Supabase Storage (testimonial-media bucket, in the intern's
// own folder); this JSON form only ever carries the voice note's Storage URL,
// checked to be in that folder. No file, blob or data: URL is accepted here.

export const TESTIMONIAL_TEXT_MAX = 5000;
export const TESTIMONIAL_LINK_MAX = 2000;
export const TESTIMONIAL_TAG_MAX = 40;
export const TESTIMONIAL_MAX_TAGS = 10;

/** Public Storage bucket for flyers and voice notes (created on first use). */
export const TESTIMONIAL_MEDIA_BUCKET = "testimonial-media";
/** Largest upload a route accepts (Vercel functions cap bodies at 4.5 MB). */
export const MEDIA_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
export const FLYER_TYPES = ["image/jpeg", "image/png"] as const;
export const VOICE_NOTE_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
] as const;
export const VOICE_NOTE_MAX_SECONDS = 180;

export type MediaKind = "flyers" | "voice-notes";

/** Where an intern's flyers or voice notes live in the media bucket. */
export function mediaFolder(kind: MediaKind, userId: string) {
  return `${kind}/${userId}`;
}

/** The public URL prefix every one of this intern's files of a kind starts with. */
export function mediaUrlPrefix(supabaseUrl: string, kind: MediaKind, userId: string) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${TESTIMONIAL_MEDIA_BUCKET}/${mediaFolder(kind, userId)}/`;
}

/** The bare content type ("audio/webm;codecs=opus" → "audio/webm"). */
export function baseContentType(type: string | null | undefined) {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

export type TestimonialInput = {
  videoLink: string | null;
  voiceNoteUrl: string | null;
  testimonial: string;
  rating: number | null;
  consent: boolean;
};

export const TESTIMONIAL_FIELDS = ["videoLink", "voiceNoteUrl", "testimonial", "rating", "consent"] as const;

export const DRIVE_UPLOAD_INSTRUCTIONS =
  "Upload your video to our Google Drive folder and name the file with your full name and track.";

/** Only JSON bodies: a multipart (file upload) request is refused outright. */
export function isJsonRequest(contentType: string | null) {
  return baseContentType(contentType) === "application/json";
}

function isHttpLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** A Storage URL inside `prefix` (no query, fragment or "..": just a file). */
export function isOwnMediaUrl(url: string, prefix: string | null | undefined) {
  return (
    Boolean(prefix) &&
    url.startsWith(prefix!) &&
    url.length > prefix!.length &&
    url.length <= TESTIMONIAL_LINK_MAX &&
    isHttpLink(url) &&
    !/[?#/]|\.\./.test(url.slice(prefix!.length))
  );
}

/**
 * Reads the intern's experience. Returns exactly the known fields, nothing
 * else from the body, so nothing like a file can reach the database. At
 * least one of a video link, a voice note or writing is needed. A voice note
 * URL must be in `voiceNotePrefix` (the intern's own Storage folder); with no
 * prefix, none is accepted.
 */
export function parseTestimonialInput(
  body: unknown,
  { voiceNotePrefix }: { voiceNotePrefix?: string | null } = {},
): { ok: true; value: TestimonialInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, error: "Send the testimonial as JSON." };
  const value = body as Record<string, unknown>;

  const unexpected = Object.keys(value).filter(
    (key) => !(TESTIMONIAL_FIELDS as readonly string[]).includes(key),
  );
  if (unexpected.length)
    return {
      ok: false,
      error: `Only a video link, voice note, testimonial, rating and consent can be sent (not ${unexpected.join(", ")}). Upload videos to the Google Drive folder instead.`,
    };

  if (value.testimonial !== undefined && value.testimonial !== null && typeof value.testimonial !== "string")
    return { ok: false, error: "Write your testimonial as text." };
  const testimonial = typeof value.testimonial === "string" ? value.testimonial.trim() : "";
  if (testimonial.length > TESTIMONIAL_TEXT_MAX)
    return { ok: false, error: `Keep your testimonial under ${TESTIMONIAL_TEXT_MAX} characters.` };

  let rating: number | null = null;
  if (value.rating !== undefined && value.rating !== null) {
    const r = value.rating;
    if (typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > 10)
      return { ok: false, error: "Choose a rating from 1 to 10." };
    rating = r;
  }

  let videoLink: string | null = null;
  if (value.videoLink !== undefined && value.videoLink !== null && value.videoLink !== "") {
    if (typeof value.videoLink !== "string")
      return { ok: false, error: "Paste your video link as text." };
    const link = value.videoLink.trim();
    if (link && (link.length > TESTIMONIAL_LINK_MAX || !isHttpLink(link)))
      return { ok: false, error: "Paste a link that starts with https:// (e.g. your Google Drive video link)." };
    videoLink = link || null;
  }

  let voiceNoteUrl: string | null = null;
  if (value.voiceNoteUrl !== undefined && value.voiceNoteUrl !== null && value.voiceNoteUrl !== "") {
    if (typeof value.voiceNoteUrl !== "string" || !isOwnMediaUrl(value.voiceNoteUrl.trim(), voiceNotePrefix))
      return { ok: false, error: "Record your voice note with the button on this page." };
    voiceNoteUrl = value.voiceNoteUrl.trim();
  }

  if (!videoLink && !voiceNoteUrl && !testimonial)
    return { ok: false, error: "Share a video link, a voice note or a few written words." };

  if (value.consent !== undefined && typeof value.consent !== "boolean")
    return { ok: false, error: "Consent must be ticked or not." };

  return {
    ok: true,
    value: { videoLink, voiceNoteUrl, testimonial, rating, consent: value.consent === true },
  };
}

/** Tags an admin adds: trimmed, lowercase, unique, short. */
export function parseTestimonialTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) return null;
  const tags = [
    ...new Set(
      (value as string[])
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= TESTIMONIAL_TAG_MAX),
    ),
  ];
  return tags.length <= TESTIMONIAL_MAX_TAGS ? tags : null;
}

/** The intern's cohort folder, else the global one, else none. */
export function resolveDriveFolderUrl(
  cohortUrl: string | null | undefined,
  globalUrl: string | null | undefined,
) {
  return cohortUrl || globalUrl || null;
}

export type TestimonialCsvRow = {
  id: string;
  name: string;
  email: string;
  track: string;
  cohort: string | null;
  rating: number | null;
  testimonial: string;
  videoLink: string | null;
  voiceNoteUrl: string | null;
  flyerUrl: string | null;
  consent: boolean;
  status: string;
  tags: string[];
  submittedAt: string;
};

function csvCell(value: string) {
  // Spreadsheets run cells starting with = + - @ as formulas.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function testimonialsToCsv(rows: TestimonialCsvRow[]) {
  const header = [
    "Name", "Email", "Track", "Cohort", "Rating", "Testimonial",
    "Video link", "Voice note", "Flyer", "Consent to share", "Status", "Tags", "Submitted",
  ];
  const lines = rows.map((row) =>
    [
      row.name, row.email, row.track, row.cohort ?? "", row.rating === null ? "" : String(row.rating),
      row.testimonial, row.videoLink ?? "", row.voiceNoteUrl ?? "", row.flyerUrl ?? "",
      row.consent ? "Yes" : "No", row.status, row.tags.join("; "), row.submittedAt,
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
