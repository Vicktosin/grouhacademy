// The graduation flyer's layout, as numbers, so the drawing (./render) and
// the tests use one source. Canvas: 2160 x 2700 px. The background, text,
// ring, confetti and cap are all in the template image
// (public/flyer-template.png); only the photo and the name are drawn.
// The finished look: public/flyer-sample.png. See components/graduation.

export const FLYER_WIDTH = 2160;
export const FLYER_HEIGHT = 2700;
export const FLYER_TEMPLATE_URL = "/flyer-template.png";

/** The grey circle in the template: the photo replaces it completely. */
export const PHOTO_CIRCLE = { x: 1080, y: 1460, radius: 608 } as const;

/** The placeholder person shown in the circle before a photo is chosen. */
export const SILHOUETTE = { background: "#D3DADE", figure: "#A7B3BC" } as const;

/** Where a detected face is placed (about). */
export const FACE_TARGET = { x: 1080, y: 1200 } as const;

/** Furthest the photo can be zoomed in, relative to just covering the circle. */
export const MAX_ZOOM = 4;

export const NAME_STYLE = {
  family: "Poppins",
  weight: 700,
  size: 128,
  minSize: 48,
  color: "#1E2327",
  x: FLYER_WIDTH / 2,
  /**
   * Top of the capitals. Taller letters (d, t, S) reach about y = 2340 and
   * the baseline sits near 2434, as in public/flyer-sample.png.
   */
  capTop: 2345,
  maxWidth: 1840,
} as const;

/** Small lines drawn on the template: under the logo, and under the name. */
export const FLYER_NOTES = {
  formerly: { text: "(formerly Grouh Academy)", weight: 500, size: 46, color: "#3A4248", x: 1080, baseline: 612 },
  website: { text: "www.grouhacademy.com/register", weight: 600, size: 56, color: "#0B7D54", x: 1080, gap: 44 },
} as const;

export const SHARE_CAPTION = "I just completed my internship program with Sabirole.";

/** Where the photo goes: a flyer point is photo point × scale + (x, y). */
export type Placement = { scale: number; x: number; y: number };

/** The scale at which the photo just covers the circle. */
export function coverScale(width: number, height: number) {
  const diameter = PHOTO_CIRCLE.radius * 2;
  return Math.max(diameter / width, diameter / height);
}

/**
 * Keeps the photo covering the whole circle: never smaller than the cover
 * scale (nor bigger than MAX_ZOOM times it), and never moved so far that
 * an edge shows inside the circle.
 */
export function clampPlacement(placement: Placement, width: number, height: number): Placement {
  const min = coverScale(width, height);
  const scale = Math.min(Math.max(placement.scale, min), min * MAX_ZOOM);
  const { x: cx, y: cy, radius: r } = PHOTO_CIRCLE;
  const clamp = (value: number, size: number, centre: number) =>
    Math.min(Math.max(value, centre + r - size * scale), centre - r);
  return { scale, x: clamp(placement.x, width, cx), y: clamp(placement.y, height, cy) };
}

/**
 * The starting placement: covering the circle, centred, or with the face
 * (its centre, in photo pixels) moved to about FACE_TARGET as far as the
 * photo allows.
 */
export function defaultPlacement(width: number, height: number, face?: { x: number; y: number } | null): Placement {
  const scale = coverScale(width, height);
  const centred = {
    scale,
    x: PHOTO_CIRCLE.x - (width * scale) / 2,
    y: PHOTO_CIRCLE.y - (height * scale) / 2,
  };
  if (!face) return centred;
  return clampPlacement({ scale, x: FACE_TARGET.x - face.x * scale, y: FACE_TARGET.y - face.y * scale }, width, height);
}

/** Zooms by `factor` around a flyer point, keeping the circle covered. */
export function zoomPlacement(
  placement: Placement,
  factor: number,
  around: { x: number; y: number },
  width: number,
  height: number,
): Placement {
  const wanted = clampPlacement({ ...placement, scale: placement.scale * factor }, width, height).scale;
  const actual = wanted / placement.scale;
  return clampPlacement(
    {
      scale: wanted,
      x: around.x - (around.x - placement.x) * actual,
      y: around.y - (around.y - placement.y) * actual,
    },
    width,
    height,
  );
}

/** The name's font size: NAME_STYLE.size, smaller only if it's too wide. */
export function fitNameSize(measure: (size: number) => number) {
  let size: number = NAME_STYLE.size;
  while (size > NAME_STYLE.minSize && measure(size) > NAME_STYLE.maxWidth) size -= 2;
  return size;
}

export function flyerFileName(name: string, extension = "png") {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `sabirole-graduation-${slug || "graduate"}.${extension}`;
}

/** Share links for when the device can't share the image file itself. */
export function shareLinks(flyerUrl: string | null) {
  const text = encodeURIComponent(flyerUrl ? `${SHARE_CAPTION} ${flyerUrl}` : SHARE_CAPTION);
  const url = encodeURIComponent(flyerUrl ?? "https://grouhacademy.com");
  return [
    { name: "WhatsApp", href: `https://wa.me/?text=${text}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    { name: "X", href: `https://x.com/intent/post?text=${text}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
  ];
}
