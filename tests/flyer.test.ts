import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HEAD,
  FLYER_HEIGHT,
  FLYER_WIDTH,
  MAX_ZOOM,
  PILLS,
  defaultPlacement,
  fitNameSize,
  flyerFileName,
  shareLinks,
  zoomPlacement,
} from "../lib/flyer/layout";
import {
  boxBlur,
  checkCutout,
  fadeFrameEdges,
  fillSmallHoles,
  findHead,
  keepFaceTerritory,
  keepHeadCorridor,
  largestComponent,
  mainFace,
  refineMask,
  resizeBilinear,
} from "../lib/flyer/mask";

/** A w×h mask with filled rectangles. */
function mask(w: number, h: number, rects: [number, number, number, number][]) {
  const m = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = 1;
  return m;
}
const count = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

test("the flyer is 1080 x 1350 with four narrowing pills", () => {
  assert.equal(FLYER_WIDTH, 1080);
  assert.equal(FLYER_HEIGHT, 1350);
  assert.deepEqual(PILLS.map((p) => p.color), ["#0B7D54", "#1F5FD1", "#F5A20A", "#3A3F44"]);
  for (let i = 1; i < PILLS.length; i++) {
    assert.ok(PILLS[i].width < PILLS[i - 1].width && PILLS[i].height < PILLS[i - 1].height, "each pill is smaller");
    // All centred on one line.
    assert.ok(Math.abs(PILLS[i].x + PILLS[i].width / 2 - (PILLS[0].x + PILLS[0].width / 2)) < 1e-9 + 30);
  }
});

test("the head goes to its default place and size; zoom stays within limits", () => {
  const head = { x: 300, y: 200, height: 440 };
  const p = defaultPlacement(head);
  assert.equal(p.scale, DEFAULT_HEAD.height / 440);
  assert.equal(head.x * p.scale + p.x, DEFAULT_HEAD.x);
  assert.equal(head.y * p.scale + p.y, DEFAULT_HEAD.y);
  // Zooming keeps the point zoomed around in place.
  const around = { x: 500, y: 400 };
  const z = zoomPlacement(p, 1.5, around, p);
  const before = { x: (around.x - p.x) / p.scale, y: (around.y - p.y) / p.scale };
  assert.ok(Math.abs(before.x * z.scale + z.x - around.x) < 1e-9);
  assert.equal(zoomPlacement(p, 100, around, p).scale, p.scale * MAX_ZOOM);
});

test("long names shrink to fit one line; file names and share links", () => {
  assert.equal(fitNameSize(() => 300), 64);
  assert.ok(fitNameSize((size) => size * 14) <= 50, "a long name gets smaller");
  assert.equal(fitNameSize(() => 5000), 30);
  assert.equal(flyerFileName("Adé  Obi-Okafor"), "sabirole-graduation-ade-obi-okafor.png");
  assert.equal(flyerFileName("!!!"), "sabirole-graduation-graduate.png");
  const links = shareLinks("https://x.supabase.co/f.png");
  assert.deepEqual(links.map((l) => l.name), ["WhatsApp", "LinkedIn", "X", "Facebook"]);
  assert.ok(links[0].href.includes(encodeURIComponent("I just completed my internship program with Sabirole.")));
  assert.deepEqual(shareLinks(null).map((l) => l.name), ["WhatsApp", "X"]);
});

test("only the largest person is kept; small holes are filled, real gaps stay", () => {
  const w = 40, h = 40;
  const m = mask(w, h, [[2, 2, 20, 30], [30, 30, 36, 36]]);
  const largest = largestComponent(m, w, h);
  assert.equal(largest.area, 18 * 28);
  assert.equal(largest.mask[32 * w + 32], 0, "the stray blob is dropped");

  const holey = mask(w, h, [[2, 2, 30, 30]]);
  holey[10 * w + 10] = 0; // a 1-pixel hole: filled
  for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) holey[y * w + x] = 0; // a big gap: kept
  const filled = fillSmallHoles(holey, w, h, 20);
  assert.equal(filled[10 * w + 10], 1);
  assert.equal(filled[20 * w + 20], 0);
});

test("the main face is the largest confident one; other people are cut away", () => {
  const w = 60, h = 40;
  const on = mask(w, h, [[0, 0, 60, 40]]);
  const big = { x: 5, y: 5, width: 12, height: 12, score: 0.9 };
  const unsure = { x: 30, y: 5, width: 20, height: 20, score: 0.35 };
  assert.equal(mainFace(on, w, h, [big, unsure]), big, "an unsure detection can't be the graduate");
  const territory = keepFaceTerritory(on, w, h, big, [unsure]);
  assert.equal(territory[10 * w + 8], 1);
  assert.equal(territory[10 * w + 45], 0, "the other person's side is removed");
  // Above the chin, only the head corridor stays.
  const corridor = keepHeadCorridor(on, w, h, big);
  assert.equal(corridor[0 * w + 40], 0);
  assert.equal(corridor[30 * w + 40], 1, "below the face is untouched");
});

test("refineMask keeps one soft-edged person; a confident blank photo has nobody", () => {
  const w = 64, h = 64;
  const confidence = new Float32Array(w * h);
  const lum = new Float32Array(w * h).fill(0.5);
  for (let y = 10; y < 64; y++) for (let x = 16; x < 48; x++) confidence[y * w + x] = 0.95;
  for (let y = 0; y < 6; y++) for (let x = 56; x < 62; x++) confidence[y * w + x] = 0.95; // stray blob
  const refined = refineMask(confidence, lum, w, h);
  assert.ok(refined);
  assert.equal(refined.alpha[3 * w + 58], 0, "the stray blob is transparent");
  assert.ok(refined.alpha[40 * w + 32] > 0.99, "inside is solid");
  const edge = refined.alpha[40 * w + 16];
  assert.ok(edge > 0 && edge < 1, "the edge is feathered");
  assert.equal(refineMask(new Float32Array(w * h), lum, w, h), null);
});

test("head, fades and the checks that refuse unusable photos", () => {
  const w = 400, h = 480;
  const person = mask(w, h, [[160, 80, 240, 200], [80, 200, 320, 480]]);
  const face = { x: 168, y: 120, width: 64, height: 72 };
  const head = findHead(person, w, h, face);
  assert.equal(head.top, 80);
  assert.equal(head.height, 112);
  const refined = { alpha: new Float32Array(w * h), person, area: count(person), box: { x: 80, y: 80, width: 240, height: 400 } };
  assert.equal(checkCutout(refined, face, head, w, h), null);
  assert.equal(checkCutout(null, face, head, w, h), "NO_PERSON");
  assert.equal(checkCutout(refined, null, null, w, h), "NO_PERSON");
  assert.equal(checkCutout(refined, { ...face, height: 4, width: 4 }, head, w, h), "TOO_SMALL");
  assert.equal(checkCutout(refined, face, { ...head, top: 0 }, w, h), "CUT_OFF", "hair cut by the top");
  assert.equal(checkCutout({ ...refined, box: { x: 160, y: 80, width: 80, height: 120 } }, face, head, w, h), "CUT_OFF", "only a head");

  // The person reaches the bottom edge: faded there, solid above.
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = person[i];
  const faded = fadeFrameEdges(alpha, person, w, h, 112);
  assert.equal(faded[(h - 1) * w + 200], 0);
  assert.equal(faded[250 * w + 200], 1);
});

test("blur and resize helpers", () => {
  const flat = new Float32Array(25).fill(0.7);
  assert.ok(boxBlur(flat, 5, 5, 2).every((v) => Math.abs(v - 0.7) < 1e-6));
  const small = new Float32Array([0, 1, 0, 1]);
  const big = resizeBilinear(small, 2, 2, 4, 4);
  assert.equal(big.length, 16);
  assert.ok(big.every((v) => v >= 0 && v <= 1));
});
