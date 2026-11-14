// The graduation flyer's design (approved design: public/flyer-sample.png),
// as numbers, so the drawing (./render) and tests use one source.
// Canvas: 1080 x 1350 px. See components/graduation.

export const FLYER_WIDTH = 1080;
export const FLYER_HEIGHT = 1350;

export const FLYER_COLORS = {
  background: "#EAF4EE",
  maze: "rgba(255, 255, 255, 0.8)",
  glow: "11, 125, 84", // #0B7D54, as rgb for the gradient
  ring: "#C3CACE",
  intro: "#3A4248",
  sabi: "#12306B",
  role: "#0B7D54",
  name: "#1E2327",
} as const;

/** Thick white angular lines (44px, square corners), as point lists. */
export const MAZE_LINES: [number, number][][] = [
  // M 260 -40 V 190 H 560 V 60 H 830 V 340 H 1120
  [[260, -40], [260, 190], [560, 190], [560, 60], [830, 60], [830, 340], [1120, 340]],
  // M -40 610 H 150 V 390 H 330 V 900 H 80 V 1130 H 420 V 1390
  [[-40, 610], [150, 610], [150, 390], [330, 390], [330, 900], [80, 900], [80, 1130], [420, 1130], [420, 1390]],
  // M 1120 570 H 900 V 830 H 1010 V 1100 H 760 V 1390
  [[1120, 570], [900, 570], [900, 830], [1010, 830], [1010, 1100], [760, 1100], [760, 1390]],
];
export const MAZE_WIDTH = 44;

export const GLOW = { x: 1000, y: 430, radius: 560, opacity: 0.34 };

export const RINGS = [
  { x: -30, y: 20, radius: 150 },
  { x: 1080, y: 1350, radius: 265 },
];
export const RING_WIDTH = 38;

/** The funnel group: translated, then rotated (degrees). */
export const PILL_GROUP = { x: 600, y: 770, rotation: -35 };

export type Pill = { color: string; x: number; y: number; width: number; height: number };

/** In the group's local coordinates; fully rounded ends (radius = h / 2). */
export const PILLS: Pill[] = [
  { color: "#0B7D54", x: -340, y: -289, width: 680, height: 180 },
  { color: "#1F5FD1", x: -265, y: -93, width: 530, height: 135 },
  { color: "#F5A20A", x: -230, y: 58, width: 460, height: 115 },
  { color: "#3A3F44", x: -180, y: 189, width: 360, height: 100 },
];

/** Above the green pill (local coordinates): where the head rises out. */
export const POP_OUT = { x: -150, y: -900, width: 470, height: 701 };

/** Where the head goes by default: centre and height (top of hair to chin). */
export const DEFAULT_HEAD = { x: 517, y: 446, height: 220 };

export const FLYER_TEXT = {
  introLines: ["I just completed my", "internship program with"],
  introSize: 36,
  // Canvas "top" is the font's em box: these match the approved design.
  introTop: 75,
  introLineHeight: 52,
  brandSize: 104,
  /** Gap between the last intro line's box and the brand's top. */
  brandGap: 13,
  brand: ["Sabi", "role"] as const,
  nameX: 80,
  nameBaseline: FLYER_HEIGHT - 86,
  nameSize: 64,
  nameMinSize: 30,
  nameMaxWidth: 700,
};

export const SHARE_CAPTION = "I just completed my internship program with Sabirole.";

/**
 * Where the cut-out goes on the flyer: a flyer point is
 * cut-out point × scale + (x, y).
 */
export type Placement = { scale: number; x: number; y: number };

/** The head (in cut-out pixels): centre and height, top of hair to chin. */
export type Head = { x: number; y: number; height: number };

/** Puts the head at DEFAULT_HEAD's place and size. */
export function defaultPlacement(head: Head): Placement {
  const scale = DEFAULT_HEAD.height / Math.max(1, head.height);
  return { scale, x: DEFAULT_HEAD.x - head.x * scale, y: DEFAULT_HEAD.y - head.y * scale };
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;

/**
 * Zooms by `factor` around a flyer point (e.g. the pinch or the head), keeping
 * the zoom within MIN_ZOOM..MAX_ZOOM of `base` (the default placement).
 */
export function zoomPlacement(p: Placement, factor: number, around: { x: number; y: number }, base: Placement): Placement {
  const scale = Math.min(base.scale * MAX_ZOOM, Math.max(base.scale * MIN_ZOOM, p.scale * factor));
  const f = scale / p.scale;
  return { scale, x: around.x - (around.x - p.x) * f, y: around.y - (around.y - p.y) * f };
}

/** The largest name size (down from 64) whose width fits on one line. */
export function fitNameSize(measure: (size: number) => number) {
  for (let size = FLYER_TEXT.nameSize; size > FLYER_TEXT.nameMinSize; size -= 2)
    if (measure(size) <= FLYER_TEXT.nameMaxWidth) return size;
  return FLYER_TEXT.nameMinSize;
}

/** "sabirole-graduation-ada-obi.png" */
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

/** Share links for when the browser can't share files. */
export function shareLinks(flyerUrl: string | null) {
  const text = encodeURIComponent(flyerUrl ? `${SHARE_CAPTION} ${flyerUrl}` : SHARE_CAPTION);
  const url = flyerUrl ? encodeURIComponent(flyerUrl) : null;
  return [
    { name: "WhatsApp", href: `https://wa.me/?text=${text}` },
    ...(url ? [{ name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` }] : []),
    { name: "X", href: `https://x.com/intent/post?text=${text}` },
    ...(url ? [{ name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}` }] : []),
  ];
}
