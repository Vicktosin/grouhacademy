import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { mediaPathFromUrl } from "../lib/testimonial-media";

const root = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("media paths come from public bucket URLs only", () => {
  const base = "https://x.supabase.co/storage/v1/object/public/testimonial-media";
  assert.equal(mediaPathFromUrl(`${base}/flyers/u1/a.jpg`), "flyers/u1/a.jpg");
  assert.equal(mediaPathFromUrl(`${base}/voice-notes/u1/b.webm?t=1`), "voice-notes/u1/b.webm");
  assert.equal(mediaPathFromUrl(`${base}/flyers/../secret`), null);
  assert.equal(mediaPathFromUrl("https://x.supabase.co/storage/v1/object/public/avatars/a.png"), null);
  assert.equal(mediaPathFromUrl(null), null);
});

test("the media cleanup runs every 12 hours, as daily jobs the Hobby plan allows", () => {
  const crons: { path: string; schedule: string }[] = JSON.parse(read("vercel.json")).crons;
  const cleanup = crons.filter((cron) => cron.path.startsWith("/api/cron/testimonial-media"));
  assert.deepEqual(cleanup.map((cron) => cron.schedule).sort(), ["0 19 * * *", "0 7 * * *"]);
  // Hobby: each job at most once a day (a fixed minute and hour).
  for (const cron of crons) assert.match(cron.schedule, /^\d+ \d+ /);
});

test("the certificate is withheld until a graduate has shared their experience", () => {
  const route = read("app/api/internship/certificate/route.ts");
  assert.match(route, /mustShareExperience\(userId\)/);
  assert.match(route, /experienceRequired: true/);
  assert.match(route, /certificates: \[\]/);
});

test("interns are no longer asked for consent", () => {
  assert.doesNotMatch(read("components/graduation/ExperienceForm.tsx"), /type="checkbox" checked=\{consent\}/);
  assert.doesNotMatch(read("app/admin/internship/testimonials/page.tsx"), /consentOnly/);
});
