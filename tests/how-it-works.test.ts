import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { guideActions, HowItWorksButton, HowItWorksDialog, isFirstVisit } from "../components/onboarding/HowItWorksGuide";
import { guideVideoEmbed, parseGuideVideoLink } from "../lib/guide-video";
import { OFFICE_LIFE_GUIDE, PRACTICE_LAB_GUIDE } from "../lib/how-it-works";

// The browser storage the guide remembers itself in (lib/intern-onboarding).
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
  window: { dispatchEvent: () => true },
});

test("the guide opens by itself the first time, and not again once closed", () => {
  store.clear();
  for (const guide of [OFFICE_LIFE_GUIDE, PRACTICE_LAB_GUIDE]) {
    assert.equal(isFirstVisit(guide.key), true);
    let open = true;
    guideActions(guide.key, (value) => (open = value)).close();
    assert.equal(open, false);
    assert.equal(isFirstVisit(guide.key), false);
  }
});

test("closing one guide doesn't hide the other", () => {
  store.clear();
  guideActions("office-life", () => undefined).close();
  assert.equal(isFirstVisit("office-life"), false);
  assert.equal(isFirstVisit("practice-lab"), true);
});

test("the How it works button opens the guide again", () => {
  store.clear();
  let open = false;
  const { close, reopen } = guideActions("practice-lab", (value) => (open = value));
  close();
  const button = HowItWorksButton({ onClick: reopen }) as ReactElement<{ onClick: () => void }>;
  assert.match(renderToStaticMarkup(button), /How it works/);
  button.props.onClick();
  assert.equal(open, true);
  // Reopening doesn't forget that it was closed: it still won't open by itself.
  assert.equal(isFirstVisit("practice-lab"), false);
});

test("the guide shows its numbered steps and can be closed", () => {
  const html = renderToStaticMarkup(createElement(HowItWorksDialog, { guide: OFFICE_LIFE_GUIDE, videoSrc: null, onClose: () => undefined }));
  assert.match(html, /How Office Life works/);
  assert.match(html, /<ol/);
  assert.match(html, /Clock in and start work/);
  assert.match(html, /Got it/);
  assert.match(html, /aria-label="Close"/);
});

test("the demo video shows only when a link is set", () => {
  const without = renderToStaticMarkup(createElement(HowItWorksDialog, { guide: PRACTICE_LAB_GUIDE, videoSrc: null, onClose: () => undefined }));
  assert.doesNotMatch(without, /<iframe/);
  const src = guideVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const withVideo = renderToStaticMarkup(createElement(HowItWorksDialog, { guide: PRACTICE_LAB_GUIDE, videoSrc: src, onClose: () => undefined }));
  assert.match(withVideo, /<iframe[^>]+src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test("YouTube and Google Drive links become players; anything else shows nothing", () => {
  assert.equal(guideVideoEmbed("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1");
  assert.equal(
    guideVideoEmbed("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing"),
    "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview",
  );
  for (const raw of [null, "", "   ", "https://example.com/video.mp4", "javascript:alert(1)", "not a link"])
    assert.equal(guideVideoEmbed(raw), null, String(raw));
});

test("admins can set a YouTube or Drive link, or clear it; other links are refused", () => {
  assert.deepEqual(parseGuideVideoLink("  https://youtu.be/dQw4w9WgXcQ "), { url: "https://youtu.be/dQw4w9WgXcQ" });
  assert.deepEqual(parseGuideVideoLink(""), { url: null });
  assert.ok("error" in parseGuideVideoLink("https://vimeo.com/123"));
});

// Every button, tab or label the guides quote must be on the real screens.
const SCREENS = [
  "app/internship/dashboard/office-life/page.tsx",
  ...readdirSync("components/office-life").map((file) => `components/office-life/${file}`),
  "app/internship/dashboard/lab/page.tsx",
  "app/internship/dashboard/lab/[id]/page.tsx",
  ...["LabWorkspace", "AdsSimulator", "SocialSimulator", "AutomationSimulator", "BackendSimulator", "ContentSimulator", "WordPressLab"].map((name) => `components/${name}.tsx`),
  "lib/content-sim/model.ts",
];
const source = SCREENS.map((file) => readFileSync(file, "utf8")).join("\n").replace(/&apos;/g, "'");

test("the guides only name buttons and tabs that exist", () => {
  for (const guide of [OFFICE_LIFE_GUIDE, PRACTICE_LAB_GUIDE])
    for (const step of guide.sections.flatMap((section) => section.steps))
      for (const [, label] of step.matchAll(/"([^"]+)"/g))
        assert.ok(source.includes(label), `${guide.key}: "${label}" isn't on any screen`);
});
