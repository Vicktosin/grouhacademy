// Turning a segmentation model's person confidence into a clean cut-out.
// Pure functions on plain arrays (no DOM), run in the flyer's Web Worker
// (./segmentation.worker) and tested in tests/flyer.test.ts.
//
// Steps (refineCutout): sharpen the model's low-resolution mask along the
// photo's own edges (guided filter), keep only the largest person (drops
// other people and stray blobs), fill small holes, feather the edge 1–2px,
// then build an evened-out greyscale picture whose edge pixels take their
// tone from inside the person (no fringe of the old background).

export type Box = { x: number; y: number; width: number; height: number };
/** A detected face: its box and the detector's confidence (0–1). */
export type Face = Box & { score: number };

/** Only a confident detection can be the graduate's face. */
export const MAIN_FACE_SCORE = 0.5;

/** Box blur (mean over a (2r+1)² window, edges clamped). O(n) for any r. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / size;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Guided filter (He et al.): smooths `p` (the mask) while following the
 * edges of `guide` (the photo's luminance, 0–1), so a blurry upscaled mask
 * snaps to the real outline of hair and shoulders.
 */
export function guidedFilter(guide: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number) {
  const n = w * h;
  const ip = new Float32Array(n);
  const ii = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ip[i] = guide[i] * p[i];
    ii[i] = guide[i] * guide[i];
  }
  const meanI = boxBlur(guide, w, h, r);
  const meanP = boxBlur(p, w, h, r);
  const corrIp = boxBlur(ip, w, h, r);
  const corrIi = boxBlur(ii, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrIi[i] - meanI[i] * meanI[i];
    const covIp = corrIp[i] - meanI[i] * meanP[i];
    a[i] = covIp / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxBlur(a, w, h, r);
  const meanB = boxBlur(b, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  return out;
}

/** The largest 4-connected region of `on` pixels: its mask, area and box. */
export function largestComponent(on: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = { label: 0, area: 0, box: { x: 0, y: 0, width: 0, height: 0 } };
  let next = 0;
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || labels[start]) continue;
    next++;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    let area = 0;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    while (top) {
      const i = stack[--top];
      area++;
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && on[i - 1] && !labels[i - 1]) { labels[i - 1] = next; stack[top++] = i - 1; }
      if (x < w - 1 && on[i + 1] && !labels[i + 1]) { labels[i + 1] = next; stack[top++] = i + 1; }
      if (y > 0 && on[i - w] && !labels[i - w]) { labels[i - w] = next; stack[top++] = i - w; }
      if (y < h - 1 && on[i + w] && !labels[i + w]) { labels[i + w] = next; stack[top++] = i + w; }
    }
    if (area > best.area)
      best = { label: next, area, box: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
  }
  const mask = new Uint8Array(w * h);
  if (best.area) for (let i = 0; i < mask.length; i++) mask[i] = labels[i] === best.label ? 1 : 0;
  return { mask, area: best.area, box: best.box };
}

/**
 * Fills holes (background regions not connected to the image border) of at
 * most `maxArea` pixels. Bigger enclosed gaps (e.g. between an arm and the
 * body) are real background and stay.
 */
export function fillSmallHoles(mask: Uint8Array, w: number, h: number, maxArea: number) {
  const off = new Uint8Array(w * h);
  for (let i = 0; i < off.length; i++) off[i] = mask[i] ? 0 : 1;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const out = mask.slice();
  const region: number[] = [];
  for (let start = 0; start < off.length; start++) {
    if (!off[start] || seen[start]) continue;
    let top = 0;
    let touchesBorder = false;
    region.length = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      region.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
      if (x > 0 && off[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && off[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && off[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && off[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (!touchesBorder && region.length <= maxArea) for (const i of region) out[i] = 1;
  }
  return out;
}

/** Pixels within r of a set pixel. */
export function dilate(mask: Uint8Array, w: number, h: number, r: number) {
  const f = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) f[i] = mask[i];
  const blurred = boxBlur(f, w, h, r);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = blurred[i] > 1e-6 ? 1 : 0;
  return out;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Rec. 601 luma of RGBA pixels, 0–1. */
export function luminance(rgba: Uint8ClampedArray | Uint8Array, n: number) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
  return out;
}

export type RefinedMask = {
  /** 0–1 opacity of the person, per pixel. */
  alpha: Float32Array;
  /** The kept person's pixels (before feathering). */
  person: Uint8Array;
  area: number;
  box: Box;
};

/**
 * Splits people who touch (a group selfie): each pixel belongs to the
 * nearest face, measured in face widths, with distance below a face counted
 * less (a body hangs below its face). Keeps only `main`'s territory.
 */
export function keepFaceTerritory(on: Uint8Array, w: number, h: number, main: Box, others: Box[]) {
  if (!others.length) return on;
  const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2, s: Math.max(1, b.width) });
  const m = centre(main);
  const rest = others.map(centre);
  const distance = (c: { x: number; y: number; s: number }, x: number, y: number) => {
    const dx = x - c.x;
    const dy = y - c.y;
    return Math.hypot(dx, dy > 0 ? dy * 0.45 : dy) / c.s;
  };
  const out = new Uint8Array(on.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!on[i]) continue;
      const mine = distance(m, x, y);
      out[i] = rest.every((c) => mine <= distance(c, x, y)) ? 1 : 0;
    }
  return out;
}

/**
 * Above the chin, a person is only their head: keeps a head-shaped corridor
 * around the face (hair included) and drops anything else up there, such as
 * people standing behind whose faces were too small to detect.
 */
export function keepHeadCorridor(
  on: Uint8Array,
  w: number,
  h: number,
  face: Box,
  clothes: Float32Array | null = null,
) {
  const out = on.slice();
  // Down to about the mouth: shoulders can rise above the chin when the
  // head is tilted back.
  const chin = face.y + face.height * 0.75;
  const top = face.y - face.height * 0.8;
  const left = face.x - face.width * 0.4;
  const right = face.x + face.width * 1.4;
  for (let y = 0; y < Math.min(h, Math.ceil(chin)); y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // Beside the face (not on it, and not above it, where hats and
      // graduation caps sit) a person is hair: clothing there is someone
      // standing behind.
      const besideFace = y >= face.y && (x < face.x || x > face.x + face.width);
      if (y < top || x < left || x > right || (besideFace && clothes && clothes[i] > 0.5)) out[i] = 0;
    }
  return out;
}

/** The face of the person to keep: the largest confident one on a person. */
export function mainFace(on: Uint8Array, w: number, h: number, faces: Face[]) {
  let best: Face | null = null;
  for (const face of faces) {
    if (face.score < MAIN_FACE_SCORE || faceOverlap(on, w, h, face) < 0.5) continue;
    if (!best || face.width * face.height > best.width * best.height) best = face;
  }
  return best;
}

/**
 * Cleans the model's person confidence (0–1, at the photo's size) into a
 * soft alpha matte of one person: the one with the largest face (others
 * touching them are cut away), else the largest region. Null if nobody.
 */
export function refineMask(
  confidence: Float32Array,
  lum: Float32Array,
  w: number,
  h: number,
  faces: Face[] = [],
  /** The model's confidence that a pixel is clothing (if it has classes). */
  clothes: Float32Array | null = null,
): (RefinedMask & { face: Face | null }) | null {
  const n = w * h;
  // The model works at 256 px: refine along the photo's own edges.
  const radius = Math.max(2, Math.round(Math.max(w, h) / 256));
  const refined = guidedFilter(lum, confidence, w, h, radius * 2, 1e-3);

  // The filter may only move edges near where the model saw a person,
  // never add new regions of similar-looking background.
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) seen[i] = confidence[i] >= 0.5 ? 1 : 0;
  const allowed = dilate(seen, w, h, radius * 2);
  let on: Uint8Array = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = refined[i] >= 0.5 && allowed[i] ? 1 : 0;
  const face = mainFace(on, w, h, faces);
  if (face) {
    // Other people's faces are about level with or above the graduate's
    // chin and don't overlap their face; a "face" lower down is the
    // detector seeing one in clothing, one overlapping is a duplicate.
    const inside = (f: Box) => {
      const cx = f.x + f.width / 2;
      const cy = f.y + f.height / 2;
      return cx > face.x && cx < face.x + face.width && cy > face.y && cy < face.y + face.height;
    };
    const others = faces.filter((f) => f !== face && f.y < face.y + face.height && !inside(f));
    on = keepFaceTerritory(on, w, h, face, others);
    on = keepHeadCorridor(on, w, h, face, clothes);
  }
  const largest = largestComponent(on, w, h);
  if (!largest.area) return null;
  const person = fillSmallHoles(largest.mask, w, h, Math.max(64, largest.area * 0.01));

  // Soft edge only near the kept person; anything else (other people,
  // blobs) is fully transparent.
  const near = dilate(person, w, h, radius);
  const soft = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!near[i]) continue;
    soft[i] = person[i] && !largest.mask[i] ? 1 : smoothstep(0.3, 0.7, refined[i]);
  }
  // Feather ~1.5 px.
  const alpha = boxBlur(boxBlur(soft, w, h, 1), w, h, 1);
  return {
    alpha,
    person,
    area: largest.area,
    box: largest.box,
    // The face must still be on the kept person.
    face: face && faceOverlap(person, w, h, face) >= 0.5 ? face : null,
  };
}

/**
 * Greyscale picture of the person: tone evened out (stretch to the person's
 * own 2nd–98th percentile, gentle gamma towards a mid-grey average), and
 * edge pixels coloured from the person's inside (removes fringes of the old
 * background). Returns 0–255 grey values.
 */
export function evenGrey(lum: Float32Array, alpha: Float32Array, w: number, h: number) {
  const n = w * h;
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] < 0.5) continue;
    histogram[Math.min(255, Math.round(lum[i] * 255))]++;
    count++;
  }
  const percentile = (p: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= count * p) return v / 255;
    }
    return 1;
  };
  const low = count ? percentile(0.02) : 0;
  const high = count ? Math.max(low + 0.1, percentile(0.98)) : 1;
  const median = count ? (percentile(0.5) - low) / (high - low) : 0.5;
  // Gentle: move the median at most part of the way to 0.5.
  const gamma = Math.min(1.35, Math.max(0.75, Math.log(0.5) / Math.log(Math.min(0.95, Math.max(0.05, median)))));

  // Edge pixels take the tone of the solid person nearby.
  const inner = new Float32Array(n);
  const weighted = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    inner[i] = alpha[i] > 0.97 ? 1 : 0;
    weighted[i] = inner[i] * lum[i];
  }
  const r = Math.max(3, Math.round(Math.max(w, h) / 300));
  const num = boxBlur(weighted, w, h, r);
  const den = boxBlur(inner, w, h, r);

  const grey = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    let l = lum[i];
    if (alpha[i] < 0.97 && den[i] > 0.02) l = num[i] / den[i];
    const stretched = Math.min(1, Math.max(0, (l - low) / (high - low)));
    grey[i] = Math.round(Math.pow(stretched, gamma) * 235 + 10);
  }
  return grey;
}

/**
 * The head: top of hair (first person row above the face, within the
 * face's middle columns) to the chin (bottom of the face box).
 */
export function findHead(person: Uint8Array, w: number, h: number, face: Box) {
  const x0 = Math.max(0, Math.round(face.x + face.width * 0.2));
  const x1 = Math.min(w - 1, Math.round(face.x + face.width * 0.8));
  let top = Math.max(0, Math.round(face.y));
  for (let y = top; y >= 0; y--) {
    let any = false;
    for (let x = x0; x <= x1 && !any; x++) any = person[y * w + x] === 1;
    if (!any) break;
    top = y;
  }
  const chin = Math.min(h - 1, face.y + face.height);
  return { x: face.x + face.width / 2, y: (top + chin) / 2, height: chin - top, top };
}

export type CutoutProblem = "NO_PERSON" | "TOO_SMALL" | "CUT_OFF";

/** Whether the person and face are usable for the flyer. */
export function checkCutout(
  refined: RefinedMask | null,
  face: Box | null,
  head: { top: number; height: number } | null,
  w: number,
  h: number,
): CutoutProblem | null {
  if (!refined || refined.area < w * h * 0.02 || !face || !head) return "NO_PERSON";
  if (face.height < Math.max(40, h * 0.05)) return "TOO_SMALL";
  const margin = Math.min(w, h) * 0.005;
  if (face.x < margin || face.y < margin || face.x + face.width > w - margin) return "CUT_OFF";
  // Hair cut by the top of the photo.
  if (head.top <= 1) return "CUT_OFF";
  // Little more than a head: no shoulders to fill the flyer.
  const chin = face.y + face.height;
  if (refined.box.y + refined.box.height - chin < head.height * 0.5) return "CUT_OFF";
  return null;
}

/** Overlap of a face box with the person, as a share of the box. */
export function faceOverlap(person: Uint8Array, w: number, h: number, face: Box) {
  let inside = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(face.width, face.height) / 24));
  for (let y = Math.max(0, Math.floor(face.y)); y < Math.min(h, face.y + face.height); y += step)
    for (let x = Math.max(0, Math.floor(face.x)); x < Math.min(w, face.x + face.width); x += step) {
      total++;
      inside += person[y * w + x];
    }
  return total ? inside / total : 0;
}

/** Bilinear resize of a single-channel image (masks come at model size). */
export function resizeBilinear(src: Float32Array, sw: number, sh: number, dw: number, dh: number) {
  if (sw === dw && sh === dh) return src;
  const out = new Float32Array(dw * dh);
  const fx = sw / dw;
  const fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = sx - x0;
      const top = src[y0 * sw + x0] * (1 - tx) + src[y0 * sw + x1] * tx;
      const bottom = src[y1 * sw + x0] * (1 - tx) + src[y1 * sw + x1] * tx;
      out[y * dw + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return out;
}

/**
 * Where the photo's frame cuts through the person (bottom, left or right
 * edge; a cut-off head is refused instead), fades them out towards that
 * edge, so the flyer shows a soft end rather than a straight line.
 */
export function fadeFrameEdges(alpha: Float32Array, person: Uint8Array, w: number, h: number, headHeight: number) {
  // Long and soft (half a head), so it reads as a gentle fade.
  const band = Math.max(8, Math.round(headHeight * 0.5));
  const touches = (count: number, length: number) => count > length * 0.02;
  let bottom = 0, left = 0, right = 0;
  for (let x = 0; x < w; x++) bottom += person[(h - 1) * w + x];
  for (let y = 0; y < h; y++) {
    left += person[y * w];
    right += person[y * w + w - 1];
  }
  const fade = { bottom: touches(bottom, w), left: touches(left, h), right: touches(right, h) };
  if (!fade.bottom && !fade.left && !fade.right) return alpha;
  const out = alpha.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let d = band;
      if (fade.bottom) d = Math.min(d, h - 1 - y);
      if (fade.left) d = Math.min(d, x);
      if (fade.right) d = Math.min(d, w - 1 - x);
      if (d < band) out[y * w + x] *= smoothstep(0, band, d);
    }
  return out;
}
