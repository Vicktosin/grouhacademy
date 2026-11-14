// Copies MediaPipe's vision WebAssembly (the classic build, loaded on the
// page) and the face detection model into public/mediapipe, so the
// browser loads them from this site (no CDN; our CSP allows 'self').
// The graduation flyer uses them to centre the graduate's face.
// Run after upgrading @mediapipe/tasks-vision, and update MEDIAPIPE_VERSION
// in lib/flyer/photo.ts.
//
//   npm run mediapipe
//
// Model (Apache-2.0, Google MediaPipe): blaze_face_short_range, face detection.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync("node_modules/@mediapipe/tasks-vision/package.json", "utf8")).version;
const wasmDir = `public/mediapipe/tasks-vision-${version}`;
mkdirSync(wasmDir, { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"])
  copyFileSync(`node_modules/@mediapipe/tasks-vision/wasm/${file}`, `${wasmDir}/${file}`);

const models: Record<string, string> = {
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

downloadModels().then(() => console.log(`Copied MediaPipe ${version} and its model to public/mediapipe.`));
