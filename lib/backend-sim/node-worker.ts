import { parentPort, workerData } from "node:worker_threads";
import { loadNodeModules } from "./node-modules";
import { runTest } from "./engine";
import type { ApiTest, BackendConfig, BackendFiles } from "./model";

// Worker thread that runs one submission's tests (see ./server). It reports
// each test as it finishes, so if it has to be stopped the finished results
// are kept.

export type WorkerJob = {
  files: BackendFiles;
  config: Pick<BackendConfig, "databaseSql" | "env">;
  tests: ApiTest[];
};
export type WorkerMessage =
  | { type: "test"; result: ReturnType<typeof runTest> }
  | { type: "done" }
  | { type: "error"; error: string };

const job = workerData as WorkerJob;
const post = (message: WorkerMessage) => parentPort!.postMessage(message);

loadNodeModules()
  .then((modules) => {
    for (const test of job.tests) post({ type: "test", result: runTest(modules, job.files, job.config, test) });
    post({ type: "done" });
  })
  .catch((error: unknown) => post({ type: "error", error: String((error as Error)?.message ?? error) }));
