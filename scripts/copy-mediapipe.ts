// Copies MediaPipe's vision WebAssembly (the ES-module build for the
// graduation flyer's Web Worker, and the classic build for browsers that
// run it on the page instead) and its models into public/mediapipe,
// so the browser loads them from this site (no CDN; our CSP allows 'self').
// Run after upgrading @mediapipe/tasks-vision, and update MEDIAPIPE_VERSION
// in lib/flyer/segmentation-worker.ts.
//
//   npm run mediapipe
//
// Models (Apache-2.0, Google MediaPipe):
//  - selfie_multiclass_256x256: person / hair / face / clothes segmentation
//  - blaze_face_short_range: face detection, to place the head

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync("node_modules/@mediapipe/tasks-vision/package.json", "utf8")).version;
const wasmDir = `public/mediapipe/tasks-vision-${version}`;
mkdirSync(wasmDir, { recursive: true });
for (const file of [
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
])
  copyFileSync(`node_modules/@mediapipe/tasks-vision/wasm/${file}`, `${wasmDir}/${file}`);

const models: Record<string, string> = {
  "selfie_multiclass_256x256.tflite":
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
  "blaze_face_short_range.tflite":
    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
};
mkdirSync("public/mediapipe/models", { recursive: true });
async function downloadModels() {
for (const [name, url] of Object.entries(models)) {
  const target = `public/mediapipe/models/${name}`;
  if (existsSync(target)) continue;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}
}

downloadModels().then(() => console.log(`Copied MediaPipe ${version} and its models to public/mediapipe.`));
