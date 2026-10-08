// Copies the Practice Lab backend simulator's WebAssembly files into
// public/lab-runtime, where the browser loads them. Run after upgrading
// sql.js or @jitl/quickjs-wasmfile-release-sync, and update RUNTIME_VERSION
// in lib/backend-sim/browser-worker.ts (a test checks both).
//
//   npm run lab-runtime

import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/lab-runtime", { recursive: true });
copyFileSync("node_modules/sql.js/dist/sql-wasm.wasm", "public/lab-runtime/sql-wasm.wasm");
copyFileSync(
  "node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm",
  "public/lab-runtime/quickjs.wasm",
);
console.log("Copied the lab runtime to public/lab-runtime.");
