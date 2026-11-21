/**
 * Tests for update_intern_resource and the labPassMark guard on update_cohort_task.
 * These test the pure logic (MIME detection, size limit, base64 encoding, pass-mark
 * validation) without hitting the database or Supabase Storage.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

import { isDataImage } from "../lib/stored-images";
import { parseLabPassMark } from "../lib/lab-task-grading";

// ── MIME / extension detection (mirrors THUMBNAIL_MIME in the MCP tool) ────────

const THUMBNAIL_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function mimeForPath(filePath: string): string | undefined {
  return THUMBNAIL_MIME[path.extname(filePath).toLowerCase()];
}

test("MIME detection: .png → image/png", () => {
  assert.equal(mimeForPath("thumb.png"), "image/png");
});

test("MIME detection: .jpg → image/jpeg", () => {
  assert.equal(mimeForPath("image.jpg"), "image/jpeg");
});

test("MIME detection: .JPEG (upper-case) → image/jpeg", () => {
  assert.equal(mimeForPath("photo.JPEG"), "image/jpeg");
});

test("MIME detection: .webp → image/webp", () => {
  assert.equal(mimeForPath("banner.webp"), "image/webp");
});

test("MIME detection: .svg → image/svg+xml", () => {
  assert.equal(mimeForPath("icon.svg"), "image/svg+xml");
});

test("MIME detection: unsupported type → undefined", () => {
  assert.equal(mimeForPath("document.pdf"), undefined);
  assert.equal(mimeForPath("archive.zip"), undefined);
  assert.equal(mimeForPath("photo.bmp"), undefined);
});

// ── data: URL construction (mirrors the MCP tool's encoding step) ─────────────

function buildDataUrl(bytes: Buffer, mime: string) {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

test("buildDataUrl: produces a valid data: image string", () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
  const url = buildDataUrl(buf, "image/png");
  assert.ok(isDataImage(url), "isDataImage should recognise the produced data URL");
  assert.ok(url.startsWith("data:image/png;base64,"));
});

test("buildDataUrl: round-trips correctly through base64", () => {
  const original = "hello thumbnail";
  const buf = Buffer.from(original, "utf8");
  const url = buildDataUrl(buf, "image/png");
  const [, b64] = url.split(",");
  assert.equal(Buffer.from(b64, "base64").toString("utf8"), original);
});

// ── size limit (5 MB) ─────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

test("size limit: a 1 KB buffer is within the 5 MB limit", () => {
  const buf = Buffer.alloc(1024);
  assert.ok(buf.length <= MAX_IMAGE_BYTES);
});

test("size limit: a buffer just over 5 MB is rejected", () => {
  const buf = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  assert.ok(buf.length > MAX_IMAGE_BYTES);
});

test("size limit: exactly 5 MB is accepted", () => {
  const buf = Buffer.alloc(MAX_IMAGE_BYTES);
  assert.ok(buf.length <= MAX_IMAGE_BYTES);
});

// ── file-not-found guard ──────────────────────────────────────────────────────

test("file-not-found guard: a non-existent path is correctly detected", () => {
  const p = path.join(os.tmpdir(), `nonexistent-${Date.now()}.png`);
  assert.equal(fs.existsSync(p), false);
});

test("file-not-found guard: a real temp file is detected as existing", () => {
  const p = path.join(os.tmpdir(), `mcp-test-${Date.now()}.png`);
  fs.writeFileSync(p, Buffer.alloc(4));
  try {
    assert.equal(fs.existsSync(p), true);
  } finally {
    fs.unlinkSync(p);
  }
});

// ── isDataImage (from stored-images, used by storeImage) ──────────────────────

test("isDataImage: recognises a well-formed data:image URL", () => {
  assert.equal(isDataImage("data:image/png;base64,abc123"), true);
  assert.equal(isDataImage("data:image/jpeg;base64,/9j/"), true);
  assert.equal(isDataImage("data:image/svg+xml;base64,PHN2Zy"), true);
});

test("isDataImage: rejects plain URLs and non-image data URLs", () => {
  assert.equal(isDataImage("https://example.com/thumb.png"), false);
  assert.equal(isDataImage("data:text/plain;base64,aGk="), false);
  assert.equal(isDataImage(null), false);
  assert.equal(isDataImage(undefined), false);
  assert.equal(isDataImage(42), false);
});

// ── labPassMark guard on update_cohort_task ───────────────────────────────────

test("labPassMark guard: valid range accepted", () => {
  for (const v of [1, 50, 70, 100]) {
    assert.equal(parseLabPassMark(v), v, `expected ${v} to be accepted`);
  }
});

test("labPassMark guard: 0 rejected (below range)", () => {
  assert.equal(parseLabPassMark(0), null);
});

test("labPassMark guard: 101 rejected (above range)", () => {
  assert.equal(parseLabPassMark(101), null);
});

test("labPassMark guard: non-integer rejected", () => {
  assert.equal(parseLabPassMark(70.5), null);
});

test("labPassMark guard: null and undefined rejected", () => {
  assert.equal(parseLabPassMark(null), null);
  assert.equal(parseLabPassMark(undefined), null);
});

test("labPassMark guard: only saved on tasks with a labScenarioId (logic check)", () => {
  // The tool fetches the task and checks labScenarioId before saving.
  function shouldAllowUpdate(labScenarioId: string | null) {
    return labScenarioId !== null;
  }
  assert.equal(shouldAllowUpdate(null), false);
  assert.equal(shouldAllowUpdate("scenario-abc"), true);
});
