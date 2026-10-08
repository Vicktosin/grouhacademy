import { readFileSync } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import quickjsVariant from "@jitl/quickjs-wasmfile-release-sync";
import type { EngineModules } from "./engine";

// Loads the sandbox's WebAssembly modules in Node (the server's worker
// thread and the tests). The .wasm files are read from node_modules, which
// the build traces into the deployment.

const root = process.cwd();
const SQL_WASM = path.join(root, "node_modules/sql.js/dist/sql-wasm.wasm");
const QUICKJS_WASM = path.join(
  root,
  "node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm",
);

function bytes(file: string) {
  const buffer = readFileSync(file);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function loadNodeModules(): Promise<EngineModules> {
  const [SQL, quickjs] = await Promise.all([
    initSqlJs({ wasmBinary: bytes(SQL_WASM) }),
    newQuickJSWASMModuleFromVariant(
      newVariant(quickjsVariant, { wasmBinary: bytes(QUICKJS_WASM) }),
    ),
  ]);
  return { SQL, quickjs };
}
