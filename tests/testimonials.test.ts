import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TESTIMONIAL_FIELDS,
  isJsonRequest,
  parseTestimonialInput,
  parseTestimonialTags,
  resolveDriveFolderUrl,
  testimonialsToCsv,
} from "../lib/testimonial-input";

const valid = {
  videoLink: "https://drive.google.com/file/d/abc/view",
  testimonial: "  I learnt so much.  ",
  rating: 9,
  consent: true,
};

test("a valid testimonial is stored as exactly four text fields", () => {
  const result = parseTestimonialInput(valid);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    videoLink: "https://drive.google.com/file/d/abc/view",
    testimonial: "I learnt so much.",
    rating: 9,
    consent: true,
  });
  assert.deepEqual(Object.keys(result.value).sort(), [...TESTIMONIAL_FIELDS].sort());
});

test("the testimonial form stores no files: file fields, blobs and data: URLs are refused", () => {
  for (const extra of [
    { file: "AAAA" },
    { video: { name: "me.mp4", size: 1024 } },
    { videoFile: "data:video/mp4;base64,AAAA" },
    { upload: [1, 2, 3] },
  ]) {
    const result = parseTestimonialInput({ ...valid, ...extra });
    assert.equal(result.ok, false, `refuses ${Object.keys(extra)[0]}`);
  }
  for (const videoLink of [
    "data:video/mp4;base64,AAAAIGZ0eXBpc29t",
    "blob:https://sabirole.com/123",
    "file:///C:/Users/me/video.mp4",
    "javascript:alert(1)",
    { name: "video.mp4" },
  ]) {
    assert.equal(parseTestimonialInput({ ...valid, videoLink }).ok, false, `refuses ${String(videoLink)}`);
  }
});

test("only JSON requests are accepted (a multipart file upload is refused)", () => {
  assert.equal(isJsonRequest("application/json"), true);
  assert.equal(isJsonRequest("application/json; charset=utf-8"), true);
  assert.equal(isJsonRequest("multipart/form-data; boundary=----x"), false);
  assert.equal(isJsonRequest("video/mp4"), false);
  assert.equal(isJsonRequest(null), false);
});

test("the database model has no file or binary columns", () => {
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.match(/model InternTestimonial \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(model, "InternTestimonial model exists");
  assert.doesNotMatch(model, /\bBytes\b/);
  const columns = model
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0]);
  assert.deepEqual(columns.sort(), [
    "application", "applicationId", "cohort", "cohortId", "consent", "createdAt", "id",
    "program", "programId", "rating", "status", "tags", "testimonial", "updatedAt",
    "user", "userId", "videoLink",
  ]);
});

test("rating 1–10, testimonial text required, consent and link optional", () => {
  assert.equal(parseTestimonialInput({ ...valid, rating: 0 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: 11 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: 7.5 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: "9" }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, testimonial: "   " }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, testimonial: "x".repeat(5001) }).ok, false);
  const minimal = parseTestimonialInput({ testimonial: "Great", rating: 1 });
  assert.ok(minimal.ok);
  if (minimal.ok) assert.deepEqual(minimal.value, { videoLink: null, testimonial: "Great", rating: 1, consent: false });
  assert.equal(parseTestimonialInput({ ...valid, consent: "yes" }).ok, false);
  assert.equal(parseTestimonialInput(null).ok, false);
});

test("an intern sees their cohort's Drive folder, else the global one", () => {
  assert.equal(resolveDriveFolderUrl("https://drive.google.com/c", "https://drive.google.com/g"), "https://drive.google.com/c");
  assert.equal(resolveDriveFolderUrl(null, "https://drive.google.com/g"), "https://drive.google.com/g");
  assert.equal(resolveDriveFolderUrl(null, null), null);
});

test("tags are tidied; CSV export escapes quotes and neutralises formulas", () => {
  assert.deepEqual(parseTestimonialTags([" Video ", "video", "", "Graduation"]), ["video", "graduation"]);
  assert.equal(parseTestimonialTags("video"), null);
  const csv = testimonialsToCsv([
    {
      id: "t1", name: "Ada, Obi", email: "ada@example.com", track: "Digital Marketing", cohort: null,
      rating: 10, testimonial: 'She said "wow"\nnew line', videoLink: null, consent: true,
      status: "APPROVED", tags: ["video"], submittedAt: "2026-11-15T10:00:00.000Z",
    },
    {
      id: "t2", name: "=HYPERLINK(\"x\")", email: "b@example.com", track: "Web", cohort: "Nov",
      rating: 5, testimonial: "ok", videoLink: "https://drive.google.com/x", consent: false,
      status: "PENDING", tags: [], submittedAt: "2026-11-15T10:00:00.000Z",
    },
  ]);
  const lines = csv.split("\r\n");
  assert.match(lines[0], /^Name,Email,Track,Cohort,Rating,Testimonial,Video link,Consent to share/);
  assert.ok(csv.includes('"Ada, Obi"'));
  assert.ok(csv.includes('"She said ""wow""\nnew line"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), "formula is neutralised");
  assert.ok(lines[1].includes(",Yes,") && csv.includes(",No,"));
});
