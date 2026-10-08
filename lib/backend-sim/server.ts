import { Worker } from "node:worker_threads";
import {
  scoreTests,
  type ApiTest,
  type BackendConfig,
  type BackendFiles,
  type BackendResult,
  type TestResult,
} from "./model";
import type { WorkerJob, WorkerMessage } from "./node-worker";

// Runs a submission's API tests on the server, away from the app itself:
// each submission gets its own worker thread with a memory cap, which is
// killed if a test stalls (SQLite queries can't be interrupted from inside)
// or the whole run takes too long. Only a few run at once per server
// instance; more wait briefly, and beyond that the intern is asked to try
// again. The app's own requests are never blocked by an intern's code.

const MAX_RUNNING = 2;
const MAX_WAITING = 8;
const WAIT_MS = 20_000;
/** A test that takes longer than this is stopped (normally well under 1s). */
const TEST_TIMEOUT_MS = 10_000;
/** The whole run, including starting the worker. */
const RUN_TIMEOUT_MS = 40_000;

export class BusyError extends Error {}

let running = 0;
const waiting: Array<() => void> = [];

async function acquire() {
  if (running < MAX_RUNNING) {
    running++;
    return;
  }
  if (waiting.length >= MAX_WAITING) throw new BusyError();
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = waiting.indexOf(go);
      if (index !== -1) waiting.splice(index, 1);
      reject(new BusyError());
    }, WAIT_MS);
    const go = () => {
      clearTimeout(timer);
      resolve();
    };
    waiting.push(go);
  });
  running++;
}

function release() {
  running--;
  waiting.shift()?.();
}

function notRun(test: ApiTest, error: string): TestResult {
  return {
    testId: test.id,
    label: test.label,
    hidden: test.hidden,
    points: test.points,
    hint: test.hint,
    passed: false,
    error,
    steps: [],
    logs: [],
  };
}

function runInWorker(job: WorkerJob): Promise<BackendResult> {
  return new Promise((resolve, reject) => {
    const results: TestResult[] = [];
    let settled = false;
    const worker = new Worker(new URL("./node-worker.ts", import.meta.url), {
      workerData: job,
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
      // The intern's code never sees the environment, but the worker doesn't
      // need the app's secrets either: only where temporary files go.
      env: Object.fromEntries(
        ["NODE_ENV", "TMPDIR", "TEMP", "TMP", "SystemRoot"]
          .filter((key) => process.env[key] !== undefined)
          .map((key) => [key, process.env[key]]),
      ),
    });

    const finish = (stoppedReason?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(testTimer);
      clearTimeout(runTimer);
      void worker.terminate();
      const done = new Set(results.map((r) => r.testId));
      const rest = job.tests.filter((t) => !done.has(t.id));
      resolve(
        scoreTests([
          ...results,
          ...rest.map((test, index) =>
            notRun(test, index === 0 && stoppedReason ? stoppedReason : "Not run: an earlier test was stopped."),
          ),
        ]),
      );
    };

    let testTimer = setTimeout(
      () => finish(`This test was stopped after ${TEST_TIMEOUT_MS / 1000} seconds. Look for a database query that never finishes (for example a recursive query) or an endless loop.`),
      TEST_TIMEOUT_MS + 5_000, // first test includes starting the worker
    );
    const runTimer = setTimeout(
      () => finish(`Testing was stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Your API is too slow to finish the tests.`),
      RUN_TIMEOUT_MS,
    );

    worker.on("message", (message: WorkerMessage) => {
      if (message.type === "test") {
        results.push(message.result);
        clearTimeout(testTimer);
        testTimer = setTimeout(
          () => finish(`This test was stopped after ${TEST_TIMEOUT_MS / 1000} seconds. Look for a database query that never finishes (for example a recursive query) or an endless loop.`),
          TEST_TIMEOUT_MS,
        );
      } else if (message.type === "done") finish();
      else if (!settled) {
        settled = true;
        clearTimeout(testTimer);
        clearTimeout(runTimer);
        void worker.terminate();
        reject(new Error(message.error));
      }
    });
    worker.on("error", (error) => {
      // Usually the memory cap.
      if (results.length || /memory/i.test(error.message))
        finish("The tests used too much memory and were stopped.");
      else if (!settled) {
        settled = true;
        clearTimeout(testTimer);
        clearTimeout(runTimer);
        reject(error);
      }
    });
    worker.on("exit", () => finish("Testing stopped unexpectedly."));
  });
}

/** Runs the tests in a worker thread. Throws BusyError when the server is full. */
export async function runBackendTestsIsolated(
  files: BackendFiles,
  config: BackendConfig,
  tests: ApiTest[] = config.tests,
): Promise<BackendResult> {
  await acquire();
  try {
    return await runInWorker({
      files,
      config: { databaseSql: config.databaseSql, env: config.env },
      tests,
    });
  } finally {
    release();
  }
}
