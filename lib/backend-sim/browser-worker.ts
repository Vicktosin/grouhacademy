/// <reference lib="webworker" />
import initSqlJs from "sql.js";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
} from "quickjs-emscripten-core";
import quickjsVariant from "@jitl/quickjs-wasmfile-release-sync";
import { BackendApp, runTest, type EngineModules } from "./engine";
import type { ApiTest, BackendFiles, EnvVar, HttpRequest } from "./model";

// Web Worker that runs the intern's server in their browser while they
// work (see ./client). Being a worker, the page stays responsive and can
// kill it if a database query never ends. The .wasm files are served from
// public/lab-runtime (copied there by `npm run lab-runtime`).

export type WorkerRequest =
  | { type: "start"; files: BackendFiles; databaseSql: string; env: EnvVar[] }
  | { type: "reload"; files: BackendFiles }
  | { type: "request"; request: HttpRequest }
  | { type: "query"; sql: string }
  | { type: "tables" }
  | { type: "runTests"; files: BackendFiles; databaseSql: string; env: EnvVar[]; tests: ApiTest[] };

/**
 * The package versions the .wasm files come from. Browsers keep the files
 * for a year (see next.config.ts), so the version is in the URL: an upgrade
 * gets new files. A test checks it matches the installed packages.
 */
export const RUNTIME_VERSION = "sqljs-1.14.2_quickjs-0.32.0";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let modules: Promise<EngineModules> | null = null;
let app: BackendApp | null = null;

async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't load the simulator (${response.status}). Check your connection and reload.`);
  return response.arrayBuffer();
}

function load() {
  modules ??= (async () => {
    const [sqlWasm, quickjsWasm] = await Promise.all([
      bytes(`/lab-runtime/sql-wasm.wasm?v=${RUNTIME_VERSION}`),
      bytes(`/lab-runtime/quickjs.wasm?v=${RUNTIME_VERSION}`),
    ]);
    const [SQL, quickjs] = await Promise.all([
      initSqlJs({ wasmBinary: sqlWasm }),
      newQuickJSWASMModuleFromVariant(newVariant(quickjsVariant, { wasmBinary: quickjsWasm })),
    ]);
    return { SQL, quickjs };
  })();
  modules.catch(() => (modules = null));
  return modules;
}

async function handle(id: number, message: WorkerRequest): Promise<unknown> {
  const m = await load();
  switch (message.type) {
    case "start": {
      app?.dispose();
      app = null;
      const started = BackendApp.start(m, message);
      if (!started.app) return { error: started.error, logs: started.logs };
      app = started.app;
      return { error: null, logs: app.takeLogs(), tables: app.tables() };
    }
    case "reload": {
      if (!app) return { error: "The server isn't running.", logs: [] };
      const error = app.reload(message.files);
      return { error, logs: app.takeLogs(), tables: app.tables() };
    }
    case "request": {
      if (!app) return { response: null, logs: [] };
      const response = app.request(message.request);
      return { response, logs: app.takeLogs(), tables: app.tables() };
    }
    case "query": {
      if (!app) return { result: { error: "The server isn't running." }, tables: [] };
      return { result: app.query(message.sql), tables: app.tables() };
    }
    case "tables":
      return { tables: app?.tables() ?? [] };
    case "runTests": {
      const results = [];
      for (const test of message.tests) {
        const result = runTest(m, message.files, message, test);
        results.push(result);
        scope.postMessage({ id, progress: result });
      }
      return { results };
    }
  }
}

scope.onmessage = (event: MessageEvent<{ id: number; message: WorkerRequest }>) => {
  const { id, message } = event.data;
  handle(id, message).then(
    (value) => scope.postMessage({ id, value }),
    (error: unknown) => scope.postMessage({ id, error: String((error as Error)?.message ?? error) }),
  );
};
