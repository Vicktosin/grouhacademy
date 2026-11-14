import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  TESTIMONIAL_FIELDS,
  baseContentType,
  isJsonRequest,
  isOwnMediaUrl,
  mediaUrlPrefix,
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
const prefix = mediaUrlPrefix("https://abc.supabase.co/", "voice-notes", "user-1");

test("a valid testimonial is stored as exactly its known fields", () => {
  const result = parseTestimonialInput(valid);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    videoLink: "https://drive.google.com/file/d/abc/view",
    voiceNoteUrl: null,
    testimonial: "I learnt so much.",
    rating: 9,
    consent: true,
  });
  assert.deepEqual(Object.keys(result.value).sort(), [...TESTIMONIAL_FIELDS].sort());
});

test("the form stores no files: file fields, blobs and data: URLs are refused", () => {
  for (const extra of [
    { file: "AAAA" },
    { video: { name: "me.mp4", size: 1024 } },
    { videoFile: "data:video/mp4;base64,AAAA" },
    { upload: [1, 2, 3] },
    { flyerUrl: "https://abc.supabase.co/x.png" },
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
  assert.equal(baseContentType("audio/webm;codecs=opus"), "audio/webm");
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
    "application", "applicationId", "cohort", "cohortId", "consent", "createdAt", "flyerUrl", "id",
    "program", "programId", "rating", "status", "tags", "testimonial", "updatedAt",
    "user", "userId", "videoLink", "voiceNoteUrl",
  ]);
});

test("one of a video link, a voice note or writing is needed; rating and consent are optional", () => {
  assert.equal(parseTestimonialInput({}).ok, false, "nothing shared");
  assert.equal(parseTestimonialInput({ testimonial: "   " }).ok, false, "only spaces");
  assert.ok(parseTestimonialInput({ videoLink: "https://drive.google.com/file/d/x" }).ok, "video only");
  assert.ok(parseTestimonialInput({ voiceNoteUrl: `${prefix}a.webm` }, { voiceNotePrefix: prefix }).ok, "voice only");
  const minimal = parseTestimonialInput({ testimonial: "Great" });
  assert.ok(minimal.ok);
  if (minimal.ok)
    assert.deepEqual(minimal.value, { videoLink: null, voiceNoteUrl: null, testimonial: "Great", rating: null, consent: false });
  assert.equal(parseTestimonialInput({ ...valid, rating: 0 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: 11 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: 7.5 }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, rating: "9" }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, testimonial: "x".repeat(5001) }).ok, false);
  assert.equal(parseTestimonialInput({ ...valid, consent: "yes" }).ok, false);
  assert.equal(parseTestimonialInput(null).ok, false);
});

test("voice notes: only Storage URLs in the intern's own folder", () => {
  assert.equal(prefix, "https://abc.supabase.co/storage/v1/object/public/testimonial-media/voice-notes/user-1/");
  assert.ok(isOwnMediaUrl(`${prefix}note.webm`, prefix));
  for (const voiceNoteUrl of [
    "https://evil.example.com/note.webm",
    "https://abc.supabase.co/storage/v1/object/public/testimonial-media/voice-notes/user-2/x.webm",
    `${prefix}../user-2/x.webm`,
    `${prefix}sub/x.webm`,
    `${prefix}x.webm?download=1`,
    prefix,
    "data:audio/webm;base64,AAAA",
    42,
  ]) {
    assert.equal(
      parseTestimonialInput({ voiceNoteUrl }, { voiceNotePrefix: prefix }).ok,
      false,
      `refuses ${JSON.stringify(voiceNoteUrl)}`,
    );
  }
  // Without a known prefix (Storage not configured) no voice note is accepted.
  assert.equal(parseTestimonialInput({ voiceNoteUrl: `${prefix}a.webm` }).ok, false);
});

test("an intern sees their cohort's Drive folder, else the global one", () => {
  assert.equal(resolveDriveFolderUrl("https://drive.google.com/c", "https://drive.google.com/g"), "https://drive.google.com/c");
  assert.equal(resolveDriveFolderUrl(null, "https://drive.google.com/g"), "https://drive.google.com/g");
  assert.equal(resolveDriveFolderUrl(null, null), null);
});

test("tags are tidied; CSV export escapes quotes and neutralises formulas", () => {
  assert.deepEqual(parseTestimonialTags([" Video ", "video", "", "Graduation"]), ["video", "graduation"]);
  assert.equal(parseTestimonialTags("video"), null);
  const row = {
    voiceNoteUrl: null, flyerUrl: null, status: "PENDING", tags: [] as string[], submittedAt: "2026-11-15T10:00:00.000Z",
  };
  const csv = testimonialsToCsv([
    {
      ...row, id: "t1", name: "Ada, Obi", email: "ada@example.com", track: "Digital Marketing", cohort: null,
      rating: 10, testimonial: 'She said "wow"\nnew line', videoLink: null, consent: true, status: "APPROVED", tags: ["video"],
    },
    {
      ...row, id: "t2", name: "=HYPERLINK(\"x\")", email: "b@example.com", track: "Web", cohort: "Nov",
      rating: null, testimonial: "", videoLink: "https://drive.google.com/x", consent: false,
      flyerUrl: "https://x.supabase.co/f.png",
    },
  ]);
  const lines = csv.split("\r\n");
  assert.match(lines[0], /^Name,Email,Track,Cohort,Rating,Testimonial,Video link,Voice note,Flyer,Consent to share/);
  assert.ok(csv.includes('"Ada, Obi"'));
  assert.ok(csv.includes('"She said ""wow""\nnew line"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`), "formula is neutralised");
  assert.ok(csv.includes(",https://x.supabase.co/f.png,No,"));
});

test("voice notes: the option goes at 6 people, and 7 is a strict maximum", async () => {
  const { VOICE_NOTE_LIMIT, VOICE_NOTE_HARD_LIMIT } = await import("../lib/testimonial-input");
  assert.equal(VOICE_NOTE_LIMIT, 6);
  assert.equal(VOICE_NOTE_HARD_LIMIT, 7);
  const source = readFileSync(new URL("../lib/testimonials.ts", import.meta.url), "utf8");
  assert.match(source, /distinct: \["userId"\]/, "counted per person, not per submission");
  assert.match(source, /user: REAL_USER/, "admins' previews don't count");
  assert.match(source, /pg_advisory_xact_lock[\s\S]*>= VOICE_NOTE_HARD_LIMIT/, "saving checks the strict limit under a lock");
  assert.match(
    readFileSync(new URL("../app/api/internship/testimonial/voice/route.ts", import.meta.url), "utf8"),
    /voiceNotesOpen\(access\.userId, undefined, VOICE_NOTE_HARD_LIMIT\)/,
    "no recording is stored once full",
  );
});
