// Testimonial form rules, pure so they can be tested
// (tests/testimonials.test.ts). Testimonials are TEXT ONLY: interns upload
// their video to the cohort's Google Drive folder themselves; we keep the
// optional link they paste, their words, a 1–10 rating and their consent.
// No file, blob or data: URL is ever accepted or stored.

export const TESTIMONIAL_TEXT_MAX = 5000;
export const TESTIMONIAL_LINK_MAX = 2000;
export const TESTIMONIAL_TAG_MAX = 40;
export const TESTIMONIAL_MAX_TAGS = 10;

export type TestimonialInput = {
  videoLink: string | null;
  testimonial: string;
  rating: number;
  consent: boolean;
};

export const TESTIMONIAL_FIELDS = ["videoLink", "testimonial", "rating", "consent"] as const;

export const DRIVE_UPLOAD_INSTRUCTIONS =
  "Upload your video here and name the file with your full name and track.";

/** Only JSON bodies: a multipart (file upload) request is refused outright. */
export function isJsonRequest(contentType: string | null) {
  return (contentType ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

function isHttpLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Reads the intern's form. Returns exactly the four text fields, nothing
 * else from the body, so nothing like a file can reach the database.
 */
export function parseTestimonialInput(
  body: unknown,
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
      error: `Only a video link, testimonial, rating and consent can be sent (not ${unexpected.join(", ")}). Upload videos to the Google Drive folder instead.`,
    };

  const testimonial = typeof value.testimonial === "string" ? value.testimonial.trim() : "";
  if (!testimonial) return { ok: false, error: "Write a few words about your internship." };
  if (testimonial.length > TESTIMONIAL_TEXT_MAX)
    return { ok: false, error: `Keep your testimonial under ${TESTIMONIAL_TEXT_MAX} characters.` };

  const rating = value.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 10)
    return { ok: false, error: "Choose a rating from 1 to 10." };

  let videoLink: string | null = null;
  if (value.videoLink !== undefined && value.videoLink !== null && value.videoLink !== "") {
    if (typeof value.videoLink !== "string")
      return { ok: false, error: "Paste your video link as text." };
    const link = value.videoLink.trim();
    if (link && (link.length > TESTIMONIAL_LINK_MAX || !isHttpLink(link)))
      return { ok: false, error: "Paste a link that starts with https:// (e.g. your Google Drive video link)." };
    videoLink = link || null;
  }

  if (value.consent !== undefined && typeof value.consent !== "boolean")
    return { ok: false, error: "Consent must be ticked or not." };

  return {
    ok: true,
    value: { videoLink, testimonial, rating, consent: value.consent === true },
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
  rating: number;
  testimonial: string;
  videoLink: string | null;
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
    "Video link", "Consent to share", "Status", "Tags", "Submitted",
  ];
  const lines = rows.map((row) =>
    [
      row.name, row.email, row.track, row.cohort ?? "", String(row.rating),
      row.testimonial, row.videoLink ?? "", row.consent ? "Yes" : "No",
      row.status, row.tags.join("; "), row.submittedAt,
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
