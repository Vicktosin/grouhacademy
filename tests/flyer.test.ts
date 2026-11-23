import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  FACE_TARGET,
  FLYER_HEIGHT,
  FLYER_NOTES,
  FLYER_WIDTH,
  MAX_ZOOM,
  NAME_STYLE,
  PHOTO_CIRCLE,
  SHARE_CAPTION,
  clampPlacement,
  coverScale,
  defaultPlacement,
  fitNameSize,
  flyerFileName,
  shareLinks,
  zoomPlacement,
  type Placement,
} from "../lib/flyer/layout";
import { PHOTO_MAX_BYTES, checkPhotoFile } from "../lib/flyer/photo";

/** The photo (w × h at this placement) covers the whole circle. */
function covers(p: Placement, w: number, h: number) {
  const { x, y, radius: r } = PHOTO_CIRCLE;
  const eps = 1e-6;
  return p.x <= x - r + eps && p.y <= y - r + eps && p.x + w * p.scale >= x + r - eps && p.y + h * p.scale >= y + r - eps;
}

test("the flyer is 2160 x 2700, the size of the template", () => {
  assert.equal(FLYER_WIDTH, 2160);
  assert.equal(FLYER_HEIGHT, 2700);
  const png = readFileSync(path.join(__dirname, "..", "public", "flyer-template.png"));
  assert.equal(png.readUInt32BE(16), 2160);
  assert.equal(png.readUInt32BE(20), 2700);
  assert.deepEqual(PHOTO_CIRCLE, { x: 1080, y: 1460, radius: 608 });
});

test("photos are scaled to cover the circle, centred, without stretching", () => {
  for (const [w, h] of [[4000, 3000], [3000, 4000], [1000, 1000], [500, 2000]]) {
    const p = defaultPlacement(w, h);
    assert.ok(covers(p, w, h), `${w}x${h} covers`);
    assert.equal(p.scale, coverScale(w, h));
    // The short side exactly spans the circle.
    assert.equal(Math.min(w, h) * p.scale, PHOTO_CIRCLE.radius * 2);
    assert.ok(Math.abs(p.x + (w * p.scale) / 2 - PHOTO_CIRCLE.x) < 1e-6);
    assert.ok(Math.abs(p.y + (h * p.scale) / 2 - PHOTO_CIRCLE.y) < 1e-6);
  }
});

test("a detected face moves to about (1080, 1200) as far as the photo allows", () => {
  // Portrait photo: room to move up and down.
  const w = 3000, h = 4000;
  const face = { x: 1500, y: 1400 };
  const p = defaultPlacement(w, h, face);
  assert.ok(covers(p, w, h));
  assert.ok(Math.abs(face.x * p.scale + p.x - FACE_TARGET.x) < 1e-6);
  assert.ok(Math.abs(face.y * p.scale + p.y - FACE_TARGET.y) < 1e-6);
  // A face at the very top of a landscape photo: clamped, still covering.
  const q = defaultPlacement(4000, 3000, { x: 3900, y: 10 });
  assert.ok(covers(q, 4000, 3000));
});

test("dragging and zooming never leave a gap in the circle", () => {
  const w = 1200, h = 1600;
  const base = defaultPlacement(w, h);
  assert.ok(covers(clampPlacement({ ...base, x: base.x + 5000 }, w, h), w, h));
  assert.ok(covers(clampPlacement({ ...base, y: base.y - 5000 }, w, h), w, h));
  const out = zoomPlacement(base, 0.2, { x: 1080, y: 1460 }, w, h);
  assert.equal(out.scale, coverScale(w, h));
  assert.ok(covers(out, w, h));
  const big = zoomPlacement(base, 100, { x: 900, y: 1000 }, w, h);
  assert.ok(Math.abs(big.scale - coverScale(w, h) * MAX_ZOOM) < 1e-9);
  assert.ok(covers(big, w, h));
  // Zooming keeps the point under the fingers still.
  const z = zoomPlacement(base, 2, { x: 1080, y: 1460 }, w, h);
  const before = { x: (1080 - base.x) / base.scale, y: (1460 - base.y) / base.scale };
  assert.ok(Math.abs(before.x * z.scale + z.x - 1080) < 1e-6);
  assert.ok(Math.abs(before.y * z.scale + z.y - 1460) < 1e-6);
});

test("the name is Poppins Bold 128px, smaller only when wider than 1840px", () => {
  assert.equal(NAME_STYLE.family, "Poppins");
  assert.equal(NAME_STYLE.weight, 700);
  assert.equal(NAME_STYLE.color, "#1E2327");
  assert.equal(NAME_STYLE.x, 1080);
  assert.equal(fitNameSize(() => 900), 128);
  const perPx = 30; // a name 30 × size wide
  const size = fitNameSize((s) => s * perPx);
  assert.ok(size * perPx <= NAME_STYLE.maxWidth && size < 128);
});

test("photo files: JPG, PNG or WEBP up to 10 MB", () => {
  assert.equal(checkPhotoFile({ type: "image/jpeg", name: "a.jpg", size: 1000 }), null);
  assert.equal(checkPhotoFile({ type: "image/webp", name: "a.webp", size: PHOTO_MAX_BYTES }), null);
  assert.equal(checkPhotoFile({ type: "image/heic", name: "a.heic", size: 1000 }), "UNSUPPORTED_TYPE");
  assert.equal(checkPhotoFile({ type: "", name: "photo.PNG", size: 1000 }), null);
  assert.equal(checkPhotoFile({ type: "image/png", name: "a.png", size: PHOTO_MAX_BYTES + 1 }), "TOO_LARGE");
});

test("download name and share caption", () => {
  assert.equal(flyerFileName("Adé  Okafor-Jones"), "sabirole-graduation-ade-okafor-jones.png");
  assert.equal(SHARE_CAPTION, "I just completed my internship program with Sabirole.");
  assert.doesNotMatch(SHARE_CAPTION, /job|hired|offer|employ/i);
  const names = shareLinks("https://x.supabase.co/f.png").map((l) => l.name);
  assert.deepEqual(names, ["WhatsApp", "LinkedIn", "X", "Facebook"]);
});

test("the flyer says Sabirole was Grouh Academy, and where to register", () => {
  assert.equal(FLYER_NOTES.formerly.text, "(formerly Grouh Academy)");
  assert.equal(FLYER_NOTES.website.text, "www.sabirole.com/register");
});
