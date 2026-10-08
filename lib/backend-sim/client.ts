import type { WorkerRequest } from "./browser-worker";

// The page's side of the browser sandbox: sends work to the Web Worker and
// waits for answers. If an answer takes too long (SQLite can't be
// interrupted mid-query), the worker is killed and a fresh one is started
// on the next call; the server then needs starting again.

/** Requests are stopped inside the sandbox after 2s; this catches stuck SQL. */
const CALL_TIMEOUT_MS = 12_000;
/** Loading the WebAssembly files on a slow connection. */
const FIRST_CALL_TIMEOUT_MS = 60_000;

export class StuckError extends Error {}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  progress?: (value: unknown) => void;
  timer: number;
  /** Restarts the stuck-timer (each finished test counts as progress). */
  arm: () => void;
};

export class BackendSandbox {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private warm = false;

  constructor(private onRestart: () => void) {}

  private spawn() {
    const worker = new Worker(new URL("./browser-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; value?: unknown; error?: string; progress?: unknown }>) => {
      const { id, value, error, progress } = event.data;
      const call = this.pending.get(id);
      if (!call) return;
      if (progress !== undefined) {
        call.arm();
        call.progress?.(progress);
        return;
      }
      window.clearTimeout(call.timer);
      this.pending.delete(id);
      this.warm = true;
      if (error) call.reject(new Error(error));
      else call.resolve(value);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      this.kill(new Error(event.message || "The simulator stopped unexpectedly."));
    };
    this.worker = worker;
    return worker;
  }

  /** Stops the worker and fails everything waiting on it. */
  private kill(error: Error) {
    this.worker?.terminate();
    this.worker = null;
    this.warm = false;
    for (const call of this.pending.values()) {
      window.clearTimeout(call.timer);
      call.reject(error);
    }
    this.pending.clear();
    this.onRestart();
  }

  call<T>(message: WorkerRequest, options: { timeoutMs?: number; progress?: (value: unknown) => void } = {}) {
    const worker = this.worker ?? this.spawn();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      let timeout = (this.warm ? 0 : FIRST_CALL_TIMEOUT_MS) + (options.timeoutMs ?? CALL_TIMEOUT_MS);
      const call: Pending = {
        resolve: resolve as (value: unknown) => void,
        reject,
        progress: options.progress,
        timer: 0,
        arm: () => {
          window.clearTimeout(call.timer);
          call.timer = window.setTimeout(
            () =>
              this.kill(
                new StuckError(
                  "Your server got stuck, probably on a database query that never finishes, so it was restarted.",
                ),
              ),
            timeout,
          );
          timeout = options.timeoutMs ?? CALL_TIMEOUT_MS;
        },
      };
      call.arm();
      this.pending.set(id, call);
      worker.postMessage({ id, message });
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    for (const call of this.pending.values()) window.clearTimeout(call.timer);
    this.pending.clear();
  }
}
